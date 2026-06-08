// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IGoodHabitsTreasury
/// @notice Interface for the GoodHabits treasury vault contract.
/// @dev Defines all external functions, structs, enums, and events for the share-based
///      vault that manages G$ deposits, withdrawal requests, and LP position accounting.
interface IGoodHabitsTreasury {
    // ============================================================
    // ENUMS & STRUCTS
    // ============================================================

    /// @notice Source-of-funds tag for withdrawal events.
    /// @param Spendable  Withdrew from spendable allocation.
    /// @param Savings    Withdrew from savings allocation.
    /// @param Investment Withdrew from investment (share-based) allocation.
    enum WithdrawFrom { Spendable, Savings, Investment }

    /// @notice Lifecycle status of a withdrawal request.
    /// @param Pending   Awaiting liquidity sourcing by the backend.
    /// @param Ready     Liquidity is available, ready to finalize.
    /// @param Processed Shares burned and G$ transferred.
    /// @param Cancelled Request cancelled, shares returned.
    enum WithdrawalStatus { Pending, Ready, Processed, Cancelled }

    /// @notice User's habit allocation in basis points.
    /// @param toSpend  Percentage allocated for spending (0-10000 bps).
    /// @param toSave   Percentage allocated for saving (0-10000 bps).
    /// @param toInvest Percentage allocated for investing (0-10000 bps).
    /// @dev Sum must equal 10000 (100%).
    struct Habit {
        uint256 toSpend;
        uint256 toSave;
        uint256 toInvest;
    }

    /// @notice Tracked G$ balances per allocation bucket.
    /// @param spendAmount  G$ available for spending.
    /// @param saveAmount   G$ available for savings withdrawal.
    /// @param investAmount G$ invested (minted as shares).
    struct UserAllocation {
        uint256 spendAmount;
        uint256 saveAmount;
        uint256 investAmount;
    }

    /// @notice Broke-habit tracking counters.
    /// @param savings      Times savings streak was broken.
    /// @param investments  Times investment streak was broken.
    struct BrokeHabit {
        uint256 savings;
        uint256 investments;
    }

    /// @notice Data for a single withdrawal request.
    /// @param id           Unique request identifier.
    /// @param sharesLocked Amount of shares locked by the user.
    /// @param assetsQuoted G$ value quoted at request creation.
    /// @param user         Request creator.
    /// @param createdAt    Creation timestamp.
    /// @param status       Current lifecycle status.
    struct WithdrawalRequest {
        uint256 id;
        uint256 sharesLocked;
        uint256 assetsQuoted;
        address user;
        uint40 createdAt;
        WithdrawalStatus status;
    }

    /// @notice Data for a tracked LP position.
    /// @param tokenId   Position identifier (e.g. Uniswap NFT token ID).
    /// @param value     Most recently synced G$ value.
    /// @param createdAt Registration timestamp.
    /// @param active    Whether the position is still active.
    struct Position {
        uint256 tokenId;
        uint256 value;
        uint40 createdAt;
        bool active;
    }

    /// @notice Aggregated treasury position for a user.
    /// @param shares        Unlocked share balance.
    /// @param lockedShares  Shares locked in withdrawal requests.
    /// @param ownershipBps  Proportion of active shares held (basis points).
    /// @param currentValue  G$ value of all user shares (locked + unlocked).
    /// @param deposited     Lifetime G$ deposited.
    /// @param withdrawn     Lifetime G$ withdrawn (finalized only).
    /// @param pnl           Realised + unrealised profit or loss.
    struct UserPosition {
        uint256 shares;
        uint256 lockedShares;
        uint256 ownershipBps;
        uint256 currentValue;
        uint256 deposited;
        uint256 withdrawn;
        int256 pnl;
    }

    // ============================================================
    // ROLES
    // ============================================================

    /// @notice Role for managing LP positions and withdrawal lifecycle.
    function STRATEGY_ROLE() external view returns (bytes32);

    /// @notice Role for updating off-chain position valuations.
    function SYNC_ROLE() external view returns (bytes32);

    // ============================================================
    // ASSET
    // ============================================================

    /// @notice The G$ ERC-20 token managed by this treasury.
    function gDollar() external view returns (IERC20);

    // ============================================================
    // SHARE ACCOUNTING
    // ============================================================

    /// @notice Total minted shares in circulation (including locked).
    function totalShares() external view returns (uint256);

    /// @notice Total shares locked across all withdrawal requests.
    function totalLockedShares() external view returns (uint256);

    // ============================================================
    // ASSET ACCOUNTING
    // ============================================================

    /// @notice G$ held idle (not deployed to any strategy). Only tracks the invest portion of deposits.
    function assetsToInvest() external view returns (uint256);

    /// @notice G$ reserved for outstanding withdrawal requests.
    function reservedAssets() external view returns (uint256);

    // ============================================================
    // PER-USER ACCOUNTING
    // ============================================================

    /// @notice Unlocked share balance for a user.
    function shares(address user) external view returns (uint256);

    /// @notice Locked share balance for a user.
    function userLockedShares(address user) external view returns (uint256);

    /// @notice Lifetime G$ deposited by a user.
    function lifetimeDeposited(address user) external view returns (uint256);

    /// @notice Lifetime G$ withdrawn by a user (finalized requests only).
    function lifetimeWithdrawn(address user) external view returns (uint256);

    // ============================================================
    // WITHDRAWAL REQUESTS
    // ============================================================

    /// @notice Next available withdrawal request ID.
    function nextWithdrawalId() external view returns (uint256);

    /// @notice Returns full data for a withdrawal request.
    /// @param requestId The request ID.
    /// @return The WithdrawalRequest struct.
    function withdrawalRequests(uint256 requestId) external view returns (WithdrawalRequest memory);

    // ============================================================
    // POSITIONS
    // ============================================================

    /// @notice Returns full data for a registered LP position.
    /// @param tokenId The position token ID.
    /// @return The Position struct.
    function positions(uint256 tokenId) external view returns (Position memory);

    // ============================================================
    // STRATEGY REGISTRY
    // ============================================================

    /// @notice Whether a strategy address is whitelisted.
    function approvedStrategies(address strategy) external view returns (bool);

    // ============================================================
    // DEPOSITS
    // ============================================================

    /// @notice Deposits G$ and mints corresponding shares.
    /// @param assets Amount of G$ to deposit.
    function deposit(uint256 assets) external;

    /// @notice Deploys idle G$ to a whitelisted strategy.
    function deployToStrategy(address strategy, uint256 amount) external;

    /// @notice Receives returned G$ from a strategy (reduces deployed amount).
    function receiveFromStrategy(uint256 amount) external;

    /// @notice Collects protocol fees from NAV growth.
    function collectFees() external;

    /// @notice Claims accrued fees to a recipient (admin only).
    function claimFees(address recipient) external;

    // ============================================================
    // HABIT STRATEGY
    // ============================================================

    /// @notice Sets the user's habit allocation (must sum to 10000 bps).
    function setHabitStrategy(uint256 toSpend, uint256 toSave, uint256 toInvest) external;

    /// @notice Sets a timestamp before which savings withdrawals increment the broke-habit counter.
    function setTargetSavingsUnlock(uint256 timestamp) external;

    // ============================================================
    // HABIT WITHDRAWALS
    // ============================================================

    /// @notice Withdraws G$ from the user's spendable allocation.
    function withdrawSpendable(uint256 amount) external;

    /// @notice Withdraws G$ from the user's savings allocation.
    /// @dev Increments brokeHabits.savings if before targetSavingsUnlock.
    function withdrawSavings(uint256 amount) external;

    // ============================================================
    // HABIT VIEWS
    // ============================================================

    /// @notice Returns the user's habit strategy.
    function getUserHabit(address user) external view returns (Habit memory);

    /// @notice Returns the user's current spend/save/invest allocation.
    function getUserAllocation(address user) external view returns (UserAllocation memory);

    /// @notice Returns the user's broke-habit counters.
    function brokeHabits(address user) external view returns (BrokeHabit memory);

    /// @notice Returns the timestamp before which savings withdrawals increment broke-habit.
    function targetSavingsUnlock(address user) external view returns (uint256);

    // ============================================================
    // PUBLIC VIEWS (auto‑generated getters)
    // ============================================================

    /// @notice Total deployed G$ (sum of position values).
    function totalDeployed() external view returns (uint256);

    /// @notice Amount of G$ deployed to a specific strategy.
    function deployedToStrategy(address strategy) external view returns (uint256);

    /// @notice Maximum active withdrawal requests per user.
    function maxActiveRequests() external view returns (uint256);

    /// @notice Withdrawal request timeout in seconds.
    function requestTimeout() external view returns (uint256);

    /// @notice Protocol fee in basis points.
    function feeBps() external view returns (uint256);

    /// @notice Unclaimed protocol fees.
    function unclaimedFees() external view returns (uint256);

    /// @notice Last fee snapshot timestamp / total-assets checkpoint.
    function lastFeeSnapshot() external view returns (uint256);

    // ============================================================
    // NAV ACCOUNTING
    // ============================================================

    /// @notice Returns total G$ under management (idle + active positions).
    /// @return Total assets in G$.
    function calculateTotalAssets() external view returns (uint256);

    /// @notice Returns unreserved idle G$ available for new withdrawals.
    /// @return Available liquidity in G$.
    function availableLiquidity() external view returns (uint256);

    /// @notice Returns the current share price in G$ (18 decimals).
    /// @return Price per share.
    function pricePerShare() external view returns (uint256);

    /// @notice Previews shares that would be minted for a given deposit.
    /// @param assets G$ amount to preview.
    /// @return Shares that would be minted.
    function previewDeposit(uint256 assets) external view returns (uint256);

    /// @notice Previews G$ that would be returned for a given share amount.
    /// @param shareAmount Shares to preview.
    /// @return G$ value at current NAV.
    function previewWithdraw(uint256 shareAmount) external view returns (uint256);

    // ============================================================
    // WITHDRAWAL REQUEST LIFECYCLE
    // ============================================================

    /// @notice Creates a withdrawal request, locking shares and reserving G$.
    /// @param shareAmount Shares to redeem.
    function requestWithdrawal(uint256 shareAmount) external;

    /// @notice Transitions a request from Pending to Ready (STRATEGY_ROLE).
    /// @param requestId Request ID to mark ready.
    function markWithdrawalReady(uint256 requestId) external;

    /// @notice Finalizes a Ready request: burns shares, transfers G$ to user.
    /// @param requestId Request ID to finalize.
    function finalizeWithdrawal(uint256 requestId) external;

    /// @notice Cancels a Pending request: returns shares, releases reservation.
    /// @param requestId Request ID to cancel.
    function cancelWithdrawal(uint256 requestId) external;

    // ============================================================
    // POSITION REGISTRY
    // ============================================================

    /// @notice Registers a new LP position.
    /// @param tokenId      Position token ID.
    /// @param initialValue Initial G$ value.
    function registerPosition(uint256 tokenId, uint256 initialValue) external;

    /// @notice Marks a position as closed (excluded from NAV).
    /// @param tokenId Position token ID.
    function closePosition(uint256 tokenId) external;

    /// @notice Updates a position's G$ valuation (SYNC_ROLE).
    /// @param tokenId Position token ID.
    /// @param value   New G$ value.
    function updatePositionValue(uint256 tokenId, uint256 value) external;

    /// @notice Returns all registered position IDs.
    /// @return Array of token IDs.
    function getActivePositionIds() external view returns (uint256[] memory);

    /// @notice Returns full data for a single position.
    /// @param tokenId Position token ID.
    /// @return Position struct.
    function getPosition(uint256 tokenId) external view returns (Position memory);

    // ============================================================
    // STRATEGY REGISTRY
    // ============================================================

    /// @notice Whitelists a strategy contract.
    /// @param strategy Strategy address.
    function approveStrategy(address strategy) external;

    /// @notice Removes a strategy from the whitelist.
    /// @param strategy Strategy address.
    function removeStrategy(address strategy) external;

    // ============================================================
    // USER VIEWS
    // ============================================================

    /// @notice Returns a comprehensive position summary for a user.
    /// @param user User address.
    /// @return UserPosition struct.
    function getUserPosition(address user) external view returns (UserPosition memory);

    // ============================================================
    // ADMIN
    // ============================================================

    /// @notice Pauses deposits and new withdrawal requests.
    function pause() external;

    /// @notice Unpauses deposits and new withdrawal requests.
    function unpause() external;

    /// @notice Updates the protocol fee (admin only).
    function setFeeBps(uint256 newFeeBps) external;

    /// @notice Updates the withdrawal request timeout (admin only).
    function setRequestTimeout(uint256 newTimeout) external;

    /// @notice Rescues non-G$ tokens accidentally sent to the contract.
    function rescueToken(address token, address recipient, uint256 amount) external;

    /// @notice Returns a withdrawal request by ID.
    function getWithdrawalRequest(uint256 requestId) external view returns (WithdrawalRequest memory);

    // ============================================================
    // EVENTS
    // ============================================================

    /// @notice Emitted when a user deposits G$ and receives shares.
    event Deposit(address indexed user, uint256 assets, uint256 mintedShares);

    /// @notice Emitted when a user withdraws from spendable or savings allocation.
    event Withdraw(address indexed user, uint256 amount, WithdrawFrom from);

    /// @notice Emitted when G$ is deployed to a strategy.
    event DeployedToStrategy(address indexed strategy, uint256 amount);

    /// @notice Emitted when G$ is returned from a strategy.
    event ReceivedFromStrategy(address indexed strategy, uint256 amount);

    /// @notice Emitted when protocol fees are accrued on NAV growth.
    event FeesCollected(uint256 yieldDelta, uint256 feeAmount);

    /// @notice Emitted when fees are claimed by admin.
    event FeesClaimed(address indexed recipient, uint256 amount);

    /// @notice Emitted when the protocol fee rate changes.
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when the withdrawal request timeout changes.
    event RequestTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);

    /// @notice Emitted when a non-G$ token is rescued.
    event TokenRescued(address indexed token, address indexed recipient, uint256 amount);

    /// @notice Emitted when a withdrawal request is created.
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, uint256 sharesLocked, uint256 assetsQuoted);

    /// @notice Emitted when a request transitions from Pending to Ready.
    event WithdrawalReady(uint256 indexed requestId);

    /// @notice Emitted when a Ready request is finalized and G$ is transferred.
    event WithdrawalFinalized(uint256 indexed requestId, address indexed user, uint256 assets);

    /// @notice Emitted when a Pending request is cancelled.
    event WithdrawalCancelled(uint256 indexed requestId, address indexed user);

    /// @notice Emitted when shares are moved from a user to the locked pool.
    event SharesLocked(address indexed user, uint256 amount);

    /// @notice Emitted when locked shares are returned to a user.
    event SharesUnlocked(address indexed user, uint256 amount);

    /// @notice Emitted when G$ are reserved for a withdrawal request.
    event AssetsReserved(uint256 assets);

    /// @notice Emitted when reserved G$ are released (finalize or cancel).
    event AssetsReleased(uint256 assets);

    /// @notice Emitted when a new LP position is registered.
    event PositionRegistered(uint256 indexed tokenId, uint256 initialValue);

    /// @notice Emitted when an LP position is closed.
    event PositionClosed(uint256 indexed tokenId, uint256 returnedAssets);

    /// @notice Emitted when a position's valuation is updated.
    event PositionValueUpdated(uint256 indexed tokenId, uint256 oldValue, uint256 newValue);

    /// @notice Emitted when a strategy is whitelisted.
    event StrategyApproved(address indexed strategy);

    /// @notice Emitted when a strategy is removed from the whitelist.
    event StrategyRemoved(address indexed strategy);
}
