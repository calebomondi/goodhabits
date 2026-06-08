import { Controller, Post, HttpCode, HttpStatus, Inject } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'

@Controller('admin')
export class AdminController {
  constructor(
    @InjectQueue('strategy') private readonly strategyQueue: Queue,
  ) {}

  @Post('strategy/trigger')
  @HttpCode(HttpStatus.OK)
  async triggerStrategyDeploy() {
    const job = await this.strategyQueue.add('deploy-and-lp', {}, {
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    })
    return { jobId: job.id, status: 'queued' }
  }
}
