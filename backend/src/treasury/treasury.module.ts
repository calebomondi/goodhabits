import { Module } from '@nestjs/common'
import { treasuryContractProvider } from './treasury.config'
import { TreasuryService } from './treasury.service'
import { TreasuryController } from './treasury.controller'

@Module({
  controllers: [TreasuryController],
  providers: [TreasuryService, treasuryContractProvider],
  exports: [TreasuryService],
})
export class TreasuryModule {}
