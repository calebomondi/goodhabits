"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useEffect } from "react"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "Daily deposit and withdrawal volume"

const chartConfig = {
  deposits: {
    label: "Deposits",
    color: "hsl(142, 76%, 36%)",
  },
  withdrawals: {
    label: "Withdrawals",
    color: "hsl(0, 84%, 60%)",
  },
} satisfies ChartConfig

function formatG$(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value
  const scaled = n / 1e18
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(2)}M`
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(2)}K`
  return scaled.toFixed(2)
}

type VolumeDataPoint = {
  date: string
  deposits: string
  withdrawals: string
  netFlow: string
}

type VolumeResponse = {
  data: VolumeDataPoint[]
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const { data: raw, isPending, isError } = useQuery<VolumeResponse>({
    queryKey: ["analytics", "volume", timeRange],
    queryFn: () =>
      fetch(`/api/analytics/volume?range=${timeRange}`).then((r) => r.json()),
    staleTime: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (isError) toast.error("Failed to load chart data")
  }, [isError])

  const chartData = React.useMemo(() => {
    if (!raw?.data) return []

    const range = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const dates: string[] = []
    const now = new Date()
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000)
      dates.push(d.toISOString().slice(0, 10))
    }

    const lookup = new Map(
      raw.data.map((d) => [
        d.date,
        {
          deposits: Number(d.deposits) / 1e18,
          withdrawals: -(Number(d.withdrawals) / 1e18),
          netFlow: (Number(d.deposits) - Number(d.withdrawals)) / 1e18,
        },
      ]),
    )

    return dates.map((date) => {
      const day = lookup.get(date) ?? { deposits: 0, withdrawals: 0, netFlow: 0 }
      return { date, ...day }
    })
  }, [raw, timeRange])

  const activeDates = React.useMemo(() => {
    if (!raw?.data) return []
    return raw.data
      .filter((d) => Number(d.deposits) > 0 || Number(d.withdrawals) > 0)
      .map((d) => d.date)
  }, [raw])

  const lastDay = React.useMemo(() => {
    if (!chartData.length) return null
    const last = chartData[chartData.length - 1]
    if (last.deposits === 0 && last.netFlow === 0) return null
    return last
  }, [chartData])

  if (isPending) {
    return (
      <Card className="@container/card animate-pulse">
        <CardHeader>
          <div className="h-5 w-28 bg-muted rounded-full" />
          <div className="h-3 w-48 bg-muted rounded-full mt-2" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="aspect-auto h-[250px] w-full bg-muted rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="font-heading">Daily Volume</CardTitle>
        <CardDescription>
          {lastDay ? (
            <span className="hidden @[540px]/card:block">
              Today: +{formatG$(lastDay.deposits * 1e18)} G$ deposited, {formatG$(-lastDay.withdrawals * 1e18)} G$ withdrawn &mdash; {timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "Last 3 months"}
            </span>
          ) : (
            <span className="@[540px]/card:hidden">
              {timeRange === "7d" ? "Last 7 days" : timeRange === "30d" ? "Last 30 days" : "Last 3 months"}
            </span>
          )}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillDeposits" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-deposits)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-deposits)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillWithdrawals" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-withdrawals)"
                  stopOpacity={0.6}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-withdrawals)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={0}
              ticks={activeDates}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  formatter={((value: number, name: string) => {
                    const formatted = formatG$(Math.abs(value) * 1e18)
                    if (name === "deposits") return `Deposit: ${formatted} G$`
                    if (name === "withdrawals") return `Withdrawal: ${formatted} G$`
                    return `${formatted} G$`
                  }) as any}
                />
              }
            />
            <Area
              dataKey="withdrawals"
              type="monotone"
              fill="url(#fillWithdrawals)"
              stroke="var(--color-withdrawals)"
            />
            <Area
              dataKey="deposits"
              type="monotone"
              fill="url(#fillDeposits)"
              stroke="var(--color-deposits)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
