import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { SnapshotService } from './snapshot.service'

@Processor('snapshot')
export class SnapshotWorker extends WorkerHost {
  constructor(private readonly snapshotService: SnapshotService) {
    super()
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'take-snapshot':
        await this.snapshotService.takeSnapshot()
        break
      default:
        job.discard()
    }
  }
}
