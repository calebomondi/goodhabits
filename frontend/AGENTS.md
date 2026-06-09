<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Withdrawal Flow (Investments)

When a user clicks **"Request Withdrawal"**, it creates a withdrawal request on the treasury contract. Once the transaction confirms, the sidebar refreshes automatically to show the updated request list.

**Status depends on how much G$ the treasury has:**
- If the treasury has enough G$ to cover the withdrawal → the request is marked **Ready** immediately and can be finalized right away.
- If not enough liquidity → the request stays **Pending** until more G$ becomes available, then changes to **Ready**.

Once a request is **Ready**, the user can click **Finalize** (or **Finalize & Offramp**) to complete the withdrawal and receive G$ to their wallet.

<!-- BEGIN:investment-section -->
## How the Investment Section Works

The investment section (Section 4 in the sidebar) shows what happens to the "invest" portion of a user's habit strategy. When a user sets their habit strategy (e.g. 70% spend, 20% save, 10% invest), that 10% is set aside for automated investing.

**What happens with the invest portion:**
- The backend automatically swaps half the invested G$ into cUSD and deposits both into a Uniswap V3 liquidity pool to earn trading fees.
- This means the invested funds are actively deployed, not sitting idle.

**Why investment withdrawals take time:**
- Unlike regular withdrawals (which pull G$ directly from the treasury), investment withdrawals need the backend to:
  1. Pull the liquidity out of the Uniswap pool
  2. Swap the cUSD back to G$
  3. Then make the G$ available
- This is why withdrawal requests go into a queue (DB-backed) instead of being processed instantly — it's an async background process.

**What the user sees in the UI:**
- **Allocated** — how much G$ has been directed to investing so far
- **Shares / Share Price / Est. Value** — the user's portion of the investment pool and its current worth
- **~12.5% APY badge** — hardcoded placeholder; will reflect real LP fee earnings in the future

**Key files:** `frontend/components/app-sidebar-left.tsx` (lines ~985-1040), `frontend/lib/hooks.ts` (`useRequestInvestmentWithdrawal`, `useGetInvestmentRequests`), `backend/src/investment/`, `backend/src/drizzle/schema/investment-requests.ts`
<!-- END:investment-section -->
