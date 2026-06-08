import { Inject, Injectable } from '@nestjs/common'
import { type Address, type PublicClient, type WalletClient, encodeFunctionData } from 'viem'
import { celo } from 'viem/chains'
import { PUBLIC_CLIENT, WALLET_CLIENT } from '../modules/viem.provider'
import { TREASURY_CONTRACT } from './treasury.config'
import { TREASURY_ABI } from './treasury.abi'

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
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'deployToStrategy', args: [strategy, amount] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      nonce,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async receiveFromStrategy(amount: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'receiveFromStrategy', args: [amount] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async registerPosition(tokenId: bigint, initialValue: bigint, nonce?: number) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'registerPosition', args: [tokenId, initialValue] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      nonce,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async closePosition(tokenId: bigint, returnedAssets: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'closePosition', args: [tokenId, returnedAssets] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async updatePositionValue(tokenId: bigint, value: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'updatePositionValue', args: [tokenId, value] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async markWithdrawalReady(requestId: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'markWithdrawalReady', args: [requestId] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async finalizeWithdrawal(requestId: bigint) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'finalizeWithdrawal', args: [requestId] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async collectFees() {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'collectFees', args: [] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  // ── Writes (DEFAULT_ADMIN_ROLE) ──

  async claimFees(recipient: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'claimFees', args: [recipient] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async approveStrategy(strategy: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'approveStrategy', args: [strategy] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  async removeStrategy(strategy: Address) {
    return this.walletClient.sendTransaction({
      to: this.contractAddress,
      data: encodeFunctionData({ abi: TREASURY_ABI, functionName: 'removeStrategy', args: [strategy] }),
      value: 0n,
      gas: 100_000n,
      maxFeePerGas: 250_000_000_000n,
      maxPriorityFeePerGas: 5_000_000_000n,
      account: this.walletClient.account!,
      chain: celo,
    })
  }

  // ── Reads ──

  async calculateTotalAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'calculateTotalAssets',
    }) as Promise<bigint>
  }

  async pricePerShare(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'pricePerShare',
    }) as Promise<bigint>
  }

  async getPosition(tokenId: bigint) {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getPosition',
      args: [tokenId],
    })
  }

  async getUserPosition(user: Address) {
    try {
      const position = await this.client.readContract({
        address: this.contractAddress,
        abi: TREASURY_ABI,
        functionName: 'getUserPosition',
        args: [user],
      })
      return position
    } catch (error) {
      console.error("Error fetching user position:", error)
      throw error
    }
  }

  async getUserAllocation(user: Address) {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getUserAllocation',
      args: [user],
    })
  }

  async getActivePositionIds(): Promise<bigint[]> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'getActivePositionIds',
    }) as Promise<bigint[]>
  }

  async assetsToInvest(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'assetsToInvest',
    }) as Promise<bigint>
  }

  async deployedAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'deployedAssets',
    }) as Promise<bigint>
  }

  async reservedAssets(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'reservedAssets',
    }) as Promise<bigint>
  }

  async totalShares(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'totalShares',
    }) as Promise<bigint>
  }

  async accruedFees(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'accruedFees',
    }) as Promise<bigint>
  }

  async feeBps(): Promise<bigint> {
    return this.client.readContract({
      address: this.contractAddress,
      abi: TREASURY_ABI,
      functionName: 'feeBps',
    }) as Promise<bigint>
  }
}
