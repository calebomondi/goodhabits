import { Inject, Injectable } from '@nestjs/common'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, desc } from 'drizzle-orm'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { investmentRequests } from '../drizzle/schema/investment-requests'

// PLACEHOLDER: Investment withdrawal request queue
// In the future this will trigger on-chain requestWithdrawal()
// For now it simply stores user requests in the DB.

@Injectable()
export class InvestmentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async createRequest(data: {
    userAddress: string
    amountG: string
  }) {
    const [row] = await this.db
      .insert(investmentRequests)
      .values({
        userAddress: data.userAddress,
        amountG: data.amountG,
        status: 'pending',
      })
      .returning()

    return { id: row.id, status: row.status }
  }

  async getRequests(address?: string) {
    const cond = address ? eq(investmentRequests.userAddress, address) : undefined
    const rows = await this.db
      .select()
      .from(investmentRequests)
      .where(cond)
      .orderBy(desc(investmentRequests.createdAt))
      .limit(20)

    return rows.map(r => ({
      id: r.id,
      userAddress: r.userAddress,
      amountG: r.amountG,
      status: r.status,
      txHash: r.txHash,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  }
}
