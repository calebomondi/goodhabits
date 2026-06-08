"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Crown, Medal, TrendingUp, Flame, RotateCcw, LoaderCircle, Clock } from "lucide-react"

type LeaderboardEntry = {
  rank: number
  address: string
  points: number
  tier: "bronze" | "silver" | "gold" | "platinum" | "diamond"
  currentStreak: number
  longestStreak: number
  totalSaved: string
  consistency: number
  pointsFrozenUntil: string | null
}

type LeaderboardResponse = {
  data: LeaderboardEntry[]
}

const TIERS = [
  { key: "bronze", label: "Bronze", minPts: 0, className: "bg-zinc-500/10 text-zinc-600 border-zinc-300" },
  { key: "silver", label: "Silver", minPts: 500, className: "bg-slate-500/10 text-slate-600 border-slate-300" },
  { key: "gold", label: "Gold", minPts: 2_000, className: "bg-amber-500/10 text-amber-700 border-amber-300" },
  { key: "platinum", label: "Platinum", minPts: 5_000, className: "bg-cyan-500/10 text-cyan-700 border-cyan-300" },
  { key: "diamond", label: "Diamond", minPts: 10_000, className: "bg-purple-500/10 text-purple-700 border-purple-300" },
] as const

const tierConfig: Record<string, { label: string; className: string }> = {}
for (const t of TIERS) tierConfig[t.key] = { label: t.label, className: t.className }

function formatG$(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value
  const scaled = n / 1e18
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(1)}M`
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(1)}K`
  return scaled.toFixed(1)
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function streakMultiplier(streak: number) {
  if (streak >= 31) return 30
  if (streak >= 8) return 20
  return 10
}

function streakFlameClass(streak: number) {
  if (streak >= 30) return "text-purple-500 drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]"
  if (streak >= 14) return "text-red-500"
  if (streak >= 7) return "text-orange-500"
  return "text-orange-400"
}

function streakLabel(streak: number) {
  if (streak >= 30) return "Legend"
  if (streak >= 14) return "Blazing"
  if (streak >= 7) return "On fire"
  return null
}

type TierInfo = { key: string; label: string; minPts: number; className: string }

function tierProgress(points: number): { currentTier: TierInfo; nextTier: TierInfo; progress: number } {
  let current: TierInfo = TIERS[0]
  let next: TierInfo = TIERS[1]
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].minPts) {
      current = TIERS[i] as TierInfo
      next = (TIERS[i + 1] ?? TIERS[i]) as TierInfo
      break
    }
  }
  const range = next.minPts - current.minPts
  const progress = range > 0 ? Math.min((points - current.minPts) / range, 1) : 1
  return { currentTier: current, nextTier: next, progress }
}

function computeBreakdown(streak: number, totalSaved: string, consistency: number) {
  const mult = streakMultiplier(streak)
  const streakPts = streak * mult
  const savedG$ = Math.min(Number(totalSaved) / 1e18, 10000)
  const amountPts = savedG$
  const consistencyPts = consistency * 50
  return { streakPts, amountPts, consistencyPts, total: Math.round(streakPts + amountPts + consistencyPts) }
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center gap-1 min-w-[2rem]">
      <Crown className="size-4 text-amber-500 fill-amber-500" />
      <span className="text-xs font-bold tabular-nums text-amber-600">1</span>
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center gap-1 min-w-[2rem]">
      <Medal className="size-4 text-slate-400 fill-slate-400" />
      <span className="text-xs font-bold tabular-nums text-slate-500">2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center gap-1 min-w-[2rem]">
      <Medal className="size-4 text-amber-700 fill-amber-700" />
      <span className="text-xs font-bold tabular-nums text-amber-800">3</span>
    </div>
  )
  return <span className="min-w-[2rem] text-center text-sm tabular-nums text-muted-foreground">{rank}</span>
}

function PointsCell({ entry }: { entry: LeaderboardEntry }) {
  const breakdown = computeBreakdown(entry.currentStreak, entry.totalSaved, entry.consistency)
  return (
    <div className="relative group text-right shrink-0">
      <div className="font-semibold tabular-nums cursor-help">{entry.points.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground">pts</div>
      <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block">
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-xs min-w-[180px] space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Streak</span>
            <span className="tabular-nums font-medium">{breakdown.streakPts.toLocaleString()} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Amount</span>
            <span className="tabular-nums font-medium">{breakdown.amountPts.toFixed(1)} pts</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Consistency</span>
            <span className="tabular-nums font-medium">{breakdown.consistencyPts.toLocaleString()} pts</span>
          </div>
          <div className="border-t pt-1 mt-1 flex justify-between gap-4 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{breakdown.total.toLocaleString()} pts</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Leaderboard() {
  const { address, isConnected } = useAccount()
  const [progressHover, setProgressHover] = useState(false)

  const { data, isPending, isError } = useQuery<LeaderboardResponse>({
    queryKey: ["analytics", "leaderboard"],
    queryFn: () => fetch("/api/analytics/leaderboard").then((r) => r.json()),
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (isError) toast.error("Failed to load leaderboard")
  }, [isError])

  const entries = data?.data ?? []
  const userEntry = entries.find((e) => e.address.toLowerCase() === address?.toLowerCase())
  const userIsFrozen = userEntry?.pointsFrozenUntil
    ? new Date(userEntry.pointsFrozenUntil) > new Date()
    : false
  const freezeEndDate = userIsFrozen && userEntry?.pointsFrozenUntil
    ? new Date(userEntry.pointsFrozenUntil)
    : null
  const remainingDays = freezeEndDate
    ? Math.ceil((freezeEndDate.getTime() - Date.now()) / 86400000)
    : 0

  const userProgress = userEntry ? tierProgress(userEntry.points) : null

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            Savings Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPending ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <LoaderCircle className="size-8 animate-spin" />
              <p className="text-sm font-medium">Loading leaderboard...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Flame className="size-8" />
              <p className="text-sm font-medium">No savers yet</p>
              <p className="text-xs">Set your habit strategy and start saving to claim the top spot!</p>
            </div>
          ) : (
            <div className="divide-y">
              {entries.map((entry) => {
                const isUser = entry.address.toLowerCase() === address?.toLowerCase()
                const tier = tierConfig[entry.tier]
                const isFrozen = entry.pointsFrozenUntil
                  ? new Date(entry.pointsFrozenUntil) > new Date()
                  : false
                const sLabel = streakLabel(entry.currentStreak)
                return (
                  <div
                    key={entry.address}
                    className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isUser ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/50"
                    }`}
                  >
                    <RankIcon rank={entry.rank} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-medium truncate ${isUser ? "text-primary" : ""}`}>
                          {truncateAddress(entry.address)}
                        </span>
                        <Badge variant="outline" className={`h-5 text-[10px] px-1.5 leading-none ${tier.className}`}>
                          {tier.label}
                        </Badge>
                        {isFrozen && (
                          <Badge variant="outline" className="h-5 text-[10px] px-1.5 leading-none bg-rose-500/10 text-rose-700 border-rose-300">
                            Frozen
                          </Badge>
                        )}
                        {sLabel && (
                          <span className="text-[10px] font-medium text-muted-foreground">{sLabel}</span>
                        )}
                        {isUser && (
                          <span className="text-[10px] text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                        <span>Saved {formatG$(entry.totalSaved)} G$</span>
                        <span className={`flex items-center gap-0.5 ${streakFlameClass(entry.currentStreak)}`}>
                          <Flame className="size-3" /> {entry.currentStreak}d
                        </span>
                        <span>{(entry.consistency * 100).toFixed(0)}% consistent</span>
                      </div>
                    </div>
                    <PointsCell entry={entry} />
                  </div>
                )
              })}
            </div>
          )}

          {userEntry && userProgress && userProgress.nextTier.minPts > userProgress.currentTier.minPts && (
            <div
              className="border-t px-4 py-3 cursor-default"
              onMouseEnter={() => setProgressHover(true)}
              onMouseLeave={() => setProgressHover(false)}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-3" />
                  {userProgress.currentTier.label} → {userProgress.nextTier.label}
                </span>
                <span className="tabular-nums">
                  {userEntry.points.toLocaleString()} / {userProgress.nextTier.minPts.toLocaleString()} pts
                </span>
              </div>
              <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(userProgress.progress * 100).toFixed(1)}%` }}
                />
              </div>
              {progressHover && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {userProgress.nextTier.minPts - userEntry.points} pts to {userProgress.nextTier.label}
                </p>
              )}
            </div>
          )}

          {userIsFrozen && (
            <div className="border-t border-dashed px-4 py-3 bg-rose-50/50">
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <Clock className="size-3" />
                Points frozen for {remainingDays}d — make a deposit after to resume earning
              </p>
            </div>
          )}

          {isConnected && !userEntry && entries.length > 0 && (
            <div className="border-t border-dashed px-4 py-3 flex items-center justify-between text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <RotateCcw className="size-3.5" />
                Your rank
              </span>
              <span className="font-mono text-xs">{truncateAddress(address!)}</span>
              <span className="text-xs">Set a habit strategy to appear</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
