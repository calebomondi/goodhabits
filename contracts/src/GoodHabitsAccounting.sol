// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GoodHabitsAccounting is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================================
    // ROLES
    // ============================================================

    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");
    bytes32 public constant SYNC_ROLE = keccak256("SYNC_ROLE");

    // ============================================================
    // VIRTUAL OFFSET (inflation-attack mitigation)
    // ============================================================

    uint256 internal constant VIRTUAL_SHARES = 1_000;
    uint256 internal constant VIRTUAL_ASSETS = 1_000;

    // ============================================================
    // PROTOCOL FEE
    // ============================================================

    uint256 public feeBps;
    uint256 public constant MAX_FEE_BPS = 2_000;
    uint256 public accruedFees;

    // ============================================================
    // REQUEST TIMEOUT
    // ============================================================

    uint256 public requestTimeout;

    // ============================================================
    // ASSET
    // ============================================================

    IERC20 public immutable gDollar;

    // ============================================================
    // SHARE ACCOUNTING
    // ============================================================

    uint256 public totalShares;
    uint256 public totalLockedShares;

    // ============================================================
    // ASSET ACCOUNTING
    // ============================================================

    uint256 public assetsToInvest;
    uint256 public deployedAssets;
    uint256 public reservedAssets;
    uint256 public lastFeeSnapshot;

    // ============================================================
    // PER-USER ACCOUNTING
    // ============================================================

    mapping(address => uint256) public shares;
    mapping(address => uint256) public userLockedShares;
    mapping(address => uint256) public lifetimeDeposited;
    mapping(address => uint256) public lifetimeWithdrawn;

    // ============================================================
    // WITHDRAWAL REQUEST SYSTEM
    // ============================================================

    enum WithdrawalStatus { Pending, Ready, Processed, Cancelled }
    enum WithdrawFrom { Spendable, Savings, Investment }

    struct WithdrawalRequest {
        uint256 id;
        uint256 sharesLocked;
        uint256 assetsQuoted;
        address user;
        uint40 createdAt;
        WithdrawalStatus status;
    }

    uint256 public nextWithdrawalId;
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    mapping(address => uint256) public activeRequestCount;
    uint256 public constant MAX_ACTIVE_REQUESTS = 10;

    // ============================================================
    // POSITION REGISTRY
    // ============================================================

    struct Position {
        uint256 tokenId;
        uint256 value;
        uint40 createdAt;
        bool active;
    }

    mapping(uint256 => Position) public positions;
    uint256[] public activePositionIds;
    mapping(uint256 => uint256) internal positionIndex;

    // ============================================================
    // HABIT STRATEGY
    // ============================================================

    struct Habit {
        uint256 toSpend;
        uint256 toSave;
        uint256 toInvest;
    }

    struct UserAllocation {
        uint256 spendAmount;
        uint256 saveAmount;
        uint256 investAmount;
    }

    struct BrokeHabit {
        uint256 savings;
        uint256 investments;
    }

    mapping(address => Habit) public userHabits;
    mapping(address => UserAllocation) public userAllocations;
    mapping(address => BrokeHabit) public brokeHabits;
    mapping(address => uint256) public targetSavingsUnlock;

    // ============================================================
    // STRATEGY REGISTRY
    // ============================================================

    mapping(address => bool) public approvedStrategies;

    // ============================================================
    // EVENTS
    // ============================================================

    event Deposit(address indexed user, uint256 assets, uint256 mintedShares);
    event Withdraw(address indexed user, uint256 amount, WithdrawFrom from);
    event WithdrawalRequested(uint256 indexed requestId, address indexed user, uint256 sharesLocked, uint256 assetsQuoted);
    event WithdrawalReady(uint256 indexed requestId);
    event WithdrawalFinalized(uint256 indexed requestId, address indexed user, uint256 assets);
    event WithdrawalCancelled(uint256 indexed requestId, address indexed user);
    event SharesLocked(address indexed user, uint256 amount);
    event SharesUnlocked(address indexed user, uint256 amount);
    event AssetsReserved(uint256 assets);
    event AssetsReleased(uint256 assets);
    event PositionRegistered(uint256 indexed tokenId, uint256 initialValue);
    event PositionClosed(uint256 indexed tokenId, uint256 returnedAssets);
    event PositionValueUpdated(uint256 indexed tokenId, uint256 oldValue, uint256 newValue);
    event StrategyApproved(address indexed strategy);
    event StrategyRemoved(address indexed strategy);
    event DeployedToStrategy(address indexed strategy, uint256 amount);
    event ReceivedFromStrategy(address indexed strategy, uint256 amount);
    event FeesCollected(uint256 yieldDelta, uint256 feeAmount);
    event FeesClaimed(address indexed recipient, uint256 amount);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event RequestTimeoutUpdated(uint256 oldTimeout, uint256 newTimeout);
    event TokenRescued(address indexed token, address indexed recipient, uint256 amount);

    // ============================================================
    // ERRORS
    // ============================================================

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientShares();
    error InsufficientAmount();
    error RequestNotFound();
    error InvalidRequestStatus();
    error NotEnoughassetsToInvest();
    error PositionNotFound();
    error PositionAlreadyExists();
    error PositionNotActive();
    error StrategyAlreadyApproved();
    error StrategyNotApproved();
    error Unauthorized();
    error FeeTooHigh();
    error TooManyActiveRequests();
    error RequestNotExpired();
    error CannotRescueGDollar();
    error NoFeesToClaim();
    error InvalidTimeout();
    error InvalidHabitAllocation();
    error StrategyNotSet();

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    constructor(address _gDollar, uint256 _feeBps, uint256 _requestTimeout) {
        if (_gDollar == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (_requestTimeout == 0) revert InvalidTimeout();

        gDollar = IERC20(_gDollar);
        feeBps = _feeBps;
        requestTimeout = _requestTimeout;
        lastFeeSnapshot = VIRTUAL_ASSETS;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============================================================
    // HOOKS (overridable by top-level contract)
    // ============================================================

    function _requireStrategySet() internal view virtual {}

    // ============================================================
    // DEPOSITS
    // ============================================================

    function deposit(uint256 assets) external nonReentrant whenNotPaused {
        _requireStrategySet();
        if (assets == 0) revert ZeroAmount();

        uint256 _totalShares = totalShares;
        uint256 _totalAssets = calculateTotalAssets();
        uint256 _toInvest;
        uint256 mintedShares;

        gDollar.safeTransferFrom(msg.sender, address(this), assets);

        Habit memory habit = userHabits[msg.sender];
        UserAllocation storage allocation = userAllocations[msg.sender];

        if (habit.toSpend > 0) {
            allocation.spendAmount += (assets * habit.toSpend) / 10000;
        }
        if (habit.toSave > 0) {
            allocation.saveAmount += (assets * habit.toSave) / 10000;
        }
        if (habit.toInvest > 0) {
            _toInvest = (assets * habit.toInvest) / 10000;
            allocation.investAmount += _toInvest;
            mintedShares = (_toInvest * (_totalShares + VIRTUAL_SHARES)) / (_totalAssets + VIRTUAL_ASSETS);
        }

        unchecked {
            shares[msg.sender] += mintedShares;
            lifetimeDeposited[msg.sender] += assets;
            totalShares = _totalShares + mintedShares;
            assetsToInvest += _toInvest;
            lastFeeSnapshot += assets;
        }

        emit Deposit(msg.sender, assets, mintedShares);
    }

    // ============================================================
    // NAV ACCOUNTING (BASE — without positions)
    // ============================================================

    function calculateTotalAssets() public view virtual returns (uint256 total) {
        total = assetsToInvest + deployedAssets;
    }

    function availableLiquidity() public view returns (uint256) {
        return assetsToInvest > reservedAssets ? assetsToInvest - reservedAssets : 0;
    }

    // ============================================================
    // PRICE / PREVIEW
    // ============================================================

    function pricePerShare() public view returns (uint256) {
        return (calculateTotalAssets() + VIRTUAL_ASSETS) / (totalShares + VIRTUAL_SHARES);
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        uint256 _totalShares = totalShares;
        uint256 _totalAssets = calculateTotalAssets();
        return (assets * (_totalShares + VIRTUAL_SHARES)) / (_totalAssets + VIRTUAL_ASSETS);
    }

    function previewWithdraw(uint256 shareAmount) public view returns (uint256) {
        uint256 _totalShares = totalShares;
        uint256 _totalAssets = calculateTotalAssets();
        return (shareAmount * (_totalAssets + VIRTUAL_ASSETS)) / (_totalShares + VIRTUAL_SHARES);
    }

    // ============================================================
    // USER POSITION VIEW
    // ============================================================

    struct UserPosition {
        uint256 unlockedShares;
        uint256 lockedShares;
        uint256 ownershipBps;
        uint256 unlockedValue;
        uint256 totalValue;
        uint256 deposited;
        uint256 withdrawn;
        int256  pnl;
    }

    function getUserPosition(address user) external view returns (UserPosition memory) {
        uint256 userUnlocked  = shares[user];
        uint256 userLocked    = userLockedShares[user];
        uint256 _totalShares  = totalShares;

        uint256 ownershipBps  = _totalShares == 0
            ? 0
            : ((userUnlocked + userLocked) * 10_000) / _totalShares;

        uint256 unlockedValue = previewWithdraw(userUnlocked);
        uint256 totalValue    = previewWithdraw(userUnlocked + userLocked);

        int256 pnl = int256(totalValue)
            - int256(lifetimeDeposited[user])
            + int256(lifetimeWithdrawn[user]);

        return UserPosition({
            unlockedShares: userUnlocked,
            lockedShares:   userLocked,
            ownershipBps:   ownershipBps,
            unlockedValue:  unlockedValue,
            totalValue:     totalValue,
            deposited:      lifetimeDeposited[user],
            withdrawn:      lifetimeWithdrawn[user],
            pnl:            pnl
        });
    }

    // ============================================================
    // HABIT VIEWS
    // ============================================================

    function hasUserSetStrategy(address user) external view returns (bool) {
        Habit memory habit = userHabits[user];
        return habit.toSpend + habit.toSave + habit.toInvest == 10000;
    }
}
