import { Queue } from 'bullmq'

const queue = new Queue('strategy', { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } })
await queue.add('deploy-and-lp', {})
console.log('deploy-and-lp job dispatched to strategy queue')
await queue.close()
