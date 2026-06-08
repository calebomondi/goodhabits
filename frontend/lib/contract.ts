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
