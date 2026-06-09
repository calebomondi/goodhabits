import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ViemModule } from './modules/viem.provider';
import { UniswapModule } from './modules/uniswap.module';
import { TreasuryModule } from './treasury/treasury.module';
import { WorkersModule } from './workers/workers.module';
import { DrizzleModule } from './drizzle/drizzle.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AgentModule } from './agent/agent.module';
import { OfframpModule } from './offramp/offramp.module';
import { AdminModule } from './admin/admin.module';
import { InvestmentModule } from './investment/investment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AdminModule,
    InvestmentModule,
    WorkersModule,
    ViemModule,
    UniswapModule,
    TreasuryModule,
    DrizzleModule,
    AnalyticsModule,
    AgentModule,
    OfframpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
