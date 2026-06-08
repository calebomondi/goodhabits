import { Module } from '@nestjs/common'
import { PoolStateService } from './pool-state.service'
import { SwapService } from './swap.service'
import { PositionService } from './position.service'
import { PositionRegistryService } from './position-registry.service'

@Module({
  providers: [PoolStateService, SwapService, PositionService, PositionRegistryService],
  exports: [PoolStateService, SwapService, PositionService, PositionRegistryService],
})
export class UniswapModule {}
