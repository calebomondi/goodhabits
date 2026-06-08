import { Injectable } from '@nestjs/common'

@Injectable()
export class PriceService {
  private cached: { usd: number; ts: number } | null = null
  private readonly TTL = 60_000
  private readonly G$ = '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A'

  async getG$PriceUsd(): Promise<number | null> {
    if (this.cached && Date.now() - this.cached.ts < this.TTL) {
      return this.cached.usd
    }

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${this.G$}`)
      const json: { pairs?: { chainId: string; priceUsd: string }[] } = await res.json()
      const celoPairs = (json.pairs ?? []).filter((p) => p.chainId === 'celo')
      const prices = celoPairs
        .map((p) => Number.parseFloat(p.priceUsd))
        .filter((v) => !Number.isNaN(v) && v > 0)

      if (prices.length === 0) return this.cached?.usd ?? null

      const avg = prices.reduce((a, b) => a + b, 0) / prices.length
      this.cached = { usd: avg, ts: Date.now() }
      return avg
    } catch {
      return this.cached?.usd ?? null
    }
  }
}
