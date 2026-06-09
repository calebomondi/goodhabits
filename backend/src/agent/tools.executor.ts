import { Injectable } from '@nestjs/common'
import { AnalyticsService } from '../analytics/analytics.service'
import { TreasuryService } from '../treasury/treasury.service'
import { LeaderboardService } from '../analytics/leaderboard.service'

export type ToolCall = {
  id: string
  function: {
    name: string
    arguments: string
  }
}

const fmt = (v: string | bigint, decimals = 18) => {
  const n = Number(typeof v === 'string' ? v : v.toString()) / 10 ** decimals
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

@Injectable()
export class ToolsExecutor {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly treasuryService: TreasuryService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async execute(toolCall: ToolCall): Promise<{ name: string; result: unknown }> {
    const { name, arguments: argsStr } = toolCall.function
    const args = JSON.parse(argsStr)

    switch (name) {
      case 'get_user_position': {
        try {
          const pos = await this.treasuryService.getUserPosition(args.address as `0x${string}`)
          return {
            name,
            result: {
              // raw wei values
              unlockedShares: pos.unlockedShares.toString(),
              lockedShares: pos.lockedShares.toString(),
              ownershipBps: pos.ownershipBps.toString(),
              unlockedValue: pos.unlockedValue.toString(),
              totalValue: pos.totalValue.toString(),
              deposited: pos.deposited.toString(),
              withdrawn: pos.withdrawn.toString(),
              pnl: pos.pnl.toString(),
              // pre-formatted G$ values for LLM readability
              depositedG$: fmt(pos.deposited),
              withdrawnG$: fmt(pos.withdrawn),
              totalValueG$: fmt(pos.totalValue),
              unlockedValueG$: fmt(pos.unlockedValue),
              pnlG$: fmt(pos.pnl),
              unlockedSharesNum: fmt(pos.unlockedShares),
              lockedSharesNum: fmt(pos.lockedShares),
            },
          }
        } catch {
          return { name, result: { error: `Invalid address: ${args.address}` } }
        }
      }

      case 'get_user_allocation': {
        try {
          const alloc = await this.treasuryService.getUserAllocation(args.address as `0x${string}`)
          return {
            name,
            result: {
              spendAmount: alloc.spendAmount.toString(),
              saveAmount: alloc.saveAmount.toString(),
              investAmount: alloc.investAmount.toString(),
              spendG$: fmt(alloc.spendAmount),
              saveG$: fmt(alloc.saveAmount),
              investG$: fmt(alloc.investAmount),
            },
          }
        } catch {
          return { name, result: { error: `Invalid address: ${args.address}` } }
        }
      }

      case 'get_user_habits': {
        try {
          const habit = await this.treasuryService.getUserHabit(args.address as `0x${string}`)
          return {
            name,
            result: {
              toSpend: (habit as { toSpend: bigint }).toSpend.toString(),
              toSave: (habit as { toSave: bigint }).toSave.toString(),
              toInvest: (habit as { toInvest: bigint }).toInvest.toString(),
              spendPct: Number((habit as { toSpend: bigint }).toSpend),
              savePct: Number((habit as { toSave: bigint }).toSave),
              investPct: Number((habit as { toInvest: bigint }).toInvest),
            },
          }
        } catch {
          return { name, result: { error: `Invalid address: ${args.address}` } }
        }
      }

      case 'get_g$_balance': {
        try {
          const balance = await this.treasuryService.getG$Balance(args.address as `0x${string}`)
          return {
            name,
            result: {
              balanceWei: balance.toString(),
              balanceG$: fmt(balance),
            },
          }
        } catch {
          return { name, result: { error: `Invalid address: ${args.address}` } }
        }
      }

      case 'get_treasury_summary': {
        const summary = await this.analyticsService.getSummary()
        return { name, result: summary }
      }

      case 'get_leaderboard': {
        const entries = await this.leaderboardService.getLeaderboard()
        const userEntry = entries.find(
          (e) => e.address.toLowerCase() === args.address.toLowerCase(),
        )
        return {
          name,
          result: {
            top10: entries.slice(0, 10),
            userRank: userEntry ?? null,
            totalParticipants: entries.length,
          },
        }
      }

      case 'get_claim_info': {
        // Claim info is handled client-side via claimSDK; return stub until a backend service exists
        return {
          name,
          result: {
            note: "Claim information is available in the sidebar. Connect your wallet and check the Claim UBI section.",
            address: args.address,
          },
        }
      }

      case 'simulate_withdrawal_impact': {
        const { currentStreak, currentPoints, withdrawAmount, totalSaved } = args
        const newTotalSaved = Math.max(0, totalSaved - withdrawAmount)

        let newPoints = currentPoints - Math.min(withdrawAmount, 10000)
        if (newPoints < 0) newPoints = 0

        const getTier = (p: number) => {
          if (p >= 10000) return 'diamond'
          if (p >= 5000) return 'platinum'
          if (p >= 2000) return 'gold'
          if (p >= 500) return 'silver'
          return 'bronze'
        }

        const currentTier = getTier(currentPoints)
        const newTier = getTier(newPoints)

        return {
          name,
          result: {
            currentTier,
            newTier,
            currentPoints,
            newPoints,
            pointsLost: currentPoints - newPoints,
            tierChanged: currentTier !== newTier,
            streakImpact: "Withdrawing from savings will reset your streak to 0. Streak bonus points will be lost.",
          },
        }
      }

      default:
        return { name, result: { error: `Unknown tool: ${name}` } }
    }
  }
}
