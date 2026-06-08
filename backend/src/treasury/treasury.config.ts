import { Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export const TREASURY_CONTRACT = 'TREASURY_CONTRACT'

export const treasuryContractProvider: Provider = {
  provide: TREASURY_CONTRACT,
  useFactory: (config: ConfigService) =>
    config.get<string>('TREASURY_CONTRACT') as `0x${string}`,
  inject: [ConfigService],
}
