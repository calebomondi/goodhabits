import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useQuery, useMutation } from "@tanstack/react-query"
import { formatUnits, parseUnits } from "viem"
import { TREASURY_ABI, getTreasuryAddress } from "./contract"
import { toast } from "sonner";

// ─── Token addresses on Celo mainnet ────────────────────────────────
export const TOKENS = {
  G$:   "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as const,
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438" as const,
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const,
  USDC: "0x37f750B7cC259A2f741AF45294f6a16572CF5cAd" as const,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5" as const,
} as const

// ─── Minimal ERC20 ABI ──────────────────────────────────────────────
export const ERC20_ABI = [
  {
    type: "function" as const,
    name: "balanceOf",
    inputs: [{ type: "address" as const }],
    outputs: [{ type: "uint256" as const }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" as const }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "allowance",
    inputs: [{ type: "address" as const }, { type: "address" as const }],
    outputs: [{ type: "uint256" as const }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "approve",
    inputs: [
      { type: "address" as const, name: "spender" },
      { type: "uint256" as const, name: "amount" },
    ],
    outputs: [{ type: "bool" as const }],
    stateMutability: "nonpayable" as const,
  },
]

// ─── useTokenBalance ────────────────────────────────────────────────
export function useTokenBalance(
  tokenAddress: `0x${string}`,
  userAddress?: `0x${string}`,
) {
  const { data: raw, isLoading, isError, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })

  const { data: decimalsRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
  })

  const decimals = decimalsRaw !== undefined ? Number(decimalsRaw) : 18

  const balance =
    raw !== undefined ? Number(formatUnits(raw, decimals)) : null

  return { balance, raw, decimals, isLoading, isError, refetch }
}

// ─── useTokenPrice ──────────────────────────────────────────────────
export function useTokenPrice(tokenAddress: `0x${string}`) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tokenPrice", tokenAddress],
    queryFn: async () => {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      )
      const json: {
        pairs?: { chainId: string; priceUsd: string }[]
      } = await res.json()
      const celoPairs = (json.pairs ?? []).filter(
        (p) => p.chainId === "celo",
      )
      if (celoPairs.length === 0) return null
      const prices = celoPairs
        .map((p) => Number.parseFloat(p.priceUsd))
        .filter((v) => !Number.isNaN(v) && v > 0)
      if (prices.length === 0) return null
      return prices.reduce((a, b) => a + b, 0) / prices.length
    },
    staleTime: 60_000,
    retry: 2,
  })

  return { priceUsd: data ?? null, isLoading, isError }
}

// ─── useTokenInfo ───────────────────────────────────────────────────
export function useTokenInfo(
  tokenAddress: `0x${string}`,
  userAddress?: `0x${string}`,
) {
  const balance = useTokenBalance(tokenAddress, userAddress)
  const price = useTokenPrice(tokenAddress)

  const valueUsd =
    balance.balance !== null && price.priceUsd !== null
      ? balance.balance * price.priceUsd
      : null

  const isLoading = balance.isLoading || price.isLoading
  const isError = balance.isError || price.isError

  return {
    ...balance,
    ...price,
    valueUsd,
    isLoading,
    isError,
  }
}

// ─── useHasUserSetStrategy ───────────────────────────────────────────
export function useHasUserSetStrategy(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "hasUserSetStrategy",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  return { hasSetStrategy: data ?? null, isLoading, isError } as const
}

// ─── useGetUserHabit ─────────────────────────────────────────────────
export function useGetUserHabit(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "getUserHabit",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  const habit =
    data && typeof data === "object" && "toSpend" in data && "toSave" in data && "toInvest" in data
      ? { toSpend: data.toSpend as bigint, toSave: data.toSave as bigint, toInvest: data.toInvest as bigint }
      : null
  return { habit, isLoading, isError } as const
}

// ─── useGetUserAllocation ──────────────────────────────────────────────
export function useGetUserAllocation(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError, refetch } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "getUserAllocation",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  const allocation =
    data && typeof data === "object" && "spendAmount" in data && "saveAmount" in data && "investAmount" in data
      ? { spendAmount: data.spendAmount as bigint, saveAmount: data.saveAmount as bigint, investAmount: data.investAmount as bigint }
      : null
  return { allocation, isLoading, isError, refetch } as const
}

// ─── useDeposit ──────────────────────────────────────────────────────
export function useDeposit(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending: isWritePending, isError: isWriteError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const deposit = (amountInWei: bigint) => {
    try {
        writeContract({
        address: treasuryAddress,
        abi: TREASURY_ABI,
        functionName: "deposit",
        args: [amountInWei],
        })
    } catch (e) {
      console.error("Failed to initiate deposit:", e)
      toast.error(`${e instanceof Error ? e.message : "An unknown error occurred while initiating the deposit."}`)
    }
  }
  return { deposit, hash, isWritePending, isWriteError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useWithdraw ─────────────────────────────────────────────────────
export function useWithdraw(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })

  const withdraw = (amount: bigint, bucket: "spendable" | "savings") => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: bucket === "spendable" ? "withdrawSpendable" : "withdrawSavings",
      args: [amount],
    })
  }

  return { withdraw, hash, isPending, isError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useSetHabitStrategy ─────────────────────────────────────────────
export function useSetHabitStrategy(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending: isWritePending, isError: isWriteError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const setStrategy = (toSpend: bigint, toSave: bigint, toInvest: bigint) => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "setHabitStrategy",
      args: [toSpend, toSave, toInvest],
    })
  }
  return { setStrategy, hash, isWritePending, isWriteError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useTargetSavingsUnlock ──────────────────────────────────────────
export function useTargetSavingsUnlock(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError, refetch } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "targetSavingsUnlock",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  return { unlockTimestamp: data ?? null, isLoading, isError, refetch } as const
}

// ─── useBrokeHabits ──────────────────────────────────────────────────
export function useBrokeHabits(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError, refetch } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "brokeHabits",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  const brokeHabitsData =
    data && typeof data === "object" && "savings" in data && "investments" in data
      ? { savings: data.savings as bigint, investments: data.investments as bigint }
      : null
  return { brokeHabits: brokeHabitsData, isLoading, isError, refetch } as const
}

// ─── useSetTargetSavingsUnlock ───────────────────────────────────────
export function useSetTargetSavingsUnlock(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending: isWritePending, isError: isWriteError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const setLock = (timestamp: bigint) => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "setTargetSavingsUnlock",
      args: [timestamp],
    })
  }
  return { setLock, hash, isWritePending, isWriteError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useAllowance ────────────────────────────────────────────────────
export function useAllowance(
  tokenAddress: `0x${string}`,
  ownerAddress?: `0x${string}`,
  spenderAddress?: `0x${string}`,
) {
  const { data, isLoading, isError, refetch } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: ownerAddress && spenderAddress ? [ownerAddress, spenderAddress] : undefined,
    query: { enabled: !!ownerAddress && !!spenderAddress },
  })
  return { allowance: data !== undefined ? (data as bigint) : BigInt(0), isLoading, isError, refetch } as const
}

// ─── useApprove ──────────────────────────────────────────────────────
export function useApprove(tokenAddress: `0x${string}`, spenderAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending: isWritePending, isError: isWriteError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const approve = (amount: bigint) => {
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spenderAddress, amount],
    })
  }
  return { approve, hash, isWritePending, isWriteError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useGetUserPosition ──────────────────────────────────────────────
export type UserPosition = {
  unlockedShares: bigint
  lockedShares: bigint
  ownershipBps: bigint
  unlockedValue: bigint
  totalValue: bigint
  deposited: bigint
  withdrawn: bigint
  pnl: bigint
}

export function useGetUserPosition(userAddress?: `0x${string}`, chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { data, isLoading, isError, refetch } = useReadContract({
    address: treasuryAddress,
    abi: TREASURY_ABI,
    functionName: "getUserPosition",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  })
  const position =
    data && typeof data === "object"
      ? {
          unlockedShares: (data as any).unlockedShares as bigint,
          lockedShares: (data as any).lockedShares as bigint,
          ownershipBps: (data as any).ownershipBps as bigint,
          unlockedValue: (data as any).unlockedValue as bigint,
          totalValue: (data as any).totalValue as bigint,
          deposited: (data as any).deposited as bigint,
          withdrawn: (data as any).withdrawn as bigint,
          pnl: (data as any).pnl as bigint,
        }
      : null
  return { position, isLoading, isError, refetch } as const
}

// ─── useGetSummary ───────────────────────────────────────────────────
export type Summary = {
  totalAssets: string
  idleAssets: string
  deployedAssets: string
  reservedAssets: string
  pricePerShare: string
  totalShares: string
  accruedFees: string
  activePositions: number
  ppsChange24h: number
  assetsChange24h: number
  totalAssetsUsd: string | null
  idleAssetsUsd: string | null
  deployedAssetsUsd: string | null
  reservedAssetsUsd: string | null
  accruedFeesUsd: string | null
}

export function useGetSummary() {
  return useQuery<Summary>({
    queryKey: ["analytics", "summary"],
    queryFn: () => fetch("/api/analytics/summary").then((r) => r.json()),
    staleTime: 30_000,
    retry: 2,
  })
}

// ─── useGetWithdrawalRequests ────────────────────────────────────────
export type WithdrawalRequest = {
  id: string
  sharesLocked: string
  assetsQuoted: string
  user: string
  createdAt: number
  status: number // 0=Pending, 1=Ready, 2=Processed, 3=Cancelled
}

export function useGetWithdrawalRequests(userAddress?: `0x${string}`, refetchInterval = 15_000) {
  return useQuery<WithdrawalRequest[]>({
    queryKey: ["treasury", "requests", userAddress],
    queryFn: () =>
      fetch(`/api/treasury/users/${userAddress}/requests`).then((r) => r.json()),
    enabled: !!userAddress,
    refetchInterval,
  })
}

// ─── useRequestWithdrawal ────────────────────────────────────────────
export function useRequestWithdrawal(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const requestWithdrawal = (shares: bigint) => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "requestWithdrawal",
      args: [shares],
    })
  }
  return { requestWithdrawal, hash, isPending, isError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useFinalizeWithdrawal ───────────────────────────────────────────
export function useFinalizeWithdrawal(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const finalizeWithdrawal = (requestId: bigint) => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "finalizeWithdrawal",
      args: [requestId],
    })
  }
  return { finalizeWithdrawal, hash, isPending, isError, writeError: error, isConfirming, isConfirmed } as const
}

// ─── useCancelWithdrawal ─────────────────────────────────────────────
export function useCancelWithdrawal(chainId?: number) {
  const treasuryAddress = getTreasuryAddress(chainId)
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  const cancelWithdrawal = (requestId: bigint) => {
    writeContract({
      address: treasuryAddress,
      abi: TREASURY_ABI,
      functionName: "cancelWithdrawalRequest",
      args: [requestId],
    })
  }
  return { cancelWithdrawal, hash, isPending, isError, writeError: error, isConfirming, isConfirmed } as const
}

// PLACEHOLDER: Investment hooks
// These interact with the backend DB-backed withdrawal request queue.
// In the future they will trigger on-chain requestWithdrawal().

export function useRequestInvestmentWithdrawal() {
  const { address } = useAccount()

  return useMutation({
    mutationFn: async (amountG: string) => {
      const res = await fetch('/api/investment/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: address, amountG }),
      })
      if (!res.ok) throw new Error('Failed to create investment withdrawal request')
      return res.json()
    },
  })
}

export function useGetInvestmentRequests() {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['investment-requests', address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`/api/investment/requests?user=${address}`)
      if (!res.ok) throw new Error('Failed to fetch investment requests')
      return res.json()
    },
    enabled: !!address,
    refetchInterval: 30_000,
  })
}
