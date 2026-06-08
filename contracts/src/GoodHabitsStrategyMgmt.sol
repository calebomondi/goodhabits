// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { GoodHabitsWithdrawal } from "./GoodHabitsWithdrawal.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GoodHabitsStrategyMgmt is GoodHabitsWithdrawal {
    using SafeERC20 for IERC20;

    // ============================================================
    // NAV ACCOUNTING (with positions)
    // ============================================================

    function calculateTotalAssets() public view virtual override returns (uint256 total) {
        total = assetsToInvest + deployedAssets;
        uint256 len = activePositionIds.length;
        for (uint256 i; i < len; ++i) {
            total += positions[activePositionIds[i]].value;
        }
    }

    // ============================================================
    // STRATEGY FUND MANAGEMENT
    // ============================================================

    function deployToStrategy(address strategy, uint256 amount)
        external
        onlyRole(STRATEGY_ROLE)
    {
        if (!approvedStrategies[strategy]) revert StrategyNotApproved();
        if (amount == 0) revert ZeroAmount();
        if (amount > availableLiquidity()) revert NotEnoughassetsToInvest();

        unchecked {
            assetsToInvest      -= amount;
            deployedAssets  += amount;
        }

        gDollar.safeTransfer(strategy, amount);

        emit DeployedToStrategy(strategy, amount);
    }

    function receiveFromStrategy(uint256 amount) external onlyRole(STRATEGY_ROLE) {
        if (amount == 0) revert ZeroAmount();

        gDollar.safeTransferFrom(msg.sender, address(this), amount);

        uint256 deductFromDeployed = amount < deployedAssets ? amount : deployedAssets;

        unchecked {
            deployedAssets  -= deductFromDeployed;
            assetsToInvest      += amount;
        }

        emit ReceivedFromStrategy(msg.sender, amount);
    }

    // ============================================================
    // POSITION REGISTRY
    // ============================================================

    function registerPosition(uint256 tokenId, uint256 initialValue)
        external
        onlyRole(STRATEGY_ROLE)
    {
        if (positions[tokenId].createdAt != 0) revert PositionAlreadyExists();

        positions[tokenId] = Position({
            tokenId:   tokenId,
            value:     initialValue,
            createdAt: uint40(block.timestamp),
            active:    true
        });

        activePositionIds.push(tokenId);
        positionIndex[tokenId] = activePositionIds.length;

        if (initialValue <= deployedAssets) {
            unchecked { deployedAssets -= initialValue; }
        } else {
            deployedAssets = 0;
        }

        emit PositionRegistered(tokenId, initialValue);
    }

    function closePosition(uint256 tokenId, uint256 returnedAssets)
        external
        onlyRole(STRATEGY_ROLE)
    {
        Position storage pos = positions[tokenId];

        if (pos.createdAt == 0) revert PositionNotFound();
        if (!pos.active) revert PositionNotActive();

        pos.active = false;
        pos.value  = 0;

        uint256 idx = positionIndex[tokenId];
        uint256 lastIdx = activePositionIds.length;

        if (idx != lastIdx) {
            uint256 lastTokenId = activePositionIds[lastIdx - 1];
            activePositionIds[idx - 1] = lastTokenId;
            positionIndex[lastTokenId] = idx;
        }

        activePositionIds.pop();
        delete positionIndex[tokenId];

        unchecked { assetsToInvest += returnedAssets; }

        emit PositionClosed(tokenId, returnedAssets);
    }

    function updatePositionValue(uint256 tokenId, uint256 value)
        external
        onlyRole(SYNC_ROLE)
    {
        Position storage pos = positions[tokenId];

        if (pos.createdAt == 0) revert PositionNotFound();
        if (!pos.active) revert PositionNotActive();

        uint256 oldValue = pos.value;
        pos.value = value;

        emit PositionValueUpdated(tokenId, oldValue, value);
    }

    // ============================================================
    // PROTOCOL FEES
    // ============================================================

    function collectFees() external onlyRole(STRATEGY_ROLE) {
        uint256 currentAssets = calculateTotalAssets();

        if (currentAssets <= lastFeeSnapshot) {
            lastFeeSnapshot = currentAssets;
            return;
        }

        uint256 yieldDelta = currentAssets - lastFeeSnapshot;
        uint256 feeAmount  = (yieldDelta * feeBps) / 10_000;

        if (feeAmount == 0) {
            lastFeeSnapshot = currentAssets;
            return;
        }

        uint256 chargeable = feeAmount < assetsToInvest ? feeAmount : assetsToInvest;

        unchecked {
            assetsToInvest   -= chargeable;
            accruedFees  += chargeable;
        }

        lastFeeSnapshot = calculateTotalAssets();

        emit FeesCollected(yieldDelta, chargeable);
    }

    function claimFees(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToClaim();

        accruedFees = 0;
        gDollar.safeTransfer(recipient, amount);

        emit FeesClaimed(recipient, amount);
    }

    // ============================================================
    // STRATEGY REGISTRY
    // ============================================================

    function approveStrategy(address strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (strategy == address(0)) revert ZeroAddress();
        if (approvedStrategies[strategy]) revert StrategyAlreadyApproved();

        approvedStrategies[strategy] = true;

        emit StrategyApproved(strategy);
    }

    function removeStrategy(address strategy) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!approvedStrategies[strategy]) revert StrategyNotApproved();

        approvedStrategies[strategy] = false;

        emit StrategyRemoved(strategy);
    }

    // ============================================================
    // POSITION VIEWS
    // ============================================================

    function getActivePositionIds() external view returns (uint256[] memory) {
        return activePositionIds;
    }

    function getPosition(uint256 tokenId) external view returns (Position memory) {
        if (positions[tokenId].createdAt == 0) revert PositionNotFound();
        return positions[tokenId];
    }
}
