import { Module } from '@nestjs/common'
import { PriceModule } from '../price/price.module'
import { UniswapModule } from '../modules/uniswap.module'
import { OfframpController } from './offramp.controller'
import { OfframpService } from './offramp.service'
import { FiatRatesService } from './fiat-rates.service'

@Module({
  imports: [PriceModule, UniswapModule],
  controllers: [OfframpController],
  providers: [OfframpService, FiatRatesService],
  exports: [OfframpService],
})
export class OfframpModule {}
