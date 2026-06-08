import { Injectable } from '@nestjs/common'

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  NGN: 1540,
  KES: 130,
  ZAR: 18.5,
  GHS: 12.5,
  EUR: 0.92,
  GBP: 0.79,
  XAF: 600,
  XOF: 600,
  UGX: 3700,
  TZS: 2500,
  RWF: 1300,
  MXN: 18,
  BRL: 5.5,
  INR: 83,
  PHP: 57,
  IDR: 16000,
}

const API_CURRENCIES = ['USD', 'EUR', 'GBP', 'MXN', 'BRL', 'INR', 'PHP', 'IDR', 'ZAR']

@Injectable()
export class FiatRatesService {
  private cache: { rates: Record<string, number>; ts: number } | null = null
  private readonly TTL = 120_000

  async getRate(currency: string): Promise<number | null> {
    const fallback = FALLBACK_RATES[currency]
    if (!fallback) return null

    const now = Date.now()
    if (this.cache && now - this.cache.ts < this.TTL) {
      return this.cache.rates[currency] ?? fallback
    }

    try {
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=USD&to=${API_CURRENCIES.join(',')}`
      )
      const json: { rates: Record<string, number> } = await res.json()
      this.cache = { rates: { ...FALLBACK_RATES, ...json.rates }, ts: now }
      return this.cache.rates[currency] ?? fallback
    } catch {
      return fallback
    }
  }
}
