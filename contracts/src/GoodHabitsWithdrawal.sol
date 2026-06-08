// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { GoodHabitsAccounting } from "./GoodHabitsAccounting.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GoodHabitsWithdrawal is GoodHabitsAccounting {
    using SafeERC20 for IERC20;

    // ============================================================
    // CREATE HABIT STRATEGY
    // ============================================================

    function setHabitStrategy(uint256 toSpend, uint256 toSave, uint256 toInvest) external whenNotPaused {
        if (toSpend + toSave + toInvest != 10000) revert InvalidHabitAllocation();

        userHabits[msg.sender] = Habit({
            toSpend: toSpend,
            toSave: toSave,
            toInvest: toInvest
        });
    }

    function setTargetSavingsUnlock(uint256 timestamp) external whenNotPaused {
        targetSavingsUnlock[msg.sender] = timestamp;
    }

    // ============================================================
    // WITHDRAWAL REQUESTS FROM SPENDABLE/SAVINGS
    // ============================================================

    function withdrawSpendable(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        UserAllocation storage allocation = userAllocations[msg.sender];
        if (allocation.spendAmount < amount) revert InsufficientAmount();

        unchecked {
            allocation.spendAmount -= amount;
        }

        gDollar.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, WithdrawFrom.Spendable);
    }

    function withdrawSavings(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        UserAllocation storage allocation = userAllocations[msg.sender];
        if (allocation.saveAmount < amount) revert InsufficientAmount();

        if(block.timestamp < targetSavingsUnlock[msg.sender]) {
            brokeHabits[msg.sender].savings += 1;
            targetSavingsUnlock[msg.sender] = 0;
        }

        unchecked {
            allocation.saveAmount -= amount;
        }

        gDollar.safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount, WithdrawFrom.Savings);
    }

    // ============================================================
    // WITHDRAWAL REQUESTS FROM INVESTMENT
    // ============================================================

    function requestWithdrawal(uint256 shareAmount) external nonReentrant whenNotPaused {
        if (shareAmount == 0) revert ZeroAmount();
        if (shares[msg.sender] < shareAmount) revert InsufficientShares();
        if (activeRequestCount[msg.sender] >= MAX_ACTIVE_REQUESTS) revert TooManyActiveRequests();

        uint256 _totalShares = totalShares;
        uint256 _totalAssets = calculateTotalAssets();

        uint256 assetsQuoted = (shareAmount * (_totalAssets + VIRTUAL_ASSETS)) / (_totalShares + VIRTUAL_SHARES);

        unchecked {
            shares[msg.sender] -= shareAmount;
            userLockedShares[msg.sender] += shareAmount;
            totalLockedShares += shareAmount;
            activeRequestCount[msg.sender] += 1;
        }

        emit SharesLocked(msg.sender, shareAmount);

        uint256 available = availableLiquidity();
        bool canFulfillImmediately = available >= assetsQuoted;

        unchecked {
            reservedAssets += assetsQuoted;
        }

        emit AssetsReserved(assetsQuoted);

        uint256 id = nextWithdrawalId++;
        WithdrawalStatus status = canFulfillImmediately ? WithdrawalStatus.Ready : WithdrawalStatus.Pending;

        withdrawalRequests[id] = WithdrawalRequest({
            id: id,
            sharesLocked: shareAmount,
            assetsQuoted: assetsQuoted,
            user: msg.sender,
            createdAt: uint40(block.timestamp),
            status: status
        });

        emit WithdrawalRequested(id, msg.sender, shareAmount, assetsQuoted);

        if (status == WithdrawalStatus.Ready) {
            emit WithdrawalReady(id);
        }
    }

    function markWithdrawalReady(uint256 requestId) external onlyRole(STRATEGY_ROLE) {
        WithdrawalRequest storage request = withdrawalRequests[requestId];
        if (request.status != WithdrawalStatus.Pending) revert InvalidRequestStatus();

        request.status = WithdrawalStatus.Ready;
        emit WithdrawalReady(requestId);
    }

    function finalizeWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        if (request.status != WithdrawalStatus.Ready) revert InvalidRequestStatus();
        if (request.user != msg.sender && !hasRole(STRATEGY_ROLE, msg.sender)) revert Unauthorized();

        uint256 assets        = request.assetsQuoted;
        uint256 sharesLocked  = request.sharesLocked;
        address user          = request.user;

        if (assetsToInvest < assets) revert NotEnoughassetsToInvest();

        request.status = WithdrawalStatus.Processed;

        unchecked {
            totalLockedShares            -= sharesLocked;
            userLockedShares[user]       -= sharesLocked;
            activeRequestCount[user]     -= 1;
            reservedAssets               -= assets;
            totalShares                  -= sharesLocked;
            assetsToInvest                   -= assets;
            lifetimeWithdrawn[user]      += assets;
        }

        gDollar.safeTransfer(user, assets);

        emit WithdrawalFinalized(requestId, user, assets);
        emit AssetsReleased(assets);
    }

    function cancelWithdrawal(uint256 requestId) external nonReentrant {
        WithdrawalRequest storage request = withdrawalRequests[requestId];

        bool isOwner = request.user == msg.sender;
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);

        if (!isOwner && !isAdmin) revert Unauthorized();

        if (request.status == WithdrawalStatus.Pending) {
            // allowed for both owner and admin — proceed.
        } else if (request.status == WithdrawalStatus.Ready && isOwner) {
            if (block.timestamp < uint256(request.createdAt) + requestTimeout) revert RequestNotExpired();
        } else {
            revert InvalidRequestStatus();
        }

        uint256 sharesLocked  = request.sharesLocked;
        uint256 assetsQuoted  = request.assetsQuoted;
        address user          = request.user;

        request.status = WithdrawalStatus.Cancelled;

        unchecked {
            shares[user]                 += sharesLocked;
            userLockedShares[user]       -= sharesLocked;
            totalLockedShares            -= sharesLocked;
            activeRequestCount[user]     -= 1;
            reservedAssets               -= assetsQuoted;
        }

        emit WithdrawalCancelled(requestId, user);
        emit SharesUnlocked(user, sharesLocked);
        emit AssetsReleased(assetsQuoted);
    }

    // ============================================================
    // WITHDRAWAL VIEWS
    // ============================================================

    function getWithdrawalRequest(uint256 requestId) external view returns (WithdrawalRequest memory) {
        WithdrawalRequest storage r = withdrawalRequests[requestId];
        if (r.createdAt == 0) revert RequestNotFound();
        return r;
    }

    function getUserHabit(address user) external view returns (Habit memory) {
        return userHabits[user];
    }

    function getUserAllocation(address user) external view returns (UserAllocation memory) {
        return userAllocations[user];
    }
}
