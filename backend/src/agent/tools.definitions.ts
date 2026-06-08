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
      description: "Get the user's treasury position: shares, locked/unlocked value, deposited, withdrawn, PnL",
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
      description: "Get treasury summary: total assets, idle assets, deployed assets, reserved assets, price per share, total shares, accrued fees, active positions, 24h changes",
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
      description: "Get the top 100 leaderboard with rankings, tier, points, streaks",
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
      description: "Get info about the user's daily UBI claim entitlement",
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
      description: "Estimate the impact of withdrawing a given amount on the user's streak, tier, and points",
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
