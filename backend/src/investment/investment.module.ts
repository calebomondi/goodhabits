import { Module } from '@nestjs/common'
import { InvestmentController } from './investment.controller'
import { InvestmentService } from './investment.service'

// PLACEHOLDER: Investment withdrawal module
// In the future this will import Uniswap/Treasury modules and
// process withdrawal requests by calling requestWithdrawal() on-chain.

@Module({
  controllers: [InvestmentController],
  providers: [InvestmentService],
  exports: [InvestmentService],
})
export class InvestmentModule {}
