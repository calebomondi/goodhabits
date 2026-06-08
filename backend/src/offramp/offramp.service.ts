import { Inject, Injectable } from '@nestjs/common'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { eq, desc } from 'drizzle-orm'
import { DRIZZLE } from '../drizzle/drizzle.module'
import { offrampRequests } from '../drizzle/schema/offramp-requests'
import { PriceService } from '../price/price.service'
import { FiatRatesService } from './fiat-rates.service'

export type OfframpRate = {
  rate: number
  fiatRate: number | null
  displayRate: number
  source: string
  updatedAt: string
}

@Injectable()
export class OfframpService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly priceService: PriceService,
    private readonly fiatRates: FiatRatesService,
  ) {}

  async getRate(currency = 'USD'): Promise<OfframpRate> {
    const usd = await this.priceService.getG$PriceUsd()
    const rate = usd ?? 0.72
    const fiatRate = await this.fiatRates.getRate(currency)
    return {
      rate,
      fiatRate,
      displayRate: fiatRate != null ? rate * fiatRate : rate,
      source: usd ? 'dexscreener' : 'fallback',
      updatedAt: new Date().toISOString(),
    }
  }

  async createRequest(data: {
    userAddress: string
    amountG: string
    amountFiat: string
    rateUsed: string
    targetCurrency: string
    usdcRecipient?: string
    beneficiary?: string
    txHash?: string
  }) {
    const [row] = await this.db
      .insert(offrampRequests)
      .values({
        userAddress: data.userAddress,
        amountG: data.amountG,
        amountFiat: data.amountFiat,
        rateUsed: data.rateUsed,
        targetCurrency: data.targetCurrency,
        usdcRecipient: data.usdcRecipient ?? null,
        beneficiary: data.beneficiary ?? null,
        txHash: data.txHash ?? null,
        status: 'pending',
      })
      .returning()

    return { id: row.id, status: row.status }
  }

  async getRequests(address?: string) {
    const cond = address ? eq(offrampRequests.userAddress, address) : undefined
    const rows = await this.db
      .select()
      .from(offrampRequests)
      .where(cond)
      .orderBy(desc(offrampRequests.createdAt))
      .limit(20)
    return rows.map(r => ({
      id: r.id,
      userAddress: r.userAddress,
      amountG: r.amountG,
      amountFiat: r.amountFiat,
      rateUsed: r.rateUsed,
      targetCurrency: r.targetCurrency,
      usdcRecipient: r.usdcRecipient,
      beneficiary: r.beneficiary,
      status: r.status,
      txHash: r.txHash,
      swapTxHash: r.swapTxHash,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      explorerLink: r.swapTxHash
        ? `https://celoscan.io/tx/${r.swapTxHash}`
        : null,
    }))
  }
}
