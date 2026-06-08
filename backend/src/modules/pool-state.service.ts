import { Inject, Injectable } from '@nestjs/common';
import { Pool, computePoolAddress } from '@uniswap/v3-sdk';
import { type Token } from '@uniswap/sdk-core';
import { type PublicClient, type Address } from 'viem';
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import {
  G_DOLLAR,
  CUSD,
  POOL_ADDRESS,
  POOL_FEE,
  POOL_FACTORY_ADDRESS,
} from './config';
import { PUBLIC_CLIENT } from './viem.provider';

@Injectable()
export class PoolStateService {
  constructor(@Inject(PUBLIC_CLIENT) private readonly client: PublicClient) {}

  async fetchPoolState(): Promise<Pool> {
    const abi = IUniswapV3PoolABI.abi;

    const [slot0, liquidity] = await Promise.all([
      this.client.readContract({
        address: POOL_ADDRESS,
        abi,
        functionName: 'slot0',
      }) as Promise<
        readonly [bigint, number, number, number, number, number, boolean]
      >,
      this.client.readContract({
        address: POOL_ADDRESS,
        abi,
        functionName: 'liquidity',
      }) as Promise<bigint>,
    ]);

    return new Pool(
      G_DOLLAR,
      CUSD,
      POOL_FEE,
      String(slot0[0]),
      String(liquidity),
      Number(slot0[1]),
    );
  }

  async fetchPoolForTokens(
    tokenA: Token,
    tokenB: Token,
    fee: number,
  ): Promise<Pool> {
    const poolAddress = computePoolAddress({
      factoryAddress: POOL_FACTORY_ADDRESS,
      tokenA,
      tokenB,
      fee,
    });
    const abi = IUniswapV3PoolABI.abi;

    const [slot0, liquidity] = await Promise.all([
      this.client.readContract({
        address: poolAddress as Address,
        abi,
        functionName: 'slot0',
      }) as Promise<
        readonly [bigint, number, number, number, number, number, boolean]
      >,
      this.client.readContract({
        address: poolAddress as Address,
        abi,
        functionName: 'liquidity',
      }) as Promise<bigint>,
    ]);

    return new Pool(
      tokenA,
      tokenB,
      fee,
      String(slot0[0]),
      String(liquidity),
      Number(slot0[1]),
    );
  }
}
