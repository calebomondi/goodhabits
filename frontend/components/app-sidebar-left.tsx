"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Target,
  ArrowUpFromLine,
  TrendingUp,
  CheckCircle2,
  Clock,
  LoaderCircle,
  ChevronDown,
  Lock,
} from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { TREASURY_ABI, getTreasuryAddress } from "@/lib/contract"
import { useHasUserSetStrategy, useGetUserHabit, useSetHabitStrategy, useTargetSavingsUnlock, useBrokeHabits, useSetTargetSavingsUnlock, useGetUserAllocation, useWithdraw, TOKENS, ERC20_ABI } from "@/lib/hooks"

type UserPosition = {
  shares: string
  lockedShares: string
  ownershipBps: string
  currentValue: string
  deposited: string
  withdrawn: string
  pnl: string
}

type Summary = {
  pricePerShare: string
  totalAssets: string
  activePositions: number
  accruedFees: string
  feeBps: string
}

function formatG$(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value
  const scaled = n / 1e18
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(2)}M`
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(2)}K`
  return scaled.toFixed(2)
}

export function AppSidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { address, isConnected, chainId } = useAccount()

  const { data: summary, isError: summaryError } = useQuery<Summary>({
    queryKey: ["analytics", "summary"],
    queryFn: () => fetch("/api/analytics/summary").then((r) => r.json()),
    refetchInterval: 60_000,
    enabled: isConnected,
  })

  const { data: userPosition, isError: positionError } = useQuery<UserPosition>({
    queryKey: ["treasury", "users", address],
    queryFn: () => fetch(`/api/treasury/users/${address}`).then((r) => r.json()),
    enabled: !!address && isConnected,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (summaryError) toast.error("Failed to load treasury summary")
  }, [summaryError])

  useEffect(() => {
    if (positionError) toast.error("Failed to load your position")
  }, [positionError])

  const pricePerShare = summary?.pricePerShare ?? "0"
  const ppsNum = Number(pricePerShare) / 1e18
  const unlockedShares = Number(userPosition?.shares ?? "0") / 1e18
  const lockedSharesAmt = Number(userPosition?.lockedShares ?? "0") / 1e18
  const currentValue = Number(userPosition?.currentValue ?? "0") / 1e18
  const lifetimeDeposited = Number(userPosition?.deposited ?? "0") / 1e18
  const lifetimeWithdrawn = Number(userPosition?.withdrawn ?? "0") / 1e18
  const pnl = Number(userPosition?.pnl ?? "0") / 1e18
  const accruedFees = summary?.accruedFees ?? "0"

  const [openSection, setOpenSection] = React.useState<string | null>("habit")

  // ─── Habit Strategy ───
  const [spendPct, setSpendPct] = React.useState("")
  const [savePct, setSavePct] = React.useState("")
  const parsedSpend = Number.parseFloat(spendPct) || 0
  const parsedSave = Number.parseFloat(savePct) || 0
  const computedInvest = parsedSpend + parsedSave <= 100 ? 100 - parsedSpend - parsedSave : 0
  const totalPct = parsedSpend + parsedSave + computedInvest
  const isValidStrategy = totalPct === 100
  const isOverLimit = totalPct > 100

  // ─── Savings ───
  const { allocation, isLoading: loadingAllocation } = useGetUserAllocation(address, chainId)
  const savedAmount = allocation ? Number(allocation.saveAmount) / 1e18 : 0
  const now = Date.now() / 1000
  const { unlockTimestamp, isLoading: isLoadingUnlock } = useTargetSavingsUnlock(address, chainId)
  const { brokeHabits, isLoading: isLoadingBroke } = useBrokeHabits(address, chainId)
  const { setLock: writeSetLock, isWritePending: lockPending, isConfirming: lockConfirming, isConfirmed: lockConfirmed } = useSetTargetSavingsUnlock(chainId)
  const { data: leaderboardStatus } = useQuery({
    queryKey: ["leaderboard", "status", address],
    queryFn: () => fetch(`/api/analytics/leaderboard/status?user=${address}`).then((r) => r.json()),
    enabled: !!address,
  })
  const isPointsFrozen = leaderboardStatus?.isFrozen ?? false
  const freezeEndStr = leaderboardStatus?.pointsFrozenUntil
  const freezeEndDate = freezeEndStr ? new Date(freezeEndStr) : null
  const freezeRemainingDays = freezeEndDate
    ? Math.ceil((freezeEndDate.getTime() - Date.now()) / 86400000)
    : 0
  const unlockTsVal = unlockTimestamp ? Number(unlockTimestamp) : 0
  const hasLock = unlockTsVal > 0
  const lockExpired = hasLock && unlockTsVal <= now
  const streakActive = hasLock && !lockExpired
  const [lockDuration, setLockDuration] = React.useState("")

  // ─── Withdraw & Offramp ───
  const [withdrawBucket, setWithdrawBucket] = React.useState("spendable")
  const [withdrawAmount, setWithdrawAmount] = React.useState("")
  const [withdrawAction, setWithdrawAction] = React.useState<"withdraw" | "offramp">("withdraw")
  const [offrampCurrency, setOfframpCurrency] = React.useState("USD")
  const [offrampFiatAmount, setOfframpFiatAmount] = React.useState("")
  const [offrampRecipient, setOfframpRecipient] = React.useState("")
  const [offrampStep, setOfframpStep] = React.useState<'idle' | 'withdraw' | 'approve' | 'done'>('idle')
  const [backendAddress, setBackendAddress] = React.useState<string | null>(null)
  const [offrampRequestId, setOfframpRequestId] = React.useState<number | null>(null)
  const [offrampSubmitted, setOfframpSubmitted] = React.useState<{ amountFiat: string; currency: string; recipient: string } | null>(null)
  const withdrawableBalance: Record<string, number> = {
    spendable: allocation ? Number(allocation.spendAmount) / 1e18 : 0,
    savings: allocation ? Number(allocation.saveAmount) / 1e18 : 0,
  }
  const totalG$Balance = Number(userPosition?.shares ?? "0") / 1e18
  const { data: offrampRate } = useQuery({
    queryKey: ["offramp", "rate", offrampCurrency],
    queryFn: () => fetch(`/api/offramp/rate?currency=${offrampCurrency}`).then((r) => r.json()),
    refetchInterval: 60_000,
    enabled: withdrawAction === "offramp",
  })
  const { data: offrampStatus } = useQuery({
    queryKey: ["offramp", "status", offrampRequestId],
    queryFn: () => fetch(`/api/offramp/requests/${offrampRequestId}`).then(r => r.json()),
    enabled: offrampRequestId !== null,
    refetchInterval: 5_000,
  })
  const exchangeRate = offrampRate?.rate ?? 0.72
  const displayRate = offrampRate?.displayRate ?? exchangeRate
  const offrampG$Needed = offrampFiatAmount
    ? Math.ceil(Number.parseFloat(offrampFiatAmount) / displayRate)
    : 0
  const hasEnoughBalance = offrampG$Needed > 0 && offrampG$Needed <= withdrawableBalance[withdrawBucket]
  const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬' },
    { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪' },
    { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
    { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi', flag: '🇬🇭' },
    { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
    { code: 'XAF', symbol: 'FCFA', name: 'Central African CFA', flag: '🇨🇲' },
    { code: 'XOF', symbol: 'CFA', name: 'West African CFA', flag: '🇸🇳' },
    { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬' },
    { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling', flag: '🇹🇿' },
    { code: 'RWF', symbol: 'FRw', name: 'Rwandan Franc', flag: '🇷🇼' },
    { code: 'MXN', symbol: '$', name: 'Mexican Peso', flag: '🇲🇽' },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  ]
  const activeCurrency = CURRENCIES.find(c => c.code === offrampCurrency) ?? CURRENCIES[0]

  // ─── Investment ───
  const [requestAmount, setRequestAmount] = React.useState("")
  const [isRequesting, setIsRequesting] = React.useState(false)
  const userActiveRequestCount = 2
  const MAX_ACTIVE_REQUESTS = 10
  const sharePrice = ppsNum
  const requestTimeout = 7 * 24 * 60 * 60
  const nowSec = Date.now() / 1000
  const [activeRequests] = React.useState([
    { id: 1, shares: 100, assets: 250, status: "Ready" as const, createdAt: nowSec - 10 * 24 * 60 * 60 },
    { id: 2, shares: 50, assets: 120, status: "Pending" as const, createdAt: nowSec - 2 * 24 * 60 * 60 },
  ])

  const queryClient = useQueryClient()

  const { hasSetStrategy, isLoading: isCheckingStrategy } = useHasUserSetStrategy(address, chainId)
  const { habit, isLoading: isLoadingHabit } = useGetUserHabit(address, chainId)
  const { setStrategy: writeSetHabit, isWritePending: setHabitPending, isConfirming: setHabitConfirming, isConfirmed: setHabitConfirmed } = useSetHabitStrategy(chainId)
  const saveAllocation = habit ? Number(habit.toSave) / 100 : 0

  const setStrategyMutation = useMutation({
    mutationFn: (data: { spendPct: number; savePct: number; investPct: number }) =>
      fetch("/api/analytics/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ...data }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "leaderboard"] })
      toast.success("Strategy saved!")
    },
    onError: () => {
      toast.error("Failed to save strategy")
    },
  })

  const chainName =
    chainId === 42220 ? "Celo" : chainId === 122 ? "Fuse" : chainId === 50 ? "XDC" : "Unknown"
  const treasuryAddress = getTreasuryAddress(chainId)

  // ─── Wagmi contract hooks ───
  const { writeContract: writeDeposit, data: depositHash, isPending: depositPending } = useWriteContract()
  const { writeContract: writeRequestWithdrawal, data: requestHash, isPending: requestPending } = useWriteContract()
  const { writeContract: writeFinalize, data: finalizeHash, isPending: finalizePending } = useWriteContract()
  const { writeContract: writeCancel, data: cancelHash, isPending: cancelPending } = useWriteContract()
  const { withdraw: doWithdraw, hash: withdrawHash, isPending: withdrawPending, isConfirming: withdrawConfirming, isConfirmed } = useWithdraw(chainId)
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, isError: approveError, error: approveErrorObj } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash })

  const { isLoading: depositConfirming } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: requestConfirming } = useWaitForTransactionReceipt({ hash: requestHash })
  const { isLoading: finalizeConfirming } = useWaitForTransactionReceipt({ hash: finalizeHash })
  const { isLoading: cancelConfirming } = useWaitForTransactionReceipt({ hash: cancelHash })

  React.useEffect(() => {
    if (setHabitConfirmed) toast.success("Habit strategy saved on-chain!")
  }, [setHabitConfirmed])

  React.useEffect(() => {
    if (depositHash) toast.success("Deposit submitted on-chain!")
  }, [depositHash])

  React.useEffect(() => {
    if (withdrawHash) toast.success("Withdrawn successfully!")
  }, [withdrawHash])

  React.useEffect(() => {
    if (isConfirmed && withdrawAction === 'withdraw') {
      setWithdrawAmount("")
      setOfframpFiatAmount("")

      queryClient.invalidateQueries({ queryKey: ["user-alloc", address] })
      queryClient.invalidateQueries({ queryKey: ["treasury", "users", address] })
      queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] })
      queryClient.invalidateQueries({ queryKey: ["user-txns", address] })
      queryClient.invalidateQueries({ queryKey: ["analytics", "volume"] })
      queryClient.invalidateQueries({ queryKey: ["analytics", "leaderboard"] })
      queryClient.invalidateQueries({ queryKey: ["leaderboard", "status", address] })

      fetch(`/api/analytics/refresh?user=${address}`, { method: "POST" })
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ["user-alloc", address] })
          queryClient.invalidateQueries({ queryKey: ["treasury", "users", address] })
          queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] })
          queryClient.invalidateQueries({ queryKey: ["user-txns", address] })
          queryClient.invalidateQueries({ queryKey: ["analytics", "volume"] })
          queryClient.invalidateQueries({ queryKey: ["analytics", "leaderboard"] })
          queryClient.invalidateQueries({ queryKey: ["leaderboard", "status", address] })
        })
    }
  }, [isConfirmed, withdrawAction, address, queryClient])

  React.useEffect(() => {
    if (requestHash) toast.success("Withdrawal request submitted on-chain!")
  }, [requestHash])

  React.useEffect(() => {
    if (finalizeHash) toast.success("Withdrawal finalized on-chain!")
  }, [finalizeHash])

  React.useEffect(() => {
    if (cancelHash) toast.success("Withdrawal request cancelled on-chain!")
  }, [cancelHash])

  React.useEffect(() => {
    if (lockConfirmed) toast.success("Savings lock set on-chain!")
  }, [lockConfirmed])

  // Offramp chain: step 2 — withdraw confirmed → fetch beneficiary → trigger approve
  React.useEffect(() => {
    if (isConfirmed && offrampStep === 'withdraw' && withdrawAction === 'offramp') {
      fetch('/api/offramp/beneficiary')
        .then(r => r.json())
        .then(data => {
          setBackendAddress(data.address)
          setOfframpStep('approve')
        })
        .catch(() => {
          toast.error("Failed to get offramp beneficiary")
          setOfframpStep('idle')
        })
    }
  }, [isConfirmed, offrampStep, withdrawAction])

  // Offramp chain: step 3 — backendAddress set → send approve tx
  React.useEffect(() => {
    if (offrampStep === 'approve' && backendAddress && withdrawAmount && !approveHash && !approvePending) {
      const amount = BigInt(Math.round(Number.parseFloat(withdrawAmount) * 1e18))
      writeApprove({
        address: TOKENS.G$,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [backendAddress as `0x${string}`, amount],
      })
    }
  }, [offrampStep, backendAddress, withdrawAmount, approveHash, approvePending, writeApprove])

  // Offramp chain: step 4 — approve confirmed → POST request → done
  React.useEffect(() => {
    if (approveConfirmed && offrampStep === 'approve') {
      const amount = BigInt(Math.round(Number.parseFloat(withdrawAmount) * 1e18))
      fetch("/api/offramp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          amountG: amount.toString(),
          amountFiat: offrampFiatAmount,
          rateUsed: displayRate.toString(),
          targetCurrency: offrampCurrency,
          usdcRecipient: offrampRecipient,
        }),
      })
        .then(r => r.json())
        .then(data => {
          setOfframpSubmitted({ amountFiat: offrampFiatAmount, currency: offrampCurrency, recipient: offrampRecipient })
          setOfframpStep('done')
          setOfframpRequestId(data.id)
          setWithdrawAmount("")
          setOfframpFiatAmount("")
          toast.success("Offramp request submitted!")
        })
        .catch(() => {
          toast.error("Failed to log offramp request")
          setOfframpStep('idle')
        })
    }
  }, [approveConfirmed, offrampStep, withdrawAmount, offrampFiatAmount, offrampCurrency, offrampRecipient, address, displayRate])

  // Offramp chain: reset on approve error
  React.useEffect(() => {
    if (approveError && offrampStep === 'approve') {
      toast.error("Approval cancelled. Please try again.")
      setOfframpStep('idle')
      setBackendAddress(null)
    }
  }, [approveError, offrampStep])

  React.useEffect(() => {
    if (habit && !isLoadingHabit && hasSetStrategy) {
      setSpendPct(String(Number(habit.toSpend) / 100))
      setSavePct(String(Number(habit.toSave) / 100))
    }
  }, [habit, isLoadingHabit, hasSetStrategy])

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/" className="flex items-center">
                <img src="/goodhabit.png" alt="GoodHabit" className="size-8" />
                <span className="text-lg font-semibold">GoodHabit</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

       <Separator className="my-1 group-data-[collapsible=icon]:hidden" />

      <SidebarContent>
        <div className={`flex flex-col gap-3 px-3 ${!isConnected ? "opacity-50 pointer-events-none" : ""}`}>

            {/* ════════════════════════════════════════
               SECTION 1: HABIT STRATEGY
            ════════════════════════════════════════ */}
            <div className="group-data-[collapsible=icon]:hidden rounded-lg bg-muted/30 p-4">
              <Collapsible open={openSection === "habit"} onOpenChange={(o) => setOpenSection(o ? "habit" : null)}>
                <CollapsibleTrigger className="group/collapsible flex w-full cursor-pointer items-center gap-1.5">
                  <Target className="size-4 text-violet-500" />
                  <span className="text-sm font-heading font-medium text-foreground">Habit Strategy</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-2.5">
                  <p className="text-sm leading-relaxed text-muted-foreground mb-2">
                    Set how your daily UBI is split across Spend, Save, and Invest. Percentages must total 100%.
                  </p>

                  {isCheckingStrategy || isLoadingHabit ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Loading strategy…
                    </div>
                  ) : hasSetStrategy && habit ? (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground text-xs">Current Strategy</span>
                      <div className="flex gap-3 mt-1 font-medium tabular-nums">
                        <span className="text-violet-600">{Number(habit.toSpend) / 100}% Spend</span>
                        <span className="text-indigo-600">{Number(habit.toSave) / 100}% Save</span>
                        <span className="text-cyan-600">{Number(habit.toInvest) / 100}% Invest</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 items-center">
                    <span className="text-sm text-muted-foreground">Spend</span>
                    <div className="relative w-20 justify-self-end">
                      <Input
                        value={spendPct}
                        onChange={(e) => setSpendPct(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        className="h-9 pr-7 text-right text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        %
                      </span>
                    </div>

                    <span className="text-sm text-muted-foreground">Save</span>
                    <div className="relative w-20 justify-self-end">
                      <Input
                        value={savePct}
                        onChange={(e) => setSavePct(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        className="h-9 pr-7 text-right text-sm"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        %
                      </span>
                    </div>

                    <span className="text-sm text-muted-foreground">Invest</span>
                    <div className="relative w-20 justify-self-end">
                      <Input
                        value={String(computedInvest)}
                        readOnly
                        placeholder="0"
                        className="h-9 pr-7 text-right text-sm opacity-70"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm ${
                        isValidStrategy
                          ? "text-emerald-600"
                          : isOverLimit
                            ? "text-rose-500"
                            : "text-muted-foreground"
                      }`}
                    >
                      Total: {totalPct}%
                      {isValidStrategy && " ✓"}
                    </span>
                    <Button
                      size="xs"
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8"
                      onClick={() => {
                        const spend = Number.parseFloat(spendPct)
                        const save = Number.parseFloat(savePct)
                        const toSpend = BigInt(Math.round(spend * 100))
                        const toSave = BigInt(Math.round(save * 100))
                        const toInvest = BigInt(Math.round(computedInvest * 100))
                        writeSetHabit(toSpend, toSave, toInvest)
                        setStrategyMutation.mutate({ spendPct: spend, savePct: save, investPct: computedInvest })
                      }}
                      disabled={!isValidStrategy || setHabitPending || setHabitConfirming || setStrategyMutation.isPending}
                    >
                      {setHabitPending || setHabitConfirming ? (
                        <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Confirming...</>
                      ) : hasSetStrategy ? (
                        "Update Strategy"
                      ) : (
                        "Set Strategy"
                      )}
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator className="my-1 group-data-[collapsible=icon]:hidden" />

            {/* ════════════════════════════════════════
               SECTION 2: SAVINGS
            ════════════════════════════════════════ */}
            <div className="group-data-[collapsible=icon]:hidden rounded-lg bg-muted/30 p-4">
              <Collapsible open={openSection === "savings"} onOpenChange={(o) => setOpenSection(o ? "savings" : null)}>
                <CollapsibleTrigger className="group/collapsible flex w-full cursor-pointer items-center gap-1.5">
                  <Lock className="size-4 text-indigo-500" />
                  <span className="text-sm font-heading font-medium text-foreground">Savings</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-2.5">
                  <p className="text-sm leading-relaxed text-muted-foreground mb-2">
                    Lock savings for a set duration to build a streak. Withdrawing before the unlock date breaks your streak.
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Saved</span>
                    <span className="text-right font-medium tabular-nums">{formatG$(savedAmount * 1e18)} G$</span>
                    <span className="text-muted-foreground">Allocation</span>
                    <span className="text-right font-medium tabular-nums">{saveAllocation}%</span>
                  </div>

                  <Separator className="my-0.5" />

                  <div className="rounded-md bg-background/50 px-3 py-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {(isLoadingUnlock || isLoadingBroke) ? (
                        <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
                      ) : streakActive ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="size-3.5" /> Active
                        </span>
                      ) : lockExpired ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Clock className="size-3.5" /> Expired
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not set</span>
                      )}
                    </div>
                    {hasLock && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Unlocks</span>
                        <span className="text-sm font-medium tabular-nums">
                          {new Date(unlockTsVal * 1000).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Streak broken</span>
                      <span className="text-sm font-medium tabular-nums">
                        {isLoadingBroke ? (
                          <LoaderCircle className="size-3.5 animate-spin inline" />
                        ) : (
                          <>{brokeHabits ? Number(brokeHabits.savings) : 0} {Number(brokeHabits?.savings ?? 0) === 1 ? "time" : "times"}</>
                        )}
                      </span>
                    </div>
                    {isPointsFrozen && (
                      <div className="mt-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-1.5">
                        <span className="text-[11px] text-rose-600 flex items-center gap-1">
                          <Clock className="size-3" />
                          Points frozen {freezeRemainingDays}d — deposit after to recover
                        </span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-0.5" />

                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Set Savings Goal
                  </span>

                  <div className="relative w-full">
                    <Input
                      value={lockDuration}
                      onChange={(e) => setLockDuration(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Days to lock"
                      className="h-9 pr-10 text-sm"
                      disabled={lockPending || lockConfirming}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                      days
                    </span>
                  </div>

                  <Button
                    size="xs"
                    className="bg-blue-600 hover:bg-blue-700 text-white h-8"
                    onClick={() => {
                      const days = Number.parseInt(lockDuration) || 0
                      const timestamp = BigInt(Math.floor(Date.now() / 1000) + days * 86400)
                      writeSetLock(timestamp)
                    }}
                    disabled={lockPending || lockConfirming || !lockDuration || Number.parseInt(lockDuration) <= 0 || (hasLock && !lockExpired)}
                  >
                    {lockPending || lockConfirming ? (
                      <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Confirming...</>
                    ) : hasLock && !lockExpired ? (
                      "Lock already set"
                    ) : (
                      "Set Savings Goal"
                    )}
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator className="my-1 group-data-[collapsible=icon]:hidden" />

            {/* ════════════════════════════════════════
               SECTION 3: WITHDRAW & OFFRAMP
            ════════════════════════════════════════ */}
            <div className="group-data-[collapsible=icon]:hidden rounded-lg bg-muted/30 p-4">
              <Collapsible open={openSection === "withdraw"} onOpenChange={(o) => setOpenSection(o ? "withdraw" : null)}>
                <CollapsibleTrigger className="group/collapsible flex w-full cursor-pointer items-center gap-1.5">
                  <ArrowUpFromLine className="size-4 text-amber-500" />
                  <span className="text-sm font-heading font-medium text-foreground">Withdraw &amp; Offramp</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-2.5">
                  <p className="text-sm leading-relaxed text-muted-foreground mb-2">
                    Withdraw G$ directly or offramp to local fiat. Source from your spendable or savings balance.
                  </p>

                  <Select value={withdrawBucket} onValueChange={setWithdrawBucket}>
                    <SelectTrigger className="h-9 text-sm cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spendable" className="text-xs">Spendable</SelectItem>
                      <SelectItem value="savings" className="text-xs">Savings</SelectItem>
                    </SelectContent>
                  </Select>

                  {withdrawBucket === "savings" && streakActive && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex flex-col gap-1">
                      <span className="text-[11px] font-medium text-amber-700 flex items-center gap-1">
                        <Clock className="size-3.5" /> Streak active — withdraw early?
                      </span>
                      <span className="text-[11px] text-amber-600">
                        Unlocks{" "}
                        {new Date(unlockTsVal * 1000).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        . Withdrawing now resets your streak.
                      </span>
                    </div>
                  )}

                  <div className="flex rounded-lg border p-0.5 bg-muted/50">
                    <button
                      type="button"
                      onClick={() => { setWithdrawAction("withdraw"); setWithdrawAmount("") }}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        withdrawAction === "withdraw"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } cursor-pointer`}
                    >
                      Withdraw G$
                    </button>
                    <button
                      type="button"
                      onClick={() => { setWithdrawAction("offramp"); setWithdrawAmount("") }}
                      className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        withdrawAction === "offramp"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } cursor-pointer`}
                    >
                      Offramp to fiat
                    </button>
                  </div>

                  {withdrawAction === "withdraw" ? (
                    <>
                      <div className="relative">
                        <Input
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                          placeholder="0.00"
                          className="pr-12 h-9 text-base"
                          disabled={withdrawPending || withdrawConfirming}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-[11px] font-bold text-blue-500 hover:text-amber-700 hover:bg-amber-50"
                          onClick={() => setWithdrawAmount(withdrawableBalance[withdrawBucket].toString())}
                          disabled={withdrawPending || withdrawConfirming}
                        >
                          MAX
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Available: {withdrawableBalance[withdrawBucket].toLocaleString()} G$
                        </span>
                        <Button
                          size="xs"
                          className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white h-8"
                          onClick={() => {
                            const amount = BigInt(Math.round(Number.parseFloat(withdrawAmount) * 1e18))
                            doWithdraw(amount, withdrawBucket as "spendable" | "savings")
                          }}
                          disabled={withdrawPending || withdrawConfirming || !withdrawAmount || Number.parseFloat(withdrawAmount) <= 0}
                        >
                          {withdrawPending || withdrawConfirming ? (
                            <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Confirming...</>
                          ) : (
                            "Withdraw"
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Select value={offrampCurrency} onValueChange={setOfframpCurrency}>
                        <SelectTrigger className="h-9 text-sm cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map(c => (
                            <SelectItem key={c.code} value={c.code} className="text-xs">
                              {c.flag} {c.code} — {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="rounded-md bg-background/50 px-3 py-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Balance</span>
                          <span className="tabular-nums font-medium">
                            {totalG$Balance.toLocaleString()} G$
                            ≈ {activeCurrency.symbol}{(totalG$Balance * displayRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Available in source</span>
                          <span className="tabular-nums font-medium">
                            {withdrawableBalance[withdrawBucket].toLocaleString()} G$
                            ≈ {activeCurrency.symbol}{(withdrawableBalance[withdrawBucket] * displayRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Live rate</span>
                          <span className="tabular-nums font-medium">
                            1 G$ = {activeCurrency.symbol}{displayRate.toFixed(6)}
                          </span>
                        </div>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{activeCurrency.symbol}</span>
                        <Input
                          value={offrampFiatAmount}
                          onChange={(e) => {
                            setOfframpFiatAmount(e.target.value.replace(/[^0-9.]/g, ""))
                            const g = e.target.value
                              ? Math.ceil(Number.parseFloat(e.target.value) / displayRate)
                              : 0
                            setWithdrawAmount(g.toString())
                          }}
                          placeholder="0.00"
                          className="pl-7 pr-12 h-9 text-base"
                        />
                      </div>

                      {offrampFiatAmount && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">≈ {offrampG$Needed.toLocaleString()} G$</span>
                          <span className={hasEnoughBalance ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                            {hasEnoughBalance ? "Sufficient" : "Insufficient balance"}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">USDC recipient address</span>
                        <Input
                          value={offrampRecipient}
                          onChange={(e) => setOfframpRecipient(e.target.value)}
                          placeholder="0x..."
                          className="h-9 text-sm font-mono"
                        />
                      </div>

                      {offrampStep === 'done' && offrampSubmitted ? (
                        <div className="w-full rounded-lg border border-border bg-white dark:bg-gray-950 p-3 flex flex-col gap-2 shadow-sm">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            Request submitted
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Amount</span>
                            <span className="font-semibold tabular-nums text-foreground">{offrampSubmitted.currency === 'NGN' ? '₦' : offrampSubmitted.currency === 'KES' ? 'KSh ' : offrampSubmitted.currency === 'EUR' ? '€' : offrampSubmitted.currency === 'GBP' ? '£' : '$'}{offrampSubmitted.amountFiat} ({offrampSubmitted.currency})</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Recipient</span>
                            <span className="font-mono font-semibold text-foreground">{offrampSubmitted.recipient.slice(0, 6)}...{offrampSubmitted.recipient.slice(-4)}</span>
                          </div>
                          <div className="h-px bg-border my-0.5" />
                          <div className="flex items-center gap-1.5 text-xs">
                            {!offrampStatus ? (
                              <span className="flex items-center gap-1 text-muted-foreground"><LoaderCircle className="size-3 animate-spin" /> Checking status...</span>
                            ) : offrampStatus.status === 'completed' ? (
                              <div className="flex flex-col gap-1 w-full">
                                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                  <CheckCircle2 className="size-3.5" /> Swapped & sent
                                </span>
                                {offrampStatus.explorerLink && (
                                  <a href={offrampStatus.explorerLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                                    View on CeloScan →
                                  </a>
                                )}
                              </div>
                            ) : offrampStatus.status === 'failed' ? (
                              <span className="flex items-center gap-1 text-rose-600 font-semibold">
                                Failed — contact support
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                                <LoaderCircle className="size-3 animate-spin" /> Processing swap...
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full cursor-pointer bg-blue-600 hover:bg-blue-700 text-white mt-1"
                          onClick={() => {
                            if (offrampStep !== 'idle') return
                            const amount = BigInt(Math.round(Number.parseFloat(withdrawAmount) * 1e18))
                            setOfframpStep('withdraw')
                            doWithdraw(amount, withdrawBucket as "spendable" | "savings")
                          }}
                          disabled={
                            !offrampFiatAmount ||
                            !offrampRecipient ||
                            !hasEnoughBalance ||
                            offrampStep !== 'idle'
                          }
                        >
                          {offrampStep === 'withdraw' || withdrawPending || withdrawConfirming ? (
                            <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Step 1: Withdrawing...</>
                          ) : offrampStep === 'approve' || approvePending || approveConfirming ? (
                            <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Step 2: Approving...</>
                          ) : (
                            "Offramp"
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator className="my-1 group-data-[collapsible=icon]:hidden" />

            {/* ════════════════════════════════════════
               SECTION 4: INVESTMENT
            ════════════════════════════════════════ */}
            <div className="group-data-[collapsible=icon]:hidden rounded-lg bg-muted/30 p-4">
              <Collapsible open={openSection === "invest"} onOpenChange={(o) => setOpenSection(o ? "invest" : null)}>
                <CollapsibleTrigger className="group/collapsible flex w-full cursor-pointer items-center gap-1.5">
                  <TrendingUp className="size-4 text-cyan-500" />
                  <span className="text-sm font-heading font-medium text-foreground">Withdraw Investment</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-2.5">
                  <p className="text-sm leading-relaxed text-muted-foreground mb-2">
                    Redeem G$ from your invested shares. Requests enter a cooldown before finalization.
                  </p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-muted-foreground">Unlocked shares</span>
                    <span className="text-right font-medium tabular-nums">{unlockedShares.toLocaleString()}</span>
                    <span className="text-muted-foreground">Locked shares</span>
                    <span className="text-right font-medium tabular-nums">{lockedSharesAmt.toLocaleString()}</span>
                    <span className="text-muted-foreground">Share Price</span>
                    <span className="text-right font-medium tabular-nums">{sharePrice.toFixed(6)} G$</span>
                    <span className="text-muted-foreground">Fees Accrued</span>
                    <span className="text-right font-medium tabular-nums">{formatG$(accruedFees)} G$</span>
                  </div>

                  <Separator className="my-0.5" />

                  <div className="relative">
                    <Input
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      placeholder="Share amount"
                      className="h-9 text-sm pr-12"
                      disabled={isRequesting}
                    />
                  </div>

                  {requestAmount && Number.parseFloat(requestAmount) > 0 && (
                    <p className="text-sm text-muted-foreground text-right -mt-1">
                      ≈{" "}
                      {(Number.parseFloat(requestAmount) * sharePrice).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      G$
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Requests</span>
                    <span className="text-sm font-medium tabular-nums">
                      {userActiveRequestCount}/{MAX_ACTIVE_REQUESTS}
                    </span>
                  </div>

                  <Button
                    size="xs"
                    className="bg-cyan-600 hover:bg-cyan-700 text-white h-8"
                    onClick={() => {
                      const shares = BigInt(Math.round(Number.parseFloat(requestAmount) * 1e18))
                      writeRequestWithdrawal({
                        address: treasuryAddress,
                        abi: TREASURY_ABI,
                        functionName: "requestWithdrawal",
                        args: [shares],
                      })
                      setIsRequesting(true)
                    }}
                    disabled={requestPending || requestConfirming || !requestAmount || Number.parseFloat(requestAmount) <= 0}
                  >
                    {requestPending || requestConfirming ? (
                      <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Confirming...</>
                    ) : (
                      "Request Withdrawal"
                    )}
                  </Button>

                  <Separator className="my-1" />

                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active Requests
                  </span>

                  {activeRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active requests</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {activeRequests.map((req) => {
                        const canCancel =
                          req.status === "Pending" ||
                          (req.status === "Ready" && nowSec > req.createdAt + requestTimeout)
                        const cooldownEnd = req.createdAt + requestTimeout
                        const cooldownLeft = Math.max(0, cooldownEnd - nowSec)
                        const cooldownDays = Math.floor(cooldownLeft / 86400)
                        const cooldownHours = Math.floor((cooldownLeft % 86400) / 3600)

                        return (
                          <div
                            key={req.id}
                            className="flex items-center justify-between rounded-md bg-background/50 px-3 py-2"
                          >
                            <div className="flex flex-col min-w-0 gap-0.5">
                              <div className="flex items-center gap-1.5">
                                {req.status === "Ready" ? (
                                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <Clock className="size-3.5 text-amber-500 shrink-0" />
                                )}
                                <span className="text-xs truncate">
                                  #{req.id} {req.assets} G$
                                </span>
                                <Badge
                                  variant={req.status === "Ready" ? "default" : "secondary"}
                                  className="h-5 text-xs px-1.5 leading-none"
                                >
                                  {req.status}
                                </Badge>
                              </div>
                              {req.status === "Pending" ? (
                                <span className="text-[11px] text-muted-foreground ml-1">
                                  Awaiting liquidity
                                </span>
                              ) : cooldownLeft > 0 ? (
                                <span className="text-[11px] text-muted-foreground ml-1">
                                  Cooldown ends in {cooldownDays}d {cooldownHours}h
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-600 ml-1">
                                  Cooldown expired — can cancel
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {req.status === "Ready" && (
                                <Button
                                  size="xs"
                                  className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    writeFinalize({
                                      address: treasuryAddress,
                                      abi: TREASURY_ABI,
                                      functionName: "finalizeWithdrawal",
                                      args: [BigInt(req.id)],
                                    })
                                  }}
                                  disabled={finalizePending || finalizeConfirming}
                                >
                                  {finalizePending || finalizeConfirming ? (
                                    <LoaderCircle className="size-3 animate-spin" />
                                  ) : (
                                    "Finalize"
                                  )}
                                </Button>
                              )}
                              {canCancel && (
                                <Button
                                  size="xs"
                                  className="h-7 text-xs px-2 bg-rose-600 hover:bg-rose-700 text-white"
                                  onClick={() => {
                                    writeCancel({
                                      address: treasuryAddress,
                                      abi: TREASURY_ABI,
                                      functionName: "cancelWithdrawalRequest",
                                      args: [BigInt(req.id)],
                                    })
                                  }}
                                  disabled={cancelPending || cancelConfirming}
                                >
                                  {cancelPending || cancelConfirming ? (
                                    <LoaderCircle className="size-3 animate-spin" />
                                  ) : (
                                    "Cancel"
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>


          </div>
      </SidebarContent>
    </Sidebar>
  )
}
