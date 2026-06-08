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
