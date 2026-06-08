"use client"

import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useEffect } from "react"
import { PiggyBankIcon, WalletIcon } from "lucide-react"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type UserAlloc = {
  spendAmount: string
  saveAmount: string
  investAmount: string
  totalAssets: string
  spendAmountUsd: string | null
  saveAmountUsd: string | null
  investAmountUsd: string | null
  totalAssetsUsd: string | null
}

function formatG$(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value
  const scaled = n / 1e18
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(1)}M`
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(1)}K`
  return scaled.toFixed(2)
}

function formatUSD(value: string | null) {
  if (value === null) return null
  const n = Number(value)
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function SkeletonCard() {
  return (
    <Card className="@container/card animate-pulse">
      <CardHeader>
        <div className="h-3 w-20 bg-muted rounded-full" />
        <div className="h-7 w-28 bg-muted rounded-full mt-2" />
        <CardAction>
          <div className="h-5 w-12 bg-muted rounded-full" />
        </CardAction>
      </CardHeader>
      <CardFooter>
        <div className="h-3 w-32 bg-muted rounded-full" />
      </CardFooter>
    </Card>
  )
}

export function SectionCards() {
  const { address, isConnected } = useAccount()

  const { data: alloc, isPending, isError } = useQuery<UserAlloc>({
    queryKey: ["user-alloc", address],
    queryFn: () => fetch(`/api/analytics/user-alloc?user=${address}`).then((r) => r.json()),
    enabled: !!address,
    refetchInterval: 60_000,
  })

  useEffect(() => {
    if (isError) toast.error("Failed to load allocation data")
  }, [isError])

  const totalAssets = alloc?.totalAssets ?? "0"
  const saveAmount = alloc?.saveAmount ?? "0"
  const spendAmount = alloc?.spendAmount ?? "0"
  const investAmount = alloc?.investAmount ?? "0"
  const totalAssetsUsd = formatUSD(alloc?.totalAssetsUsd ?? null)
  const saveAmountUsd = formatUSD(alloc?.saveAmountUsd ?? null)
  const spendAmountUsd = formatUSD(alloc?.spendAmountUsd ?? null)
  const investAmountUsd = formatUSD(alloc?.investAmountUsd ?? null)

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Assets</CardDescription>
          <CardTitle className="font-heading text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalAssetsUsd ?? `${formatG$(totalAssets)} G$`}
          </CardTitle>
          {totalAssetsUsd && (
            <p className="text-sm text-muted-foreground -mt-1 tracking-tight">
              {formatG$(totalAssets)} G$
            </p>
          )}
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            {isConnected ? "Your total G$ balance" : "Connect wallet to view"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Savings Pool</CardDescription>
          <CardTitle className="font-heading text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {saveAmountUsd ?? `${formatG$(saveAmount)} G$`}
          </CardTitle>
          {saveAmountUsd && (
            <p className="text-sm text-muted-foreground -mt-1 tracking-tight">
              {formatG$(saveAmount)} G$
            </p>
          )}
          <CardAction>
            <PiggyBankIcon className="size-4 text-indigo-500" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Locked in savings streaks
          </div>
          <div className="text-muted-foreground">
            Early withdrawal breaks your streak
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Spendable</CardDescription>
          <CardTitle className="font-heading text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {spendAmountUsd ?? `${formatG$(spendAmount)} G$`}
          </CardTitle>
          {spendAmountUsd && (
            <p className="text-sm text-muted-foreground -mt-1 tracking-tight">
              {formatG$(spendAmount)} G$
            </p>
          )}
          <CardAction>
            <WalletIcon className="size-4 text-amber-500" />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Available for immediate withdrawal
          </div>
          <div className="text-muted-foreground">
            No lock-up or cooldown
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Investment</CardDescription>
          <CardTitle className="font-heading text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {investAmountUsd ?? `${formatG$(investAmount)} G$`}
          </CardTitle>
          {investAmountUsd && (
            <p className="text-sm text-muted-foreground -mt-1 tracking-tight">
              {formatG$(investAmount)} G$
            </p>
          )}
          <CardAction>
            <span className="text-xs text-muted-foreground tabular-nums">0.00%</span>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">
            Deployed in investment strategies
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
