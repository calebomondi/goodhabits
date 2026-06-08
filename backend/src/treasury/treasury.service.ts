import { Inject, Injectable } from '@nestjs/common';
import {
  type Address,
  type PublicClient,
  type WalletClient,
  encodeFunctionData,
} from 'viem';
import { celo } from 'viem/chains';
import { PUBLIC_CLIENT, WALLET_CLIENT } from '../modules/viem.provider';
import {
  MAX_FEE_PER_GAS,
  MAX_PRIORITY_FEE_PER_GAS,
  TREASURY_GAS,
} from '../modules/config';
import { TREASURY_CONTRACT } from './treasury.config';
import { TREASURY_ABI } from './treasury.abi';

@Injectable()
export class TreasuryService {
  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
    @Inject(WALLET_CLIENT) private readonly walletClient: WalletClient,
    @Inject(TREASURY_CONTRACT) private readonly contractAddress: `0x${string}`,
  ) {}

  // ── Writes (STRATEGY_ROLE) ──

  async deployToStrategy(strategy: Address, amount: bigint, nonce?: number) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'deployToStrategy',
        args: [strategy, amount],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async receiveFromStrategy(amount: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'receiveFromStrategy',
        args: [amount],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async registerPosition(
    tokenId: bigint,
    initialValue: bigint,
    nonce?: number,
  ) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'registerPosition',
        args: [tokenId, initialValue],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      nonce,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async closePosition(tokenId: bigint, returnedAssets: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'closePosition',
        args: [tokenId, returnedAssets],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async updatePositionValue(tokenId: bigint, value: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'updatePositionValue',
        args: [tokenId, value],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async markWithdrawalReady(requestId: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'markWithdrawalReady',
        args: [requestId],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async finalizeWithdrawal(requestId: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'finalizeWithdrawal',
        args: [requestId],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async collectFees() {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'collectFees',
        args: [],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  // ── Writes (DEFAULT_ADMIN_ROLE) ──

  async claimFees(recipient: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'claimFees',
        args: [recipient],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async approveStrategy(strategy: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'approveStrategy',
        args: [strategy],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  async removeStrategy(strategy: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({
        abi: TREASURY_ABI,
        functionName: 'removeStrategy',
        args: [strategy],
      }),
      value: 0n,
      gas: TREASURY_GAS,
      maxFeePerGas: MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
      account: this.walletClient.account!,
      chain: celo,
    });
  }

  // ── Reads ──

  async calculateTotalAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'calculateTotalAssets',
    });
  }

  async pricePerShare(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'pricePerShare',
    });
  }

  async getPosition(tokenId: bigint) {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getPosition',
      args: [tokenId],
    });
  }

  async getUserPosition(user: Address) {
    try {
      const position = await this.client.readContract({
        address: this.contractAddress,
        abi: TREASURY_ABI,
        functionName: 'getUserPosition',
        args: [user],
      });
      return position;
    } catch (error) {
      console.error('Error fetching user position:', error);
      throw error;
    }
  }

  async getUserAllocation(user: Address) {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getUserAllocation',
      args: [user],
    });
  }

  async getActivePositionIds(): Promise<bigint[]> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getActivePositionIds',
    }) as Promise<bigint[]>;
  }

  async assetsToInvest(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'assetsToInvest',
    });
  }

  async deployedAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'deployedAssets',
    });
  }

  async reservedAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'reservedAssets',
    });
  }

  async totalShares(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'totalShares',
    });
  }

  async accruedFees(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'accruedFees',
    });
  }

  async feeBps(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'feeBps',
    });
  }

  async getWithdrawalRequestsForUser(user: Address) {
    const [nextId, count] = await Promise.all([
      this.client.readContract({
        address: this.contractAddress,
        abi: TREASURY_ABI,
        functionName: 'nextWithdrawalId',
      }),
      this.client.readContract({
        address: this.contractAddress,
        abi: TREASURY_ABI,
        functionName: 'activeRequestCount',
        args: [user],
      }),
    ]);

    if (count === 0n) return [];

    const requests: Array<{
      id: string;
      sharesLocked: string;
      assetsQuoted: string;
      user: string;
      createdAt: number;
      status: number;
    }> = [];

    for (let id = 0n; id < nextId; id++) {
      const req = await this.client.readContract({
        address: this.contractAddress,
        abi: TREASURY_ABI,
        functionName: 'getWithdrawalRequest',
        args: [id],
      });

      const r = req as {
        id: bigint;
        sharesLocked: bigint;
        assetsQuoted: bigint;
        user: `0x${string}`;
        createdAt: number;
        status: number;
      };

      if (r.user.toLowerCase() === user.toLowerCase()) {
        requests.push({
          id: r.id.toString(),
          sharesLocked: r.sharesLocked.toString(),
          assetsQuoted: r.assetsQuoted.toString(),
          user: r.user,
          createdAt: r.createdAt,
          status: r.status,
        });

        if (requests.length >= Number(count)) break;
      }
    }

    return requests;
  }
}
