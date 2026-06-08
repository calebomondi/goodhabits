const TOPIC_KEYWORDS = [
  "ubi", "claim", "treasury", "save", "saving", "savings",
  "withdraw", "withdrawal", "habit", "strategy", "tier", "rank",
  "leaderboard", "position", "pnl", "g$", "gooddollar",
  "streak", "deposit", "invest", "spend", "allocation",
  "fee", "yield", "apr", "nav", "price per share", "pps",
  "unlocked", "locked", "share", "portfolio", "balance",
  "entitlement", "ubi claim", "daily ubi",
  "what is", "how does", "explain", "tell me about",
  "how it works", "what is gooddollar", "what is ubi",
  "universal basic income", "founder", "mission", "token",
  "protocol", "defi", "decentralized",
  "goodhabit", "compound", "reinvest", "liquidity", "pool",
  "passive", "income", "budget", "goal", "split", "deploy",
  "how do i", "how can i", "help me",
  "offramp", "cash out", "convert",
]

export function isOnTopic(message: string): boolean {
  const lower = message.toLowerCase()
  return TOPIC_KEYWORDS.some((k) => lower.includes(k))
}
