import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

@Injectable()
export class ProducerService implements OnModuleInit {
  constructor(
    @InjectQueue('strategy') private readonly strategyQueue: Queue,
    @InjectQueue('fee-collection') private readonly feeQueue: Queue,
    @InjectQueue('withdrawal') private readonly withdrawalQueue: Queue,
    @InjectQueue('snapshot') private readonly snapshotQueue: Queue,
    @InjectQueue('offramp') private readonly offrampQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.strategyQueue.removeRepeatable('deploy-and-lp', { pattern: '0 */6 * * *' })
    await this.feeQueue.removeRepeatable('collect-fees', { pattern: '0 0 * * *' })
    await this.withdrawalQueue.removeRepeatable('fulfill', { pattern: '*/15 * * * *' })
    await this.offrampQueue.removeRepeatable('fulfill', { pattern: '*/3 * * * *' })

    const snapshotCron = this.config.get<string>('SNAPSHOT_CRON') ?? '0 * * * *'

    await Promise.all([
      this.strategyQueue.add('deploy-and-lp', {}, {
        repeat: { pattern: '0 * * * *' },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }),
      this.feeQueue.add('collect-fees', {}, {
        repeat: { pattern: '0 0 * * *' },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }),
      this.withdrawalQueue.add('fulfill', {}, {
        repeat: { pattern: '*/5 * * * *' },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }),
      this.snapshotQueue.add('take-snapshot', {}, {
        repeat: { pattern: snapshotCron },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }),
      this.offrampQueue.add('fulfill', {}, {
        repeat: { pattern: '*/3 * * * *' },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      }),
    ])
  }
}
