import { Inject, Injectable, Logger } from '@nestjs/common'
import { Token } from '@uniswap/sdk-core'
import { type Address, type PublicClient, type WalletClient, parseUnits, encodePacked, encodeFunctionData } from 'viem'
import { celo } from 'viem/chains'
import QuoterV2ABI from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'
import { G_DOLLAR, CUSD, USDC, POOL_FEE, SWAP_ROUTER_ADDRESS } from './config'
import { PUBLIC_CLIENT, WALLET_CLIENT, NonceManager } from './viem.provider'

const QUOTER_ADDRESS = '0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8' as Address
const G_CUSD_FEE = 10000  // 1%
const CUSD_USDC_FEE = 100 // 0.01%
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
]

const swapRouterAbi = [
  {
    type: 'function' as const,
    name: 'exactInputSingle',
    inputs: [
      {
        type: 'tuple' as const,
        components: [
          { type: 'address' as const, name: 'tokenIn' },
          { type: 'address' as const, name: 'tokenOut' },
          { type: 'uint24' as const, name: 'fee' },
          { type: 'address' as const, name: 'recipient' },
          { type: 'uint256' as const, name: 'amountIn' },
          { type: 'uint256' as const, name: 'amountOutMinimum' },
          { type: 'uint160' as const, name: 'sqrtPriceLimitX96' },
        ],
        name: 'params',
      },
    ],
    outputs: [{ type: 'uint256' as const, name: 'amountOut' }],
    stateMutability: 'nonpayable' as const,
  },
]

const exactInputAbi = [
  {
    type: 'function' as const,
    name: 'exactInput',
    inputs: [
      {
        type: 'tuple' as const,
        components: [
          { type: 'bytes' as const, name: 'path' },
          { type: 'address' as const, name: 'recipient' },
          { type: 'uint256' as const, name: 'deadline' },
          { type: 'uint256' as const, name: 'amountIn' },
          { type: 'uint256' as const, name: 'amountOutMinimum' },
        ],
        name: 'params',
      },
    ],
    outputs: [{ type: 'uint256' as const, name: 'amountOut' }],
    stateMutability: 'nonpayable' as const,
  },
]

const quoterExactInputAbi = [
  {
    type: 'function' as const,
    name: 'quoteExactInput',
    inputs: [
      { type: 'bytes' as const, name: 'path' },
      { type: 'uint256' as const, name: 'amountIn' },
    ],
    outputs: [
      { type: 'uint256' as const, name: 'amountOut' },
      { type: 'uint160' as const, name: 'sqrtPriceX96After' },
      { type: 'uint32' as const, name: 'initializedTicksCrossed' },
      { type: 'uint256' as const, name: 'gasEstimate' },
    ],
    stateMutability: 'view' as const,
  },
]

function encodeMultiHopPath(tokenIn: Address, fee1: number, tokenMid: Address, fee2: number, tokenOut: Address): `0x${string}` {
  return encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [tokenIn, fee1, tokenMid, fee2, tokenOut],
  )
}

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name)

  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    private readonly nonceManager: NonceManager,
  ) {}

  async quoteSwap(tokenIn: Token, amountIn: string): Promise<bigint> {
    const amountInWei = parseUnits(amountIn, tokenIn.decimals)

    const result = await this.client.readContract({
      address: QUOTER_ADDRESS,
      abi: QuoterV2ABI.abi,
      functionName: 'quoteExactInputSingle',
      args: [{
        tokenIn: tokenIn.address,
        tokenOut: tokenIn.equals(G_DOLLAR) ? CUSD.address : G_DOLLAR.address,
        amountIn: amountInWei,
        fee: POOL_FEE,
        sqrtPriceLimitX96: 0n,
      }],
    }) as readonly [bigint, bigint, number, bigint]

    return result[0]
  }

  async executeSwap(
    tokenIn: Token,
    amountIn: string,
    amountOut: bigint,
    slippageBps = 50,
  ): Promise<`0x${string}`> {
    const tokenOut = tokenIn.equals(G_DOLLAR) ? CUSD : G_DOLLAR
    const myAddress = this.walletClient.account!.address as Address
    const amountInWei = parseUnits(amountIn, tokenIn.decimals)
    const minAmountOut = amountOut * BigInt(10000 - slippageBps) / 10000n

    const [approveNonce, swapNonce] = await this.nonceManager.allocate(2)

    const approveHash = await this.walletClient.sendTransaction({
      to: tokenIn.address as Address,
      data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER_ADDRESS as Address, amountInWei] }),
      value: 0n, gas: 100_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: approveNonce, chain: celo, account: this.walletClient.account!,
    })
    await this.client.waitForTransactionReceipt({ hash: approveHash, timeout: 180_000 })
    this.logger.debug(`Approve confirmed: ${approveHash}`)

    return this.walletClient.sendTransaction({
      to: SWAP_ROUTER_ADDRESS as Address,
      data: encodeFunctionData({
        abi: swapRouterAbi, functionName: 'exactInputSingle',
        args: [{
          tokenIn: tokenIn.address as Address,
          tokenOut: tokenOut.address as Address,
          fee: POOL_FEE,
          recipient: myAddress,
          amountIn: amountInWei,
          amountOutMinimum: minAmountOut,
          sqrtPriceLimitX96: 0n,
        }],
      }),
      value: 0n, gas: 300_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: swapNonce, chain: celo, account: this.walletClient.account!,
    })
  }

  async quoteMultiHop(amountInWei: bigint): Promise<bigint> {
    const path = encodeMultiHopPath(
      G_DOLLAR.address as Address, G_CUSD_FEE,
      CUSD.address as Address, CUSD_USDC_FEE,
      USDC.address as Address,
    )
    const result = await this.client.readContract({
      address: QUOTER_ADDRESS,
      abi: quoterExactInputAbi,
      functionName: 'quoteExactInput',
      args: [path, amountInWei],
    }) as [bigint, bigint, number, bigint]
    return result[0]
  }

  async executeMultiHopSwap(
    amountInWei: bigint,
    amountOut: bigint,
    recipient?: Address,
    slippageBps = 100,
  ): Promise<`0x${string}`> {
    const myAddress = this.walletClient.account!.address as Address
    const finalRecipient = recipient ?? myAddress
    const minAmountOut = amountOut * BigInt(10000 - slippageBps) / 10000n
    const path = encodeMultiHopPath(
      G_DOLLAR.address as Address, G_CUSD_FEE,
      CUSD.address as Address, CUSD_USDC_FEE,
      USDC.address as Address,
    )

    const [approveNonce, swapNonce] = await this.nonceManager.allocate(2)

    const approveHash = await this.walletClient.sendTransaction({
      to: G_DOLLAR.address as Address,
      data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [SWAP_ROUTER_ADDRESS as Address, amountInWei] }),
      value: 0n, gas: 100_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: approveNonce, chain: celo, account: this.walletClient.account!,
    })
    await this.client.waitForTransactionReceipt({ hash: approveHash, timeout: 180_000 })
    this.logger.debug(`MultiHop approve confirmed: ${approveHash}`)

    return this.walletClient.sendTransaction({
      to: SWAP_ROUTER_ADDRESS as Address,
      data: encodeFunctionData({
        abi: exactInputAbi, functionName: 'exactInput',
        args: [{
          path, recipient: finalRecipient,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1800),
          amountIn: amountInWei,
          amountOutMinimum: minAmountOut,
        }],
      }),
      value: 0n, gas: 300_000n,
      maxFeePerGas: 250_000_000_000n, maxPriorityFeePerGas: 5_000_000_000n,
      nonce: swapNonce, chain: celo, account: this.walletClient.account!,
    })
  }
}
