export interface ToolDefinition {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_user_position",
      description: "[REAL-TIME on-chain] Get the user's treasury position: shares, locked/unlocked value, deposited, withdrawn, PnL. Call this for questions about position, balance, PnL, how much deposited/withdrawn.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address of the user" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_allocation",
      description: "[REAL-TIME on-chain] Get the user's current allocation breakdown: spendable amount, savings amount, and invested amount. Call this for questions about how much is in each bucket, spendable balance, savings balance, invested balance.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address of the user" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_habits",
      description: "[REAL-TIME on-chain] Get the user's habit strategy percentages: toSpend, toSave, toInvest. Call this for questions about their habit strategy or allocation percentages.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address of the user" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_g$_balance",
      description: "[REAL-TIME on-chain] Get the user's G$ token wallet balance. Call this for questions about how many G$ tokens are in their wallet or token balance.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address of the user" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_treasury_summary",
      description: "[REAL-TIME on-chain] Get treasury summary: total assets, idle assets, deployed assets, reserved assets, price per share, total shares, accrued fees, active positions, 24h changes.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_leaderboard",
      description: "[REAL-TIME] Get the top 100 leaderboard with rankings, tier, points, streaks. Call this for questions about rank, tier, leaderboard position.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "User's address to find their rank" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_claim_info",
      description: "[INFORMATIONAL] Get info about the user's daily UBI claim entitlement",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Wallet address" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "simulate_withdrawal_impact",
      description: "[SIMULATION] Estimate the impact of withdrawing a given amount on the user's streak, tier, and points.",
      parameters: {
        type: "object",
        properties: {
          currentStreak: { type: "number", description: "Current streak days" },
          currentPoints: { type: "number", description: "Current points" },
          withdrawAmount: { type: "number", description: "Amount to withdraw in G$" },
          totalSaved: { type: "number", description: "Total saved in G$" },
        },
        required: ["currentStreak", "currentPoints", "withdrawAmount", "totalSaved"],
      },
    },
  },
]
