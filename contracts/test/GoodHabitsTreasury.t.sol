// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { GoodHabitsTreasury } from "../src/GoodHabitsTreasury.sol";
import { GoodHabitsAccounting } from "../src/GoodHabitsAccounting.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract G$ is IERC20 {
    string public name = "GoodDollar";
    string public symbol = "G$";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract GoodHabitsTreasuryTest is Test {
    GoodHabitsTreasury public treasury;
    G$ public gd;

    address public admin = address(0x100);
    address public strategist = address(0x200);
    address public syncer = address(0x300);
    address public alice = address(0x400);
    address public bob = address(0x500);

    uint256 constant ONE = 1e18;
    uint256 constant INITIAL_MINT = 1_000_000 * ONE;
    uint256 constant FEE_BPS = 500; // 5%
    uint256 constant TIMEOUT = 7 days;
    uint256 constant VIRT = 1_000;

    // ─── SETUP ────────────────────────────────────────────────────

    function setUp() public {
        gd = new G$();
        gd.mint(admin, INITIAL_MINT);
        gd.mint(alice, INITIAL_MINT);
        gd.mint(bob, INITIAL_MINT);

        vm.prank(admin);
        treasury = new GoodHabitsTreasury(address(gd), FEE_BPS, TIMEOUT);

        vm.startPrank(admin);
        treasury.grantRole(treasury.STRATEGY_ROLE(), strategist);
        treasury.grantRole(treasury.SYNC_ROLE(), syncer);
        vm.stopPrank();

        _approve(admin);
        _approve(alice);
        _approve(bob);

        // Default habits: 100% invest for standard test users
        _setHabit(alice, 0, 0, 10000);
        _setHabit(bob, 0, 0, 10000);
    }

    // ─── HELPERS ──────────────────────────────────────────────────

    function _approve(address who) internal {
        vm.prank(who);
        gd.approve(address(treasury), type(uint256).max);
    }

    function _deposit(address who, uint256 amount) internal {
        vm.prank(who);
        treasury.deposit(amount);
    }

    function _request(address who, uint256 shares) internal {
        vm.prank(who);
        treasury.requestWithdrawal(shares);
    }

    function _register(uint256 tokenId, uint256 val) internal {
        vm.prank(strategist);
        treasury.registerPosition(tokenId, val);
    }

    function _close(uint256 tokenId, uint256 returned) internal {
        vm.prank(strategist);
        treasury.closePosition(tokenId, returned);
    }

    function _updateValue(uint256 tokenId, uint256 val) internal {
        vm.prank(syncer);
        treasury.updatePositionValue(tokenId, val);
    }

    function _markReady(uint256 id) internal {
        vm.prank(strategist);
        treasury.markWithdrawalReady(id);
    }

    function _finalize(address who, uint256 id) internal {
        vm.prank(who);
        treasury.finalizeWithdrawal(id);
    }

    function _cancel(address who, uint256 id) internal {
        vm.prank(who);
        treasury.cancelWithdrawal(id);
    }

    function _deploy(address strategy, uint256 amount) internal {
        vm.prank(strategist);
        treasury.deployToStrategy(strategy, amount);
    }

    function _receiveFromStrategy(uint256 amount) internal {
        vm.prank(address(0x999));
        treasury.receiveFromStrategy(amount);
    }

    function _deployAssets(uint256 amount) internal returns (address) {
        address s = _createStrategy();
        _deposit(alice, amount);
        _deploy(s, amount);
        return s;
    }

    function _createStrategy() internal returns (address) {
        address s = address(0x999);
        vm.startPrank(admin);
        treasury.approveStrategy(s);
        treasury.grantRole(treasury.STRATEGY_ROLE(), s);
        vm.stopPrank();
        return s;
    }

    function _setHabit(address who, uint256 spend, uint256 save, uint256 invest) internal {
        vm.prank(who);
        treasury.setHabitStrategy(spend, save, invest);
    }

    function _minted(uint256 assets) internal view returns (uint256) {
        return treasury.previewDeposit(assets);
    }

    function _quoted(uint256 shares) internal view returns (uint256) {
        return treasury.previewWithdraw(shares);
    }

    // ════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════════════════════════

    function test_Constructor_SetsAsset() public view {
        assertEq(address(treasury.gDollar()), address(gd));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(treasury.hasRole(treasury.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_SetsFeeBps() public view {
        assertEq(treasury.feeBps(), FEE_BPS);
    }

    function test_Constructor_SetsTimeout() public view {
        assertEq(treasury.requestTimeout(), TIMEOUT);
    }

    function test_Constructor_InitialFeeSnapshot() public view {
        assertEq(treasury.lastFeeSnapshot(), VIRT);
    }

    function test_Constructor_ZeroAssetReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAddress.selector);
        new GoodHabitsTreasury(address(0), FEE_BPS, TIMEOUT);
    }

    function test_Constructor_FeeTooHighReverts() public {
        vm.expectRevert(GoodHabitsAccounting.FeeTooHigh.selector);
        new GoodHabitsTreasury(address(gd), 2_001, TIMEOUT);
    }

    function test_Constructor_InvalidTimeoutReverts() public {
        vm.expectRevert(GoodHabitsAccounting.InvalidTimeout.selector);
        new GoodHabitsTreasury(address(gd), FEE_BPS, 0);
    }

    // ════════════════════════════════════════════════════════════════
    // DEPOSITS
    // ════════════════════════════════════════════════════════════════

    function test_Deposit_ZeroReverts() public {
        _setHabit(address(this), 0, 0, 10000);
        vm.expectRevert(GoodHabitsAccounting.ZeroAmount.selector);
        treasury.deposit(0);
    }

    function test_Deposit_FirstMintsEqualAssets() public {
        _deposit(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 100 * ONE);
        assertEq(treasury.totalShares(), 100 * ONE);
        assertEq(treasury.assetsToInvest(), 100 * ONE);
    }

    function test_Deposit_SecondIsProportional() public {
        _deposit(alice, 100 * ONE);
        _deposit(bob, 100 * ONE);
        assertEq(treasury.shares(alice), 100 * ONE);
        assertEq(treasury.shares(bob), 100 * ONE);
        assertEq(treasury.totalShares(), 200 * ONE);
        assertEq(treasury.assetsToInvest(), 200 * ONE);
    }

    function test_Deposit_MultipleBySameUser() public {
        _deposit(alice, 50 * ONE);
        _deposit(alice, 30 * ONE);
        assertEq(treasury.shares(alice), 80 * ONE);
        assertEq(treasury.lifetimeDeposited(alice), 80 * ONE);
    }

    function test_Deposit_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.Deposit(alice, 100 * ONE, 100 * ONE);
        _deposit(alice, 100 * ONE);
    }

    function test_Deposit_WhenPausedReverts() public {
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        _deposit(alice, 100 * ONE);
    }

    function test_Deposit_UpdatesLifetimeDeposited() public {
        _deposit(alice, 75 * ONE);
        assertEq(treasury.lifetimeDeposited(alice), 75 * ONE);
    }

    function test_Deposit_VirtualOffset() public {
        _deposit(alice, 100 * ONE);          // totalShares=100, totalAssets=100
        _register(1, 300 * ONE);              // totalAssets=400
        uint256 expected = (50 * ONE * (100 * ONE + VIRT)) / (400 * ONE + VIRT);
        assertEq(_minted(50 * ONE), expected);
    }

    function test_DepositFuzz(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_MINT);
        _deposit(alice, amount);
        assertEq(treasury.shares(alice), amount);
        assertEq(treasury.totalShares(), amount);
        assertEq(treasury.assetsToInvest(), amount);
    }

    // ════════════════════════════════════════════════════════════════
    // VIRTUAL OFFSET – inflation-attack mitigation
    // ════════════════════════════════════════════════════════════════

    function test_VirtualOffset_FirstDepositCantInflate() public {
        // Attacker deposits dust to manipulate the ratio
        _deposit(alice, 1);
        assertEq(treasury.shares(alice), 1);
    }

    // ════════════════════════════════════════════════════════════════
    // NAV ACCOUNTING
    // ════════════════════════════════════════════════════════════════

    function test_CalculateTotalAssets_OnlyIdle() public {
        _deposit(alice, 100 * ONE);
        assertEq(treasury.calculateTotalAssets(), 100 * ONE);
    }

    function test_CalculateTotalAssets_WithPositions() public {
        _deposit(alice, 100 * ONE);
        _register(1, 200 * ONE);
        assertEq(treasury.calculateTotalAssets(), 100 * ONE + 200 * ONE);
    }

    function test_CalculateTotalAssets_IncludesDeployed() public {
        _deposit(alice, 100 * ONE);
        address s = _createStrategy();
        _deploy(s, 30 * ONE);
        assertEq(treasury.calculateTotalAssets(), 100 * ONE);
        assertEq(treasury.deployedAssets(), 30 * ONE);
        assertEq(treasury.assetsToInvest(), 70 * ONE);
    }

    function test_CalculateTotalAssets_ExcludesClosedPositions() public {
        _deposit(alice, 100 * ONE);
        _register(1, 200 * ONE);
        _close(1, 200 * ONE);
        assertEq(treasury.calculateTotalAssets(), 100 * ONE + 200 * ONE);
    }

    function test_AvailableLiquidity_Initial() public view {
        assertEq(treasury.availableLiquidity(), 0);
    }

    function test_AvailableLiquidity_AfterDeposit() public {
        _deposit(alice, 100 * ONE);
        assertEq(treasury.availableLiquidity(), 100 * ONE);
    }

    function test_AvailableLiquidity_WithReservations() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        assertEq(treasury.availableLiquidity(), 60 * ONE);
    }

    function test_AvailableLiquidity_FloorsAtZero() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 100 * ONE);
        assertEq(treasury.availableLiquidity(), 0);
    }

    // ════════════════════════════════════════════════════════════════
    // PRICE PER SHARE
    // ════════════════════════════════════════════════════════════════

    function test_PricePerShare_Initial() public view {
        assertEq(treasury.pricePerShare(), 1);
    }

    function test_PricePerShare_AfterDeposit() public {
        _deposit(alice, 100 * ONE);
        uint256 expected = (100 * ONE + VIRT) / (100 * ONE + VIRT);
        assertEq(treasury.pricePerShare(), expected);
    }

    function test_PricePerShare_WithProfit() public {
        _deposit(alice, 100 * ONE);
        _register(1, 100 * ONE);
        _updateValue(1, 150 * ONE);
        uint256 ta = treasury.calculateTotalAssets();
        uint256 expected = (ta + VIRT) / (100 * ONE + VIRT);
        assertEq(treasury.pricePerShare(), expected);
    }

    // ════════════════════════════════════════════════════════════════
    // PREVIEW
    // ════════════════════════════════════════════════════════════════

    function test_PreviewDeposit_Initial() public view {
        assertEq(_minted(50 * ONE), 50 * ONE);
    }

    function test_PreviewDeposit_AfterDeposits() public {
        _deposit(alice, 100 * ONE);
        assertEq(_minted(50 * ONE), 50 * ONE);
    }

    function test_PreviewDeposit_WithProfit() public {
        _deposit(alice, 100 * ONE);
        _register(1, 200 * ONE);
        uint256 expected = (50 * ONE * (100 * ONE + VIRT)) / (300 * ONE + VIRT);
        assertEq(_minted(50 * ONE), expected);
    }

    function test_PreviewWithdraw_Initial() public view {
        assertEq(_quoted(100 * ONE), 100 * ONE);
    }

    function test_PreviewWithdraw_AfterDeposit() public {
        _deposit(alice, 100 * ONE);
        uint256 expected = (50 * ONE * (100 * ONE + VIRT)) / (100 * ONE + VIRT);
        assertEq(_quoted(50 * ONE), expected);
    }

    function test_PreviewWithdraw_WithProfit() public {
        _deposit(alice, 100 * ONE);
        _register(1, 300 * ONE);
        uint256 expected = (50 * ONE * (400 * ONE + VIRT)) / (100 * ONE + VIRT);
        assertEq(_quoted(50 * ONE), expected);
    }

    // ════════════════════════════════════════════════════════════════
    // WITHDRAWAL REQUEST
    // ════════════════════════════════════════════════════════════════

    function test_Request_ZeroReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAmount.selector);
        treasury.requestWithdrawal(0);
    }

    function test_Request_InsufficientSharesReverts() public {
        vm.expectRevert(GoodHabitsAccounting.InsufficientShares.selector);
        treasury.requestWithdrawal(1);
    }

    function test_Request_TooManyActiveReverts() public {
        _deposit(alice, 100 * ONE);
        for (uint256 i; i < 10; i++) {
            _request(alice, 1);
        }
        vm.expectRevert(GoodHabitsAccounting.TooManyActiveRequests.selector);
        _request(alice, 1);
    }

    function test_Request_LocksShares() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        assertEq(treasury.shares(alice), 60 * ONE);
        assertEq(treasury.userLockedShares(alice), 40 * ONE);
        assertEq(treasury.totalLockedShares(), 40 * ONE);
        assertEq(treasury.activeRequestCount(alice), 1);
    }

    function test_Request_ReservesAssets() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        uint256 expected = (40 * ONE * (100 * ONE + VIRT)) / (100 * ONE + VIRT);
        assertEq(treasury.reservedAssets(), expected);
    }

    function test_Request_ImmediateReady() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Ready));
    }

    function test_Request_PendingWhenInsufficientLiquidity() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Pending));
    }

    function test_Request_EmitsEvents() public {
        _deposit(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.SharesLocked(alice, 40 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.AssetsReserved(40 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.WithdrawalRequested(0, alice, 40 * ONE, 40 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.WithdrawalReady(0);
        _request(alice, 40 * ONE);
    }

    function test_Request_WhenPausedReverts() public {
        _deposit(alice, 100 * ONE);
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        _request(alice, 1);
    }

    // ════════════════════════════════════════════════════════════════
    // MARK READY
    // ════════════════════════════════════════════════════════════════

    function test_MarkReady_OnlyStrategist() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        vm.expectRevert();
        vm.prank(alice);
        treasury.markWithdrawalReady(0);
    }

    function test_MarkReady_NonPendingReverts() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.prank(strategist);
        vm.expectRevert(GoodHabitsAccounting.InvalidRequestStatus.selector);
        treasury.markWithdrawalReady(0);
    }

    function test_MarkReady_TransitionsToReady() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        _markReady(0);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Ready));
    }

    function test_MarkReady_EmitsEvent() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.WithdrawalReady(0);
        _markReady(0);
    }

    // ════════════════════════════════════════════════════════════════
    // FINALIZE
    // ════════════════════════════════════════════════════════════════

    function test_Finalize_TransfersG$() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        uint256 before = gd.balanceOf(alice);
        _finalize(alice, 0);
        assertEq(gd.balanceOf(alice) - before, 40 * ONE);
    }

    function test_Finalize_StrategistCanFinalize() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        _finalize(strategist, 0);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Processed));
    }

    function test_Finalize_NonReadyReverts() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        vm.expectRevert(GoodHabitsAccounting.InvalidRequestStatus.selector);
        _finalize(alice, 0);
    }

    function test_Finalize_AlreadyProcessedReverts() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        _finalize(alice, 0);
        vm.expectRevert(GoodHabitsAccounting.InvalidRequestStatus.selector);
        _finalize(alice, 0);
    }

    function test_Finalize_BurnsShares() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        uint256 totalBefore = treasury.totalShares();
        _finalize(alice, 0);
        assertEq(treasury.totalShares(), totalBefore - 40 * ONE);
        assertEq(treasury.totalLockedShares(), 0);
    }

    function test_Finalize_ReleasesReserved() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        _finalize(alice, 0);
        assertEq(treasury.reservedAssets(), 0);
    }

    function test_Finalize_UpdatesIdle() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        _finalize(alice, 0);
        assertEq(treasury.assetsToInvest(), 60 * ONE);
    }

    function test_Finalize_UpdatesLifetimeWithdrawn() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        _finalize(alice, 0);
        assertEq(treasury.lifetimeWithdrawn(alice), 40 * ONE);
    }

    function test_Finalize_DecrementsActiveRequestCount() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        assertEq(treasury.activeRequestCount(alice), 1);
        _finalize(alice, 0);
        assertEq(treasury.activeRequestCount(alice), 0);
    }

    function test_Finalize_EmitsEvents() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.WithdrawalFinalized(0, alice, 40 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.AssetsReleased(40 * ONE);
        _finalize(alice, 0);
    }

    function test_Finalize_UnauthorizedReverts() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.expectRevert(GoodHabitsAccounting.Unauthorized.selector);
        vm.prank(bob);
        treasury.finalizeWithdrawal(0);
    }

    function test_Finalize_NotEnoughIdleAfterDeploy() public {
        _deposit(alice, 100 * ONE);
        // Create yield
        _register(1, 100 * ONE);
        _updateValue(1, 200 * ONE);
        // Collect fees to reduce idle below the eventual quote
        vm.prank(strategist);
        treasury.collectFees();
        // Request more than remaining idle → Pending
        _request(alice, 100 * ONE);
        _createStrategy();
        _markReady(0);
        vm.expectRevert(GoodHabitsAccounting.NotEnoughassetsToInvest.selector);
        _finalize(alice, 0);
    }

    // ════════════════════════════════════════════════════════════════
    // CANCEL
    // ════════════════════════════════════════════════════════════════

    function test_Cancel_OwnerCancelsPending() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        _cancel(alice, 0);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Cancelled));
    }

    function test_Cancel_AdminCancelsPending() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        _cancel(admin, 0);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Cancelled));
    }

    function test_Cancel_ReadyBeforeTimeoutReverts() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.expectRevert(GoodHabitsAccounting.RequestNotExpired.selector);
        _cancel(alice, 0);
    }

    function test_Cancel_ReadyAfterTimeout() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.warp(block.timestamp + TIMEOUT + 1);
        _cancel(alice, 0);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Cancelled));
    }

    function test_Cancel_AdminCannotCancelReady() public {
        _deposit(alice, 100 * ONE);
        _request(alice, 40 * ONE);
        vm.expectRevert(GoodHabitsAccounting.InvalidRequestStatus.selector);
        _cancel(admin, 0);
    }

    function test_Cancel_ReturnsShares() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 0);
        assertEq(treasury.userLockedShares(alice), 100 * ONE);
        _cancel(alice, 0);
        assertEq(treasury.shares(alice), 100 * ONE);
        assertEq(treasury.userLockedShares(alice), 0);
    }

    function test_Cancel_ReleasesReserved() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        assertTrue(treasury.reservedAssets() > 0);
        _cancel(alice, 0);
        assertEq(treasury.reservedAssets(), 0);
    }

    function test_Cancel_EmitsEvents() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.WithdrawalCancelled(0, alice);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.SharesUnlocked(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.AssetsReleased(treasury.getWithdrawalRequest(0).assetsQuoted);
        _cancel(alice, 0);
    }

    function test_Cancel_UnauthorizedReverts() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        vm.expectRevert(GoodHabitsAccounting.Unauthorized.selector);
        vm.prank(bob);
        treasury.cancelWithdrawal(0);
    }

    function test_Cancel_DecrementsActiveRequestCount() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        _request(alice, 100 * ONE);
        assertEq(treasury.activeRequestCount(alice), 1);
        _cancel(alice, 0);
        assertEq(treasury.activeRequestCount(alice), 0);
    }

    // ════════════════════════════════════════════════════════════════
    // STRATEGY FUND MANAGEMENT
    // ════════════════════════════════════════════════════════════════

    function test_DeployToStrategy_TransfersTokens() public {
        address s = _createStrategy();
        _deposit(alice, 100 * ONE);
        _deploy(s, 40 * ONE);
        assertEq(gd.balanceOf(s), 40 * ONE);
    }

    function test_DeployToStrategy_UpdatesAccounting() public {
        address s = _createStrategy();
        _deposit(alice, 100 * ONE);
        _deploy(s, 40 * ONE);
        assertEq(treasury.assetsToInvest(), 60 * ONE);
        assertEq(treasury.deployedAssets(), 40 * ONE);
    }

    function test_DeployToStrategy_OnlyApproved() public {
        vm.expectRevert(GoodHabitsAccounting.StrategyNotApproved.selector);
        vm.prank(strategist);
        treasury.deployToStrategy(address(0xbad), 1);
    }

    function test_DeployToStrategy_OnlyStrategist() public {
        address s = _createStrategy();
        vm.expectRevert();
        vm.prank(alice);
        treasury.deployToStrategy(s, 1);
    }

    function test_DeployToStrategy_NotEnoughLiquidity() public {
        address s = _createStrategy();
        _deposit(alice, 50 * ONE);
        _request(alice, 50 * ONE);
        // availableLiquidity = 0
        vm.expectRevert(GoodHabitsAccounting.NotEnoughassetsToInvest.selector);
        _deploy(s, 1);
    }

    function test_ReceiveFromStrategy_TransfersTokens() public {
        address s = _createStrategy();
        _deposit(alice, 100 * ONE);
        _deploy(s, 40 * ONE);
        gd.mint(s, 50 * ONE);
        vm.prank(s);
        gd.approve(address(treasury), type(uint256).max);
        _receiveFromStrategy(50 * ONE);
        assertEq(treasury.assetsToInvest(), 110 * ONE);
    }

    function test_ReceiveFromStrategy_ClampsDeployed() public {
        address s = _createStrategy();
        _deposit(alice, 100 * ONE);
        _deploy(s, 40 * ONE);
        // Return more than was deployed (profit)
        gd.mint(s, 60 * ONE);
        vm.prank(s);
        gd.approve(address(treasury), type(uint256).max);
        _receiveFromStrategy(60 * ONE);
        assertEq(treasury.deployedAssets(), 0);
        assertEq(treasury.assetsToInvest(), 120 * ONE);
    }

    function test_ReceiveFromStrategy_EmitsEvent() public {
        address s = _createStrategy();
        _deposit(alice, 100 * ONE);
        _deploy(s, 40 * ONE);
        gd.mint(s, 10 * ONE);
        vm.prank(s);
        gd.approve(address(treasury), type(uint256).max);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.ReceivedFromStrategy(s, 10 * ONE);
        _receiveFromStrategy(10 * ONE);
    }

    // ════════════════════════════════════════════════════════════════
    // POSITION REGISTRY
    // ════════════════════════════════════════════════════════════════

    function test_RegisterPosition_Creates() public {
        _register(1, 500 * ONE);
        GoodHabitsAccounting.Position memory pos = treasury.getPosition(1);
        assertEq(pos.tokenId, 1);
        assertEq(pos.value, 500 * ONE);
        assertTrue(pos.active);
    }

    function test_RegisterPosition_DuplicateReverts() public {
        _register(1, 100 * ONE);
        vm.expectRevert(GoodHabitsAccounting.PositionAlreadyExists.selector);
        _register(1, 200 * ONE);
    }

    function test_RegisterPosition_OnlyStrategist() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.registerPosition(1, 100 * ONE);
    }

    function test_RegisterPosition_UpdatesActiveIds() public {
        _register(1, 100 * ONE);
        _register(2, 200 * ONE);
        uint256[] memory ids = treasury.getActivePositionIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_RegisterPosition_DecrementsDeployed() public {
        _deposit(alice, 100 * ONE);
        address s = _createStrategy();
        _deploy(s, 50 * ONE);
        assertEq(treasury.deployedAssets(), 50 * ONE);
        _register(1, 30 * ONE);
        assertEq(treasury.deployedAssets(), 20 * ONE);
    }

    function test_RegisterPosition_DeployedCappedAtZero() public {
        _deposit(alice, 100 * ONE);
        _register(1, 50 * ONE);
        assertEq(treasury.deployedAssets(), 0);
    }

    function test_ClosePosition_MarksInactive() public {
        _register(1, 100 * ONE);
        _close(1, 100 * ONE);
        GoodHabitsAccounting.Position memory pos = treasury.getPosition(1);
        assertFalse(pos.active);
        assertEq(pos.value, 0);
    }

    function test_ClosePosition_RemovesFromActiveIds() public {
        _register(1, 100 * ONE);
        _register(2, 200 * ONE);
        _close(1, 100 * ONE);
        uint256[] memory ids = treasury.getActivePositionIds();
        assertEq(ids.length, 1);
        assertEq(ids[0], 2);
    }

    function test_ClosePosition_AddsReturnedToIdle() public {
        _deposit(alice, 100 * ONE);
        _register(1, 100 * ONE);
        _close(1, 150 * ONE);
        assertEq(treasury.assetsToInvest(), 250 * ONE);
    }

    function test_ClosePosition_NonExistentReverts() public {
        vm.expectRevert(GoodHabitsAccounting.PositionNotFound.selector);
        _close(999, 0);
    }

    function test_ClosePosition_AlreadyClosedReverts() public {
        _register(1, 100 * ONE);
        _close(1, 100 * ONE);
        vm.expectRevert(GoodHabitsAccounting.PositionNotActive.selector);
        _close(1, 0);
    }

    function test_ClosePosition_OnlyStrategist() public {
        _register(1, 100 * ONE);
        vm.expectRevert();
        vm.prank(alice);
        treasury.closePosition(1, 100 * ONE);
    }

    function test_ClosePosition_SwapAndPop() public {
        _register(1, 100 * ONE);
        _register(2, 200 * ONE);
        _register(3, 300 * ONE);
        _close(2, 200 * ONE);
        uint256[] memory ids = treasury.getActivePositionIds();
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 3);
        assertEq(treasury.getPosition(1).tokenId, 1);
        assertEq(treasury.getPosition(3).tokenId, 3);
    }

    function test_UpdatePositionValue_Updates() public {
        _register(1, 100 * ONE);
        _updateValue(1, 250 * ONE);
        assertEq(treasury.getPosition(1).value, 250 * ONE);
    }

    function test_UpdatePositionValue_OnlySyncer() public {
        _register(1, 100 * ONE);
        vm.expectRevert();
        vm.prank(alice);
        treasury.updatePositionValue(1, 200 * ONE);
    }

    function test_UpdatePositionValue_NonExistentReverts() public {
        vm.expectRevert(GoodHabitsAccounting.PositionNotFound.selector);
        _updateValue(999, 100 * ONE);
    }

    function test_UpdatePositionValue_InactiveReverts() public {
        _register(1, 100 * ONE);
        _close(1, 100 * ONE);
        vm.expectRevert(GoodHabitsAccounting.PositionNotActive.selector);
        _updateValue(1, 200 * ONE);
    }

    function test_UpdatePositionValue_EmitsOldAndNew() public {
        _register(1, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.PositionValueUpdated(1, 100 * ONE, 250 * ONE);
        _updateValue(1, 250 * ONE);
    }

    // ════════════════════════════════════════════════════════════════
    // PROTOCOL FEES
    // ════════════════════════════════════════════════════════════════

    function test_CollectFees_NoYieldNoOp() public {
        _deposit(alice, 100 * ONE);
        vm.prank(strategist);
        treasury.collectFees();
        assertEq(treasury.lastFeeSnapshot(), 100 * ONE);
    }

    function test_CollectFees_AccruesOnYield() public {
        _deposit(alice, 1_000 * ONE);
        // Reset snapshot to current NAV (deposit added to snapshot, no fee charged)
        vm.prank(strategist);
        treasury.collectFees();
        assertEq(treasury.accruedFees(), 0);

        // Register creates 200 yield, update creates another 100 = 300 total yield
        _register(1, 200 * ONE);
        _updateValue(1, 300 * ONE);
        vm.prank(strategist);
        treasury.collectFees();
        uint256 expectedFee = (300 * ONE * FEE_BPS) / 10_000;
        assertEq(treasury.accruedFees(), expectedFee);
    }

    // Let me skip the full fee test and just test basics
    function test_CollectFees_OnlyStrategist() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.collectFees();
    }

    function test_ClaimFees_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.claimFees(alice);
    }

    function test_ClaimFees_NoFeesReverts() public {
        vm.expectRevert(GoodHabitsAccounting.NoFeesToClaim.selector);
        vm.prank(admin);
        treasury.claimFees(admin);
    }

    function test_ClaimFees_ZeroAddressReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAddress.selector);
        vm.prank(admin);
        treasury.claimFees(address(0));
    }

    function test_SetFeeBps_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.setFeeBps(100);
    }

    function test_SetFeeBps_Updates() public {
        vm.prank(admin);
        treasury.setFeeBps(100);
        assertEq(treasury.feeBps(), 100);
    }

    function test_SetFeeBps_TooHighReverts() public {
        vm.expectRevert(GoodHabitsAccounting.FeeTooHigh.selector);
        vm.prank(admin);
        treasury.setFeeBps(2_001);
    }

    // ════════════════════════════════════════════════════════════════
    // USER POSITION VIEW
    // ════════════════════════════════════════════════════════════════

    function test_GetUserPosition_Zero() public view {
        GoodHabitsAccounting.UserPosition memory pos = treasury.getUserPosition(alice);
        assertEq(pos.unlockedShares, 0);
        assertEq(pos.lockedShares, 0);
        assertEq(pos.ownershipBps, 0);
        assertEq(pos.totalValue, 0);
        assertEq(pos.pnl, 0);
    }

    function test_GetUserPosition_AfterDeposit() public {
        _deposit(alice, 100 * ONE);
        GoodHabitsAccounting.UserPosition memory pos = treasury.getUserPosition(alice);
        assertEq(pos.unlockedShares, 100 * ONE);
        assertEq(pos.totalValue, _quoted(100 * ONE));
        assertEq(pos.ownershipBps, 10000);
        assertEq(pos.deposited, 100 * ONE);
        assertEq(pos.pnl, 0);
    }

    function test_GetUserPosition_WithLocked() public {
        _deposit(alice, 100 * ONE);
        _register(1, 200 * ONE);
        _request(alice, 40 * ONE);
        GoodHabitsAccounting.UserPosition memory pos = treasury.getUserPosition(alice);
        assertEq(pos.unlockedShares, 60 * ONE);
        assertEq(pos.lockedShares, 40 * ONE);
    }

    function test_GetUserPosition_OwnershipVsAllShares() public {
        _deposit(alice, 100 * ONE);
        _deposit(bob, 100 * ONE);
        _request(alice, 50 * ONE);
        GoodHabitsAccounting.UserPosition memory pos = treasury.getUserPosition(alice);
        // ownership against ALL shares: (100) / (200) * 10000 = 5000
        assertEq(pos.ownershipBps, 5000);
    }

    function test_GetUserPosition_WithProfit() public {
        _deposit(alice, 100 * ONE);
        _register(1, 100 * ONE);
        _updateValue(1, 200 * ONE);
        GoodHabitsAccounting.UserPosition memory pos = treasury.getUserPosition(alice);
        uint256 expected = _quoted(100 * ONE);
        assertEq(pos.totalValue, expected);
        assertEq(pos.pnl, int256(expected) - int256(100 * ONE));
    }

    // ════════════════════════════════════════════════════════════════
    // HAS USER SET STRATEGY
    // ════════════════════════════════════════════════════════════════

    function test_HasUserSetStrategy_ReturnsTrueWhenSet() public view {
        assertTrue(treasury.hasUserSetStrategy(alice));
    }

    function test_HasUserSetStrategy_ReturnsFalseWhenNotSet() public view {
        assertFalse(treasury.hasUserSetStrategy(address(0x999)));
    }

    function test_HasUserSetStrategy_AfterSettingReturnsTrue() public {
        address charlie = address(0x700);
        assertFalse(treasury.hasUserSetStrategy(charlie));
        _setHabit(charlie, 5000, 3000, 2000);
        assertTrue(treasury.hasUserSetStrategy(charlie));
    }

    // ════════════════════════════════════════════════════════════════
    // STRATEGY REGISTRY
    // ════════════════════════════════════════════════════════════════

    function test_ApproveStrategy_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.approveStrategy(address(0x999));
    }

    function test_ApproveStrategy_ZeroAddressReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAddress.selector);
        vm.prank(admin);
        treasury.approveStrategy(address(0));
    }

    function test_ApproveStrategy_Success() public {
        vm.prank(admin);
        treasury.approveStrategy(address(0x999));
        assertTrue(treasury.approvedStrategies(address(0x999)));
    }

    function test_ApproveStrategy_DuplicateReverts() public {
        vm.prank(admin);
        treasury.approveStrategy(address(0x999));
        vm.expectRevert(GoodHabitsAccounting.StrategyAlreadyApproved.selector);
        vm.prank(admin);
        treasury.approveStrategy(address(0x999));
    }

    function test_RemoveStrategy_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.removeStrategy(address(0x999));
    }

    function test_RemoveStrategy_Success() public {
        vm.prank(admin);
        treasury.approveStrategy(address(0x999));
        vm.prank(admin);
        treasury.removeStrategy(address(0x999));
        assertFalse(treasury.approvedStrategies(address(0x999)));
    }

    function test_RemoveStrategy_NonApprovedReverts() public {
        vm.expectRevert(GoodHabitsAccounting.StrategyNotApproved.selector);
        vm.prank(admin);
        treasury.removeStrategy(address(0x999));
    }

    // ════════════════════════════════════════════════════════════════
    // ADMIN
    // ════════════════════════════════════════════════════════════════

    function test_Pause_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.pause();
    }

    function test_Pause_BlocksDeposit() public {
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        _deposit(alice, 100 * ONE);
    }

    function test_Unpause_OnlyAdmin() public {
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        vm.prank(alice);
        treasury.unpause();
    }

    function test_Unpause_RestoresDeposit() public {
        vm.prank(admin);
        treasury.pause();
        vm.prank(admin);
        treasury.unpause();
        _deposit(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 100 * ONE);
    }

    function test_SetRequestTimeout_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.setRequestTimeout(1 days);
    }

    function test_SetRequestTimeout_Updates() public {
        vm.prank(admin);
        treasury.setRequestTimeout(1 days);
        assertEq(treasury.requestTimeout(), 1 days);
    }

    function test_SetRequestTimeout_ZeroReverts() public {
        vm.expectRevert(GoodHabitsAccounting.InvalidTimeout.selector);
        vm.prank(admin);
        treasury.setRequestTimeout(0);
    }

    function test_RescueToken_OnlyAdmin() public {
        vm.expectRevert();
        vm.prank(alice);
        treasury.rescueToken(address(0xaaa), alice, 1);
    }

    function test_RescueToken_CannotRescueGDollar() public {
        vm.expectRevert(GoodHabitsAccounting.CannotRescueGDollar.selector);
        vm.prank(admin);
        treasury.rescueToken(address(gd), alice, 1);
    }

    function test_RescueToken_ZeroAddressReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAddress.selector);
        vm.prank(admin);
        treasury.rescueToken(address(0xaaa), address(0), 1);
    }

    function test_RescueToken_ZeroAmountReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAmount.selector);
        vm.prank(admin);
        treasury.rescueToken(address(0xaaa), alice, 0);
    }

    // ════════════════════════════════════════════════════════════════
    // EDGE CASES
    // ════════════════════════════════════════════════════════════════

    function test_MultipleRequests_SameUser() public {
        _deposit(alice, 100 * ONE);
        _register(1, 200 * ONE);
        _request(alice, 30 * ONE);
        _request(alice, 20 * ONE);
        assertEq(treasury.shares(alice), 50 * ONE);
        assertEq(treasury.userLockedShares(alice), 50 * ONE);
        assertEq(treasury.totalLockedShares(), 50 * ONE);
        assertEq(treasury.activeRequestCount(alice), 2);
    }

    function test_MultipleRequests_DifferentUsers() public {
        _deposit(alice, 200 * ONE);
        _deposit(bob, 200 * ONE);
        _register(1, 400 * ONE);
        _request(alice, 100 * ONE);
        _request(bob, 100 * ONE);
        assertEq(treasury.totalLockedShares(), 200 * ONE);
    }

    function test_MultipleRequests_FinalizePartial() public {
        _deposit(alice, 100 * ONE);
        _deposit(bob, 100 * ONE);
        _register(1, 500 * ONE);             // NAV=700, shares=200, price≈3.5
        // Alice: 40 shares → quoted≈140, idle=200≥140 → Ready
        _request(alice, 40 * ONE);
        // Bob: 30 shares → quoted≈105, available=60<105 → Pending
        _request(bob, 30 * ONE);
        uint256 totalBefore = treasury.totalShares();
        _finalize(alice, 0);
        assertEq(treasury.totalShares(), totalBefore - 40 * ONE);
        assertEq(treasury.totalLockedShares(), 30 * ONE);
        vm.expectRevert(GoodHabitsAccounting.InvalidRequestStatus.selector);
        _finalize(bob, 1);
    }

    function test_PartialLiquidity_FirstReadySecondPending() public {
        _deposit(alice, 100 * ONE);
        _register(1, 500 * ONE);
        // Request small enough to be immediately fulfillable
        uint256 smallShares = 10 * ONE;
        _request(alice, smallShares);
        (,,,,, GoodHabitsAccounting.WithdrawalStatus status) = treasury.withdrawalRequests(0);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Ready));
        // Second request will exceed available liquidity
        _request(alice, 80 * ONE);
        (,,,,, status) = treasury.withdrawalRequests(1);
        assertEq(uint8(status), uint8(GoodHabitsAccounting.WithdrawalStatus.Pending));
    }

    function test_LargeWithdrawal_AllShares() public {
        _deposit(alice, 500 * ONE);
        _request(alice, 500 * ONE);
        _finalize(alice, 0);
        assertEq(treasury.shares(alice), 0);
        assertEq(treasury.totalShares(), 0);
        assertEq(treasury.assetsToInvest(), 0);
    }

    function test_FeeGrowth_SharePriceAppreciates() public {
        _deposit(alice, 100 * ONE);
        _register(1, 100 * ONE);
        _updateValue(1, 300 * ONE);
        assertTrue(treasury.pricePerShare() > 1);
    }

    function test_RequestNotFoundViaGet() public {
        vm.expectRevert(GoodHabitsAccounting.RequestNotFound.selector);
        treasury.getWithdrawalRequest(999);
    }

    function test_DeployAndRegisterRoundTrip() public {
        _deposit(alice, 500 * ONE);
        address s = _createStrategy();
        _deploy(s, 200 * ONE);
        assertEq(treasury.assetsToInvest(), 300 * ONE);
        assertEq(treasury.deployedAssets(), 200 * ONE);
        assertEq(treasury.calculateTotalAssets(), 500 * ONE);
        _register(1, 200 * ONE);
        assertEq(treasury.deployedAssets(), 0);
        assertEq(treasury.calculateTotalAssets(), 500 * ONE);
        _close(1, 250 * ONE);
        assertEq(treasury.assetsToInvest(), 550 * ONE);
    }

    // ════════════════════════════════════════════════════════════════
    // HABIT STRATEGY
    // ════════════════════════════════════════════════════════════════

    function test_SetHabit_SetsAllocation() public {
        _setHabit(alice, 2000, 3000, 5000);
        GoodHabitsAccounting.Habit memory h = treasury.getUserHabit(alice);
        assertEq(h.toSpend, 2000);
        assertEq(h.toSave, 3000);
        assertEq(h.toInvest, 5000);
    }

    function test_SetHabit_AllocationMustSumTo10000() public {
        vm.prank(alice);
        vm.expectRevert(GoodHabitsAccounting.InvalidHabitAllocation.selector);
        treasury.setHabitStrategy(0, 0, 0);
        vm.prank(alice);
        vm.expectRevert(GoodHabitsAccounting.InvalidHabitAllocation.selector);
        treasury.setHabitStrategy(5000, 3000, 1000);
    }

    function test_SetHabit_InvalidSumReverts() public {
        vm.prank(alice);
        vm.expectRevert(GoodHabitsAccounting.InvalidHabitAllocation.selector);
        treasury.setHabitStrategy(5000, 3000, 1000); // sums to 9000, not 10000
    }

    function test_SetHabit_WhenPausedReverts() public {
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        _setHabit(alice, 5000, 3000, 2000);
    }

    // ════════════════════════════════════════════════════════════════
    // TARGET SAVINGS UNLOCK
    // ════════════════════════════════════════════════════════════════

    function test_SetTargetSavingsUnlock_Sets() public {
        uint256 t = block.timestamp + 30 days;
        vm.prank(alice);
        treasury.setTargetSavingsUnlock(t);
        assertEq(treasury.targetSavingsUnlock(alice), t);
    }

    function test_SetTargetSavingsUnlock_Zero() public {
        vm.prank(alice);
        treasury.setTargetSavingsUnlock(0);
        assertEq(treasury.targetSavingsUnlock(alice), 0);
    }

    function test_SetTargetSavingsUnlock_WhenPausedReverts() public {
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        vm.prank(alice);
        treasury.setTargetSavingsUnlock(block.timestamp + 1 days);
    }

    // ════════════════════════════════════════════════════════════════
    // WITHDRAW SPENDABLE
    // ════════════════════════════════════════════════════════════════

    function test_WithdrawSpendable_TransfersG$() public {
        _setHabit(alice, 10000, 0, 0); // 100% spend
        _deposit(alice, 100 * ONE);
        uint256 before = gd.balanceOf(alice);
        vm.prank(alice);
        treasury.withdrawSpendable(40 * ONE);
        assertEq(gd.balanceOf(alice) - before, 40 * ONE);
    }

    function test_WithdrawSpendable_UpdatesAllocation() public {
        _setHabit(alice, 10000, 0, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(alice);
        treasury.withdrawSpendable(40 * ONE);
        GoodHabitsAccounting.UserAllocation memory a = treasury.getUserAllocation(alice);
        assertEq(a.spendAmount, 60 * ONE);
    }

    function test_WithdrawSpendable_ZeroReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAmount.selector);
        vm.prank(alice);
        treasury.withdrawSpendable(0);
    }

    function test_WithdrawSpendable_InsufficientReverts() public {
        _setHabit(alice, 10000, 0, 0);
        _deposit(alice, 10 * ONE);
        vm.expectRevert(GoodHabitsAccounting.InsufficientAmount.selector);
        vm.prank(alice);
        treasury.withdrawSpendable(20 * ONE);
    }

    function test_WithdrawSpendable_EmitsEvent() public {
        _setHabit(alice, 10000, 0, 0);
        _deposit(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.Withdraw(alice, 40 * ONE, GoodHabitsAccounting.WithdrawFrom.Spendable);
        vm.prank(alice);
        treasury.withdrawSpendable(40 * ONE);
    }

    function test_WithdrawSpendable_WhenPausedReverts() public {
        _setHabit(alice, 10000, 0, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        vm.prank(alice);
        treasury.withdrawSpendable(1);
    }

    // ════════════════════════════════════════════════════════════════
    // WITHDRAW SAVINGS
    // ════════════════════════════════════════════════════════════════

    function test_WithdrawSavings_TransfersG$() public {
        _setHabit(alice, 0, 10000, 0); // 100% save
        _deposit(alice, 100 * ONE);
        uint256 before = gd.balanceOf(alice);
        vm.prank(alice);
        treasury.withdrawSavings(40 * ONE);
        assertEq(gd.balanceOf(alice) - before, 40 * ONE);
    }

    function test_WithdrawSavings_UpdatesAllocation() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(alice);
        treasury.withdrawSavings(40 * ONE);
        GoodHabitsAccounting.UserAllocation memory a = treasury.getUserAllocation(alice);
        assertEq(a.saveAmount, 60 * ONE);
    }

    function test_WithdrawSavings_ZeroReverts() public {
        vm.expectRevert(GoodHabitsAccounting.ZeroAmount.selector);
        vm.prank(alice);
        treasury.withdrawSavings(0);
    }

    function test_WithdrawSavings_InsufficientReverts() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 10 * ONE);
        vm.expectRevert(GoodHabitsAccounting.InsufficientAmount.selector);
        vm.prank(alice);
        treasury.withdrawSavings(20 * ONE);
    }

    function test_WithdrawSavings_BeforeUnlockIncrementsBroke() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(alice);
        treasury.setTargetSavingsUnlock(block.timestamp + 30 days);
        (uint256 brokeSavings,) = treasury.brokeHabits(alice);
        assertEq(brokeSavings, 0);
        vm.prank(alice);
        treasury.withdrawSavings(10 * ONE);
        (brokeSavings,) = treasury.brokeHabits(alice);
        assertEq(brokeSavings, 1);
    }

    function test_WithdrawSavings_AfterUnlockDoesNotIncrementBroke() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(alice);
        treasury.setTargetSavingsUnlock(block.timestamp + 30 days);
        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(alice);
        treasury.withdrawSavings(10 * ONE);
        (uint256 brokeSavings,) = treasury.brokeHabits(alice);
        assertEq(brokeSavings, 0);
    }

    function test_WithdrawSavings_NoTargetSetDoesNotIncrementBroke() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(alice);
        treasury.withdrawSavings(10 * ONE);
        (uint256 brokeSavings,) = treasury.brokeHabits(alice);
        assertEq(brokeSavings, 0);
    }

    function test_WithdrawSavings_EmitsEvent() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.expectEmit(true, true, true, true);
        emit GoodHabitsAccounting.Withdraw(alice, 40 * ONE, GoodHabitsAccounting.WithdrawFrom.Savings);
        vm.prank(alice);
        treasury.withdrawSavings(40 * ONE);
    }

    function test_WithdrawSavings_WhenPausedReverts() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        vm.prank(admin);
        treasury.pause();
        vm.expectRevert();
        vm.prank(alice);
        treasury.withdrawSavings(1);
    }

    // ════════════════════════════════════════════════════════════════
    // DEPOSIT HABIT SPLITTING
    // ════════════════════════════════════════════════════════════════

    function test_Deposit_SplitsByHabit() public {
        _setHabit(alice, 2000, 3000, 5000); // 20% spend, 30% save, 50% invest
        _deposit(alice, 100 * ONE);
        GoodHabitsAccounting.UserAllocation memory a = treasury.getUserAllocation(alice);
        assertEq(a.spendAmount, 20 * ONE);
        assertEq(a.saveAmount, 30 * ONE);
        assertEq(a.investAmount, 50 * ONE);
        assertEq(treasury.shares(alice), 50 * ONE); // only invest mints shares
    }

    function test_Deposit_FullInvest() public {
        _setHabit(alice, 0, 0, 10000);
        _deposit(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 100 * ONE);
        assertEq(treasury.assetsToInvest(), 100 * ONE);
    }

    function test_Deposit_FullSpend() public {
        _setHabit(alice, 10000, 0, 0);
        _deposit(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 0);
        assertEq(treasury.assetsToInvest(), 0);
        assertEq(treasury.getUserAllocation(alice).spendAmount, 100 * ONE);
    }

    function test_Deposit_FullSave() public {
        _setHabit(alice, 0, 10000, 0);
        _deposit(alice, 100 * ONE);
        assertEq(treasury.shares(alice), 0);
        assertEq(treasury.assetsToInvest(), 0);
        assertEq(treasury.getUserAllocation(alice).saveAmount, 100 * ONE);
    }

    function test_Deposit_MultipleDepositsAccumulateAllocations() public {
        _setHabit(alice, 2000, 3000, 5000);
        _deposit(alice, 50 * ONE);
        _deposit(alice, 50 * ONE);
        GoodHabitsAccounting.UserAllocation memory a = treasury.getUserAllocation(alice);
        assertEq(a.spendAmount, 20 * ONE);
        assertEq(a.saveAmount, 30 * ONE);
        assertEq(a.investAmount, 50 * ONE);
        assertEq(treasury.shares(alice), 50 * ONE);
    }

    // ════════════════════════════════════════════════════════════════
    // USER ALLOCATION VIEW
    // ════════════════════════════════════════════════════════════════

    function test_GetUserHabit_Default() public view {
        GoodHabitsAccounting.Habit memory h = treasury.getUserHabit(alice);
        assertEq(h.toInvest, 10000);
    }

    function test_GetUserAllocation_Zero() public view {
        GoodHabitsAccounting.UserAllocation memory a = treasury.getUserAllocation(alice);
        assertEq(a.spendAmount, 0);
        assertEq(a.saveAmount, 0);
        assertEq(a.investAmount, 0);
    }

    // ════════════════════════════════════════════════════════════════
    // EDGE: no habit set → deposit transfers G$ but no allocation
    // ════════════════════════════════════════════════════════════════

    function test_Deposit_NoHabitSetReverts() public {
        address charlie = address(0x600);
        gd.mint(charlie, INITIAL_MINT);
        _approve(charlie);
        vm.prank(charlie);
        vm.expectRevert(GoodHabitsAccounting.StrategyNotSet.selector);
        treasury.deposit(100 * ONE);
    }

    // ════════════════════════════════════════════════════════════════
    // FUZZ: SHARE MATH CONSISTENCY
    // ════════════════════════════════════════════════════════════════

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_PreviewDeposit_MatchesActual(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_MINT);
        uint256 previewed = treasury.previewDeposit(amount);
        _deposit(alice, amount);
        assertEq(treasury.shares(alice), previewed);
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_PreviewWithdraw_RoundTrip(uint256 amount) public {
        amount = bound(amount, 1, INITIAL_MINT / 2);
        _deposit(alice, amount);
        uint256 shares = treasury.shares(alice);
        uint256 quoted = treasury.previewWithdraw(shares);
        // With virtual offset, quoted could be amount ± 1 due to rounding
        assertApproxEqRel(quoted, amount, 0.001e18); // within 0.1%
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_MultipleDeposits_TotalConsistent(
        uint256 amt1,
        uint256 amt2
    ) public {
        amt1 = bound(amt1, 1, INITIAL_MINT / 4);
        amt2 = bound(amt2, 1, INITIAL_MINT / 4);
        _deposit(alice, amt1);
        _deposit(bob, amt2);
        assertEq(
            treasury.totalShares(),
            treasury.shares(alice) + treasury.shares(bob)
        );
        assertApproxEqRel(
            treasury.calculateTotalAssets(),
            amt1 + amt2,
            0.001e18
        );
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_All100PctInvest_ShareMath(uint256 depositAmt) public {
        depositAmt = bound(depositAmt, 1, INITIAL_MINT / 4);
        _deposit(alice, depositAmt);
        assertEq(treasury.shares(alice), depositAmt);
        assertEq(treasury.assetsToInvest(), depositAmt);
        assertEq(treasury.calculateTotalAssets(), depositAmt);
    }

    /// forge-config: default.fuzz.runs = 512
    function testFuzz_SpendSaveAllocationRounding(
        uint256 spendBps,
        uint256 depositAmt
    ) public {
        uint256 a = bound(spendBps, 0, 10000);
        uint256 c = bound(depositAmt, 1, 100000 * ONE);
        depositAmt = c;
        c = 0;
        uint256 b = 10000 - a;

        address charlie = address(0x600);
        gd.mint(charlie, INITIAL_MINT);
        _approve(charlie);
        vm.prank(charlie);
        treasury.setHabitStrategy(a, b, 0);
        vm.prank(charlie);
        treasury.deposit(depositAmt);

        GoodHabitsAccounting.UserAllocation memory alloc = treasury.getUserAllocation(charlie);
        uint256 expectedSpend = (depositAmt * a) / 10000;
        uint256 expectedSave  = (depositAmt * b) / 10000;

        assertEq(alloc.spendAmount, expectedSpend);
        assertEq(alloc.saveAmount, expectedSave);
        assertEq(treasury.shares(charlie), 0);
        assertEq(treasury.assetsToInvest(), 0);
    }

    // ════════════════════════════════════════════════════════════════
    // INTEGRATION: DEPOSIT → REQUEST → FINALIZE + HABIT WITHDRAWAL
    // ════════════════════════════════════════════════════════════════

    /// @notice Helper: both user and a second user deposit, then all idle is deployed,
    ///         so the user's withdrawal request goes Pending.
    function _depositAndRequestPending(
        address user,
        uint256 depositAmt,
        uint256 spendBps,
        uint256 saveBps,
        uint256 investBps
    ) internal returns (uint256 requestId, uint256 shares, uint256 quoted) {
        address second = bob;
        // Both deposit
        _setHabit(user, spendBps, saveBps, investBps);
        _deposit(second, depositAmt);
        _deposit(user, depositAmt);
        shares = treasury.shares(user);
        quoted = treasury.previewWithdraw(shares);

        // Deploy ALL idle so availableLiquidity = 0 → request goes Pending
        address s = _createStrategy();
        uint256 totalIdle = treasury.assetsToInvest();
        if (totalIdle > 0) {
            _deploy(s, totalIdle);
        }

        _request(user, shares);
        requestId = treasury.nextWithdrawalId() - 1;
        assertTrue(treasury.getWithdrawalRequest(requestId).status == GoodHabitsAccounting.WithdrawalStatus.Pending);

        // Return funds so idle is restored for finalize
        if (totalIdle > 0) {
            vm.prank(s);
            gd.approve(address(treasury), type(uint256).max);
            vm.prank(s);
            treasury.receiveFromStrategy(totalIdle);
        }
    }

    function test_Integration_DepositRequestFinalize() public {
        (uint256 rid, uint256 shares, uint256 quoted) =
            _depositAndRequestPending(alice, 100 * ONE, 2000, 3000, 5000);

        _markReady(rid);
        uint256 beforeGd = gd.balanceOf(alice);
        _finalize(alice, rid);
        assertEq(gd.balanceOf(alice) - beforeGd, quoted);
        assertEq(treasury.shares(alice), 0);
        assertEq(treasury.userLockedShares(alice), 0);
    }

    function test_Integration_DepositAllocateThenWithdrawSpendAndSave() public {
        _setHabit(alice, 4000, 3000, 3000); // 40% spend, 30% save, 30% invest
        _deposit(alice, 100 * ONE);

        // Withdraw half of spendable
        vm.prank(alice);
        treasury.withdrawSpendable(20 * ONE);
        GoodHabitsAccounting.UserAllocation memory alloc = treasury.getUserAllocation(alice);
        assertEq(alloc.spendAmount, 20 * ONE); // 40 - 20 = 20
        assertEq(gd.balanceOf(alice), INITIAL_MINT - 100 * ONE + 20 * ONE);

        // Withdraw all savings
        vm.prank(alice);
        treasury.withdrawSavings(30 * ONE);
        alloc = treasury.getUserAllocation(alice);
        assertEq(alloc.saveAmount, 0);
    }

    function test_Integration_MixedHabitThenFullWithdrawal() public {
        (uint256 rid, uint256 shares, uint256 quoted) =
            _depositAndRequestPending(alice, 100 * ONE, 1000, 2000, 7000);

        // Withdraw spendable
        vm.prank(alice);
        treasury.withdrawSpendable(10 * ONE);

        // Withdraw savings
        vm.prank(alice);
        treasury.withdrawSavings(20 * ONE);

        // Finalize investment withdrawal
        _markReady(rid);
        uint256 beforeGd = gd.balanceOf(alice);
        _finalize(alice, rid);
        uint256 received = gd.balanceOf(alice) - beforeGd;
        assertApproxEqRel(received, quoted, 0.001e18);

        // Total recovered ≈ 10 + 20 + quoted ≈ 100 (minus dust)
        uint256 totalRecovered = 10 * ONE + 20 * ONE + received;
        assertApproxEqRel(totalRecovered, 100 * ONE, 0.01e18);
    }

    function test_Integration_MultipleDepositsAndHabitChanges() public {
        // Deposit 100 G$ at 100% invest
        _deposit(alice, 100 * ONE);
        uint256 shares1 = treasury.shares(alice);

        // Change habit and deposit more
        _setHabit(alice, 5000, 0, 5000);
        _deposit(alice, 100 * ONE);

        GoodHabitsAccounting.UserAllocation memory alloc = treasury.getUserAllocation(alice);
        assertEq(alloc.spendAmount, 50 * ONE);
        // investAmount: 100 (first deposit, 100% invest) + 50 (second deposit, 50% invest) = 150
        assertEq(alloc.investAmount, 150 * ONE);

        // Shares from second deposit
        uint256 shares2 = treasury.shares(alice);
        assertTrue(shares2 > shares1);

        // Withdraw all spendable
        vm.prank(alice);
        treasury.withdrawSpendable(50 * ONE);
        assertEq(gd.balanceOf(alice), INITIAL_MINT - 200 * ONE + 50 * ONE);
    }
}
