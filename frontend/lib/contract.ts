export const TREASURY_ABI = [
  // ── User-facing state-mutating ──
  {
    type: "function" as const,
    name: "deposit",
    inputs: [{ type: "uint256", name: "amount" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "requestWithdrawal",
    inputs: [{ type: "uint256", name: "shares" }],
    outputs: [{ type: "uint256", name: "requestId" }],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "cancelWithdrawalRequest",
    inputs: [{ type: "uint256", name: "requestId" }],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "finalizeWithdrawal",
    inputs: [{ type: "uint256", name: "requestId" }],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "setHabitStrategy",
    inputs: [
      { type: "uint256", name: "toSpend" },
      { type: "uint256", name: "toSave" },
      { type: "uint256", name: "toInvest" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },

  // ── Read-only views ──
  {
    type: "function" as const,
    name: "hasUserSetStrategy",
    inputs: [{ type: "address", name: "user" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "getUserHabit",
    inputs: [{ type: "address", name: "user" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "toSpend" },
          { type: "uint256", name: "toSave" },
          { type: "uint256", name: "toInvest" },
        ],
      },
    ],
    stateMutability: "view" as const,
  },

  {
    type: "function" as const,
    name: "getUserAllocation",
    inputs: [{ type: "address", name: "user" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "spendAmount" },
          { type: "uint256", name: "saveAmount" },
          { type: "uint256", name: "investAmount" },
        ],
      },
    ],
    stateMutability: "view" as const,
  },

  // ── Investment positions ──
  {
    type: "function" as const,
    name: "getUserPosition",
    inputs: [{ type: "address", name: "user" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "unlockedShares" },
          { type: "uint256", name: "lockedShares" },
          { type: "uint256", name: "ownershipBps" },
          { type: "uint256", name: "unlockedValue" },
          { type: "uint256", name: "totalValue" },
          { type: "uint256", name: "deposited" },
          { type: "uint256", name: "withdrawn" },
          { type: "int256", name: "pnl" },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "getWithdrawalRequest",
    inputs: [{ type: "uint256", name: "requestId" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "id" },
          { type: "uint256", name: "sharesLocked" },
          { type: "uint256", name: "assetsQuoted" },
          { type: "address", name: "user" },
          { type: "uint40", name: "createdAt" },
          { type: "uint8", name: "status" },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "activeRequestCount",
    inputs: [{ type: "address", name: "user" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "nextWithdrawalId",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "pricePerShare",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "previewWithdraw",
    inputs: [{ type: "uint256", name: "shareAmount" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "calculateTotalAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "accruedFees",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "feeBps",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "deployedAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "reservedAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "availableLiquidity",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },

  // ── Savings / lockup ──
  {
    type: "function" as const,
    name: "targetSavingsUnlock",
    inputs: [{ type: "address", name: "user" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "brokeHabits",
    inputs: [{ type: "address", name: "user" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { type: "uint256", name: "savings" },
          { type: "uint256", name: "investments" },
        ],
      },
    ],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "setTargetSavingsUnlock",
    inputs: [{ type: "uint256", name: "timestamp" }],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "withdrawSpendable",
    inputs: [{ type: "uint256", name: "amount" }],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
  {
    type: "function" as const,
    name: "withdrawSavings",
    inputs: [{ type: "uint256", name: "amount" }],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
] as const

const chainAddresses: Record<number, `0x${string}`> = {
  42220: process.env.NEXT_PUBLIC_TREASURY_CONTRACT as `0x${string}`,
  122: "0x0000000000000000000000000000000000000000",
  50: "0x0000000000000000000000000000000000000000",
}

export function getTreasuryAddress(chainId?: number): `0x${string}` {
  if (chainId && chainAddresses[chainId]) return chainAddresses[chainId]
  return "0x0000000000000000000000000000000000000000" as `0x${string}`
}
