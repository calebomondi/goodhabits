import { Module } from '@nestjs/common'
import { AnalyticsModule } from '../analytics/analytics.module'
import { TreasuryModule } from '../treasury/treasury.module'
import { AgentController } from './agent.controller'
import { AgentService } from './agent.service'
import { ToolsExecutor } from './tools.executor'

@Module({
  imports: [AnalyticsModule, TreasuryModule],
  controllers: [AgentController],
  providers: [AgentService, ToolsExecutor],
})
export class AgentModule {}
