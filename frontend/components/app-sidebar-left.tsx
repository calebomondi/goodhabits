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
import { useHasUserSetStrategy, useGetUserHabit, useSetHabitStrategy, useTargetSavingsUnlock, useBrokeHabits, useSetTargetSavingsUnlock, useGetUserAllocation, useWithdraw, TOKENS, ERC20_ABI, useGetUserPosition, useGetSummary, useGetWithdrawalRequests, useRequestWithdrawal, useFinalizeWithdrawal, useCancelWithdrawal, useGetInvestmentRequests, useRequestInvestmentWithdrawal } from "@/lib/hooks"

// Types moved to hooks.ts: UserPosition, Summary, WithdrawalRequest

function formatG$(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value
  const scaled = n / 1e18
  if (scaled >= 1_000_000) return `${(scaled / 1_000_000).toFixed(2)}M`
  if (scaled >= 1_000) return `${(scaled / 1_000).toFixed(2)}K`
  return scaled.toFixed(2)
}

export function AppSidebarLeft({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { address, isConnected, chainId } = useAccount()

  const { data: summary, isError: summaryError } = useGetSummary()
  const { position: userPosition, isError: positionError, refetch: refetchPosition } = useGetUserPosition(address, chainId)
  const { data: activeRequests, refetch: refetchRequests } = useGetWithdrawalRequests(address)

  useEffect(() => {
    if (summaryError) toast.error("Failed to load treasury summary")
  }, [summaryError])

  useEffect(() => {
    if (positionError) toast.error("Failed to load your position")
  }, [positionError])

  const pricePerShare = summary?.pricePerShare ?? "0"
  const ppsNum = Number(pricePerShare) / 1e18
  const unlockedShares = userPosition ? Number(userPosition.unlockedShares) / 1e18 : 0
  const lockedSharesAmt = userPosition ? Number(userPosition.lockedShares) / 1e18 : 0
  const totalValueG$ = userPosition ? Number(userPosition.totalValue) / 1e18 : 0
  const unlockedValueG$ = userPosition ? Number(userPosition.unlockedValue) / 1e18 : 0
  const lifetimeDeposited = userPosition ? Number(userPosition.deposited) / 1e18 : 0
  const lifetimeWithdrawn = userPosition ? Number(userPosition.withdrawn) / 1e18 : 0
  const pnl = userPosition ? Number(userPosition.pnl) / 1e18 : 0
  const pnlPct = lifetimeDeposited > 0 ? (pnl / lifetimeDeposited) * 100 : 0
  const accruedFees = summary?.accruedFees ?? "0"
  const userActiveRequestCount = activeRequests?.filter(r => r.status === 0 || r.status === 1).length ?? 0
  const MAX_ACTIVE_REQUESTS = 10

  const [openSection, setOpenSection] = React.useState<string | null>(null)

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
  const { allocation, isLoading: loadingAllocation, refetch: refetchAllocation } = useGetUserAllocation(address, chainId)
  const savedAmount = allocation ? Number(allocation.saveAmount) / 1e18 : 0
  const now = Date.now() / 1000
  const { unlockTimestamp, isLoading: isLoadingUnlock, refetch: refetchUnlock } = useTargetSavingsUnlock(address, chainId)
  const { brokeHabits, isLoading: isLoadingBroke, refetch: refetchBrokeHabits } = useBrokeHabits(address, chainId)
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
  const totalG$Balance = (withdrawableBalance.spendable + withdrawableBalance.savings + (userPosition ? Number(userPosition.unlockedValue) / 1e18 : 0))
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
  const [investOfframp, setInvestOfframp] = React.useState(false)
  const [investOfframpCurrency, setInvestOfframpCurrency] = React.useState("USD")
  const [investOfframpFiat, setInvestOfframpFiat] = React.useState("")
  const [investOfframpRecipient, setInvestOfframpRecipient] = React.useState("")
  const [investOfframpStep, setInvestOfframpStep] = React.useState<'idle' | 'withdraw' | 'approve' | 'done'>('idle')
  const [investBackendAddress, setInvestBackendAddress] = React.useState<string | null>(null)
  const [investOfframpRequestId, setInvestOfframpRequestId] = React.useState<number | null>(null)
  const [investOfframpSubmitted, setInvestOfframpSubmitted] = React.useState<{ amountFiat: string; currency: string; recipient: string } | null>(null)
  const habitSetRef = React.useRef(false)
  const [offrampTargetRequest, setOfframpTargetRequest] = React.useState<{ requestId: bigint; g$Wei: bigint } | null>(null)
  const { data: investOfframpRate } = useQuery({
    queryKey: ["offramp", "rate", investOfframpCurrency],
    queryFn: () => fetch(`/api/offramp/rate?currency=${investOfframpCurrency}`).then((r) => r.json()),
    enabled: investOfframp,
    refetchInterval: 60_000,
  })
  const investDisplayRate = investOfframpRate?.displayRate ?? investOfframpRate?.rate ?? 0.72
  const { data: investOfframpStatus } = useQuery({
    queryKey: ["offramp", "status", investOfframpRequestId],
    queryFn: () => fetch(`/api/offramp/requests/${investOfframpRequestId}`).then(r => r.json()),
    enabled: investOfframpRequestId !== null,
    refetchInterval: 5_000,
  })
  const sharePrice = ppsNum
  const requestTimeout = 7 * 24 * 60 * 60
  const nowSec = Date.now() / 1000

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
  const { requestWithdrawal, hash: requestHash, isPending: requestPending, isConfirming: requestConfirming, isConfirmed: requestConfirmed } = useRequestWithdrawal(chainId)
  const { finalizeWithdrawal, hash: finalizeHash, isPending: finalizePending, isConfirming: finalizeConfirming, isConfirmed: finalizeConfirmed } = useFinalizeWithdrawal(chainId)
  const { cancelWithdrawal, hash: cancelHash, isPending: cancelPending, isConfirming: cancelConfirming, isConfirmed: cancelConfirmed } = useCancelWithdrawal(chainId)
  const { withdraw: doWithdraw, hash: withdrawHash, isPending: withdrawPending, isConfirming: withdrawConfirming, isConfirmed } = useWithdraw(chainId)
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, isError: approveError, error: approveErrorObj } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash })
  const { writeContract: investWriteApprove, data: investApproveHash, isPending: investApprovePending, isError: investApproveError } = useWriteContract()
  const { isLoading: investApproveConfirming, isSuccess: investApproveConfirmed } = useWaitForTransactionReceipt({ hash: investApproveHash })

  const { isLoading: depositConfirming } = useWaitForTransactionReceipt({ hash: depositHash })

  React.useEffect(() => {
    if (setHabitConfirmed) {
      toast.success("Habit strategy saved on-chain!")
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey[0] as Record<string, unknown>
          return k?.entity === 'readContract' && (
            k?.functionName === 'hasUserSetStrategy' ||
            k?.functionName === 'getUserHabit'
          )
        },
      })
    }
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

      invalidateAfterTx(withdrawHash)
    }
  }, [isConfirmed, withdrawAction, withdrawHash, address, queryClient])

  function invalidateAfterTx(txHash?: `0x${string}`) {
    fetch(`/api/analytics/refresh?user=${address}${txHash ? `&txHash=${txHash}` : ''}`, { method: "POST" })
      .catch(() => {})
      .then(() => {
        refetchAllocation()
        queryClient.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey[0] as Record<string, unknown>
            return k?.entity === 'readContract' && k?.functionName === 'balanceOf' && k?.address === TOKENS.G$
          },
        })
        queryClient.invalidateQueries({ queryKey: ["user-alloc", address] })
        queryClient.invalidateQueries({ queryKey: ["treasury", "users", address] })
        queryClient.invalidateQueries({ queryKey: ["analytics", "summary"] })
        queryClient.refetchQueries({ queryKey: ["user-txns", address] })
        queryClient.refetchQueries({ queryKey: ["analytics", "volume"] })
        queryClient.invalidateQueries({ queryKey: ["analytics", "leaderboard"] })
        queryClient.invalidateQueries({ queryKey: ["leaderboard", "status", address] })
        queryClient.invalidateQueries({ queryKey: ["treasury", "requests", address] })
        refetchPosition()
        refetchRequests()
      })
  }

  React.useEffect(() => {
    if (requestConfirmed) {
      setRequestAmount("")
      toast.success("Withdrawal request submitted on-chain!")
      invalidateAfterTx(requestHash)
    }
  }, [requestConfirmed, requestHash])

  React.useEffect(() => {
    if (finalizeConfirmed) {
      toast.success("Withdrawal finalized on-chain!")
      invalidateAfterTx(finalizeHash)
    }
  }, [finalizeConfirmed, finalizeHash])

  React.useEffect(() => {
    if (cancelConfirmed) {
      toast.success("Withdrawal request cancelled on-chain!")
      invalidateAfterTx(cancelHash)
    }
  }, [cancelConfirmed, cancelHash])

  React.useEffect(() => {
    if (lockConfirmed) {
      setLockDuration("")
      toast.success("Savings lock set on-chain!")
      refetchUnlock()
      refetchBrokeHabits()
    }
  }, [lockConfirmed])

  // ── Investment offramp: step 1 — finalize confirmed → fetch beneficiary ──
  React.useEffect(() => {
    if (finalizeConfirmed && investOfframpStep === 'withdraw' && offrampTargetRequest) {
      fetch('/api/offramp/beneficiary')
        .then(r => r.json())
        .then(data => {
          setInvestBackendAddress(data.address)
          setInvestOfframpStep('approve')
        })
        .catch(() => {
          toast.error("Failed to get offramp beneficiary")
          setInvestOfframpStep('idle')
        })
    }
  }, [finalizeConfirmed, investOfframpStep, offrampTargetRequest])

  // ── Investment offramp: step 2 — beneficiary set → send approve tx ──
  React.useEffect(() => {
    if (investOfframpStep === 'approve' && investBackendAddress && offrampTargetRequest && !investApproveHash && !investApprovePending) {
      investWriteApprove({
        address: TOKENS.G$,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [investBackendAddress as `0x${string}`, offrampTargetRequest.g$Wei],
      })
    }
  }, [investOfframpStep, investBackendAddress, offrampTargetRequest, investApproveHash, investApprovePending, investWriteApprove])

  // ── Investment offramp: step 3 — approve confirmed → POST request → done ──
  React.useEffect(() => {
    if (investApproveConfirmed && investOfframpStep === 'approve' && offrampTargetRequest) {
      fetch("/api/offramp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          amountG: offrampTargetRequest.g$Wei.toString(),
          amountFiat: investOfframpFiat,
          rateUsed: investDisplayRate.toString(),
          targetCurrency: investOfframpCurrency,
          usdcRecipient: investOfframpRecipient,
        }),
      })
        .then(r => r.json())
        .then(data => {
          setInvestOfframpSubmitted({ amountFiat: investOfframpFiat, currency: investOfframpCurrency, recipient: investOfframpRecipient })
          setInvestOfframpStep('done')
          setInvestOfframpRequestId(data.id)
          setInvestOfframpFiat("")
          setInvestOfframpRecipient("")
          toast.success("Offramp request submitted!")
        })
        .catch(() => {
          toast.error("Failed to log offramp request")
          setInvestOfframpStep('idle')
        })
    }
  }, [investApproveConfirmed, investOfframpStep, offrampTargetRequest, investOfframpFiat, investOfframpCurrency, investOfframpRecipient, address, investDisplayRate])

  // ── Investment offramp: reset on approve error ──
  React.useEffect(() => {
    if (investApproveError && investOfframpStep === 'approve') {
      toast.error("Approval cancelled. Please try again.")
      setInvestOfframpStep('idle')
      setInvestBackendAddress(null)
    }
  }, [investApproveError, investOfframpStep])

  // Offramp chain: step 2 — withdraw confirmed → fetch beneficiary → trigger approve
  React.useEffect(() => {
    if (isConfirmed && offrampStep === 'withdraw' && withdrawAction === 'offramp') {
      invalidateAfterTx(withdrawHash)
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
  }, [isConfirmed, offrampStep, withdrawAction, withdrawHash])

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
    if (habit && !isLoadingHabit && hasSetStrategy && !habitSetRef.current) {
      setSpendPct(String(Number(habit.toSpend) / 100))
      setSavePct(String(Number(habit.toSave) / 100))
      habitSetRef.current = true
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
                      Offramp
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
               SECTION 4: INVESTMENT (PLACEHOLDER)
            ════════════════════════════════════════ */}
            <div className="group-data-[collapsible=icon]:hidden rounded-lg bg-muted/30 p-4">
              <Collapsible open={openSection === "investment"} onOpenChange={(o) => setOpenSection(o ? "investment" : null)}>
                <CollapsibleTrigger className="group/collapsible flex w-full cursor-pointer items-center gap-1.5">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <span className="text-sm font-heading font-medium text-foreground">Investment</span>
                  <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-3 pt-2.5">

                  {/* PLACEHOLDER: Summary card showing allocated invest amount and virtual growth */}
                  {/* In the future this will reflect actual on-chain LP position performance */}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-emerald-800">Investment Portfolio</span>
                      <Badge variant="outline" className="text-[11px] bg-emerald-100 text-emerald-700 border-emerald-300">
                        0.00  go% APY*
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Allocated</span>
                      <span className="text-right font-medium tabular-nums">
                        {allocation ? formatG$(allocation.investAmount.toString()) : '—'} G$
                      </span>
                      <span className="text-muted-foreground">Shares</span>
                      <span className="text-right font-medium tabular-nums">
                        {(unlockedShares + lockedSharesAmt).toFixed(4)}
                      </span>
                      <span className="text-muted-foreground">Share Price</span>
                      <span className="text-right font-medium tabular-nums">{ppsNum.toFixed(4)} G$</span>
                      <span className="text-muted-foreground">Est. Value</span>
                      <span className="text-right font-medium tabular-nums">{totalValueG$.toFixed(2)} G$</span>
                    </div>
                  </div>

                  {/* PLACEHOLDER: Investment withdrawal request form */}
                  {/* In the future this will trigger on-chain requestWithdrawal() on the treasury */}
                  <InvestmentWithdrawForm allocation={allocation} />

                </CollapsibleContent>
              </Collapsible>
            </div>

          </div>
      </SidebarContent>
    </Sidebar>
  )
}

// PLACEHOLDER: Investment withdrawal request sub-component
// In the future this will trigger on-chain requestWithdrawal() via treasury contract.
// For now it simply enqueues a request in the backend DB.
function InvestmentWithdrawForm({ allocation }: { allocation: { investAmount: bigint } | null }) {
  const maxInvest = allocation ? Number(allocation.investAmount) / 1e18 : 0
  const [amount, setAmount] = React.useState("")
  const { mutate: submitRequest, isPending: isSubmitting, isSuccess: submitSuccess } = useRequestInvestmentWithdrawal()
  const { data: requests = [], isLoading: loadingReqs } = useGetInvestmentRequests()

  const handleSubmit = () => {
    const num = Number.parseFloat(amount)
    if (!num || num <= 0) return
    submitRequest(amount, {
      onSuccess: () => {
        setAmount("")
        toast.success("Withdrawal request submitted")
      },
      onError: (e) => {
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1 block">Amount to withdraw (G$)</label>
          <div className="relative">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              type="number"
              className="h-9 text-sm pr-12"
            />
            <button
              type="button"
              onClick={() => setAmount(maxInvest > 0 ? maxInvest.toString() : "0")}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 px-1.5 py-0.5 rounded"
            >
              Max
            </button>
          </div>
        </div>
        <Button
          size="xs"
          className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
          onClick={handleSubmit}
          disabled={isSubmitting || !amount || Number.parseFloat(amount) <= 0}
        >
          {isSubmitting ? (
            <><LoaderCircle className="size-3.5 animate-spin mr-1" /> Submitting...</>
          ) : (
            "Request Withdrawal"
          )}
        </Button>
      </div>

      {submitSuccess && (
        <p className="text-xs text-emerald-600">Request submitted! It will be processed shortly.</p>
      )}

      {/* Pending withdrawal requests */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Pending requests</span>
        {loadingReqs ? (
          <span className="text-xs text-muted-foreground">Loading...</span>
        ) : requests.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">No pending requests</span>
        ) : (
          requests.slice(0, 5).map((r: { id: number; amountG: string; status: string; createdAt: string }) => (
            <div key={r.id} className="flex items-center justify-between text-xs">
              <span className="font-medium tabular-nums">{Number(r.amountG).toFixed(2)} G$</span>
              <span className={`flex items-center gap-1 ${
                r.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {r.status === 'completed' ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <Clock className="size-3" />
                )}
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
