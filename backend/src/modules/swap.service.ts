import { Inject, Injectable, Logger } from '@nestjs/common';
import { Token, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core';
import {
  Route,
  SwapQuoter,
  SwapRouter,
  Trade,
  type SwapOptions,
} from '@uniswap/v3-sdk';
import {
  type Address,
  type PublicClient,
  type WalletClient,
  parseUnits,
  decodeAbiParameters,
  encodeFunctionData,
} from 'viem';
import { celo } from 'viem/chains';
import {
  G_DOLLAR,
  CUSD,
  USDC,
  SWAP_ROUTER_ADDRESS,
  QUOTER_ADDRESS,
  G_CUSD_FEE,
  CUSD_USDC_FEE,
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE_PER_GAS,
} from './config';
import { PUBLIC_CLIENT, WALLET_CLIENT, NonceManager } from './viem.provider';
import { PoolStateService } from './pool-state.service';

const erc20ApproveAbi = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [
      { type: 'address' as const, name: 'spender' },
      { type: 'uint256' as const, name: 'amount' },
    ],
    outputs: [{ type: 'bool' as const }],
    stateMutability: 'nonpayable' as const,
  },
];

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly nonceManager: NonceManager,
    private readonly poolState: PoolStateService,
  ) {}

  async quoteSwap(tokenIn: Token, amountIn: string): Promise<bigint> {
    const tokenOut = tokenIn.equals(G_DOLLAR) ? CUSD : G_DOLLAR;
    const amountInWei = parseUnits(amountIn, tokenIn.decimals);
    const pool = await this.poolState.fetchPoolState();
    const route = new Route([pool], tokenIn, tokenOut);

    const { calldata } = SwapQuoter.quoteCallParameters(
      route,
      CurrencyAmount.fromRawAmount(tokenIn, amountInWei.toString()),
      TradeType.EXACT_INPUT,
      { useQuoterV2: true },
    );

    const { data } = await this.client.call({
      to: QUOTER_ADDRESS,
      data: calldata as `0x${string}`,
    });

    const [amountOut] = decodeAbiParameters([{ type: 'uint256' }], data!);
    return amountOut;
  }

  async executeSwap(
    tokenIn: Token,
    amountIn: string,
    amountOut: bigint,
    slippageBps = 50,
  ): Promise<`0x${string}`> {
    const tokenOut = tokenIn.equals(G_DOLLAR) ? CUSD : G_DOLLAR;
    const myAddress = this.walletClient.account!.address;
    const amountInWei = parseUnits(amountIn, tokenIn.decimals);

    const pool = await this.poolState.fetchPoolState();
    const route = new Route([pool], tokenIn, tokenOut);

    const trade = Trade.createUncheckedTrade({
      route,
      inputAmount: CurrencyAmount.fromRawAmount(
        tokenIn,
        amountInWei.toString(),
      ),
      outputAmount: CurrencyAmount.fromRawAmount(
        tokenOut,
        amountOut.toString(),
      ),
      tradeType: TradeType.EXACT_INPUT,
    });

    const options: SwapOptions = {
      slippageTolerance: new Percent(slippageBps, 10_000),
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      recipient: myAddress,
    };

    const { calldata, value } = SwapRouter.swapCallParameters([trade], options);

    const [approveNonce, swapNonce] = await this.nonceManager.allocate(2);

    const approveHash = await this.walletClient.sendTransaction({
      to: tokenIn.address as Address,
      data: encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS as Address, amountInWei],
      }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce: approveNonce,
      chain: celo,
      account: this.walletClient.account!,
    });
    await this.client.waitForTransactionReceipt({
      hash: approveHash,
      timeout: 180_000,
    });
    this.logger.debug(`Approve confirmed: ${approveHash}`);

    const swapHash = await this.walletClient.sendTransaction({
      data: calldata as `0x${string}`,
      to: SWAP_ROUTER_ADDRESS,
      value: BigInt(value),
      gas: 300_000n,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce: swapNonce,
      chain: celo,
      account: this.walletClient.account!,
    });
    this.logger.debug(`Swap submitted: ${swapHash}`);

    try {
      const receipt = await this.client.waitForTransactionReceipt({
        hash: swapHash,
        timeout: 180_000,
      });
      if (receipt.status !== 'success') {
        throw new Error(`Swap reverted: ${swapHash}`);
      }
      this.logger.debug(`Swap confirmed: ${swapHash}`);
    } catch (err) {
      await this.nonceManager.resync();
      throw err;
    }

    return swapHash;
  }

  async quoteMultiHop(amountInWei: bigint): Promise<bigint> {
    const [pool1, pool2] = await Promise.all([
      this.poolState.fetchPoolForTokens(G_DOLLAR, CUSD, G_CUSD_FEE),
      this.poolState.fetchPoolForTokens(CUSD, USDC, CUSD_USDC_FEE),
    ]);
    const route = new Route([pool1, pool2], G_DOLLAR, USDC);

    const { calldata } = SwapQuoter.quoteCallParameters(
      route,
      CurrencyAmount.fromRawAmount(G_DOLLAR, amountInWei.toString()),
      TradeType.EXACT_INPUT,
      { useQuoterV2: true },
    );

    const { data } = await this.client.call({
      to: QUOTER_ADDRESS,
      data: calldata as `0x${string}`,
    });

    const [amountOut] = decodeAbiParameters([{ type: 'uint256' }], data!);
    return amountOut;
  }

  async executeMultiHopSwap(
    amountInWei: bigint,
    amountOut: bigint,
    recipient?: Address,
    slippageBps = 100,
  ): Promise<`0x${string}`> {
    const myAddress = this.walletClient.account!.address;
    const finalRecipient = recipient ?? myAddress;

    const [pool1, pool2] = await Promise.all([
      this.poolState.fetchPoolForTokens(G_DOLLAR, CUSD, G_CUSD_FEE),
      this.poolState.fetchPoolForTokens(CUSD, USDC, CUSD_USDC_FEE),
    ]);
    const route = new Route([pool1, pool2], G_DOLLAR, USDC);

    const trade = Trade.createUncheckedTrade({
      route,
      inputAmount: CurrencyAmount.fromRawAmount(
        G_DOLLAR,
        amountInWei.toString(),
      ),
      outputAmount: CurrencyAmount.fromRawAmount(USDC, amountOut.toString()),
      tradeType: TradeType.EXACT_INPUT,
    });

    const options: SwapOptions = {
      slippageTolerance: new Percent(slippageBps, 10_000),
      deadline: Math.floor(Date.now() / 1000) + 60 * 20,
      recipient: finalRecipient,
    };

    const { calldata, value } = SwapRouter.swapCallParameters([trade], options);

    const [approveNonce, swapNonce] = await this.nonceManager.allocate(2);

    const approveHash = await this.walletClient.sendTransaction({
      to: G_DOLLAR.address as Address,
      data: encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: 'approve',
        args: [SWAP_ROUTER_ADDRESS as Address, amountInWei],
      }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce: approveNonce,
      chain: celo,
      account: this.walletClient.account!,
    });
    await this.client.waitForTransactionReceipt({
      hash: approveHash,
      timeout: 180_000,
    });
    this.logger.debug(`MultiHop approve confirmed: ${approveHash}`);

    const swapHash = await this.walletClient.sendTransaction({
      data: calldata as `0x${string}`,
      to: SWAP_ROUTER_ADDRESS,
      value: BigInt(value),
      gas: 300_000n,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce: swapNonce,
      chain: celo,
      account: this.walletClient.account!,
    });
    this.logger.debug(`MultiHop swap submitted: ${swapHash}`);

    try {
      const receipt = await this.client.waitForTransactionReceipt({
        hash: swapHash,
        timeout: 180_000,
      });
      if (receipt.status !== 'success') {
        throw new Error(`MultiHop swap reverted: ${swapHash}`);
      }
      this.logger.debug(`MultiHop swap confirmed: ${swapHash}`);
    } catch (err) {
      await this.nonceManager.resync();
      throw err;
    }

    return swapHash;
  }
}
