import { Inject, Injectable } from '@nestjs/common'
import { Pool } from '@uniswap/v3-sdk'
import { type PublicClient } from 'viem'
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import { G_DOLLAR, CUSD, POOL_ADDRESS, POOL_FEE } from './config'
import { PUBLIC_CLIENT } from './viem.provider'

@Injectable()
export class PoolStateService {
  constructor(
    @Inject(PUBLIC_CLIENT) private readonly client: PublicClient,
  ) {}

  async fetchPoolState(): Promise<Pool> {
    const abi = IUniswapV3PoolABI.abi

    const [slot0, liquidity] = await Promise.all([
      this.client.readContract({ address: POOL_ADDRESS, abi, functionName: 'slot0' }) as Promise<readonly [bigint, number, number, number, number, number, boolean]>,
      this.client.readContract({ address: POOL_ADDRESS, abi, functionName: 'liquidity' }) as Promise<bigint>,
    ])

    return new Pool(
      G_DOLLAR,
      CUSD,
      POOL_FEE,
      String(slot0[0]),
      String(liquidity),
      Number(slot0[1]),
    )
  }
}
