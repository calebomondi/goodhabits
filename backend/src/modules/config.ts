import { Token, ChainId } from '@uniswap/sdk-core'
import { FeeAmount, TICK_SPACINGS } from '@uniswap/v3-sdk'

const CELO_CHAIN_ID = 42220

export const G_DOLLAR = new Token(
  CELO_CHAIN_ID,
  '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
  18,
  'G$',
  'GoodDollar'
)

export const CUSD = new Token(
  CELO_CHAIN_ID,
  '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  18,
  'cUSD',
  'Celo Dollar'
)

export const USDC = new Token(
  CELO_CHAIN_ID,
  '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  6,
  'USDC',
  'USD Coin'
)

export const POOL_ADDRESS       = '0x9491d57c5687AB75726423B55AC2d87D1cDa2c3F'
export const POOL_FEE           = 10000
export const POOL_TICK_SPACING  = TICK_SPACINGS[FeeAmount.HIGH] // 200

export const SWAP_ROUTER_ADDRESS = '0x5615CDAb10dc425a742d643d949a7F474C01abc4'
export const NFPM_ADDRESS        = '0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A'