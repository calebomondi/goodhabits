// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { GoodHabitsStrategyMgmt } from "./GoodHabitsStrategyMgmt.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GoodHabitsAdmin is GoodHabitsStrategyMgmt {
    using SafeERC20 for IERC20;

    // ============================================================
    // ADMIN
    // ============================================================

    function setFeeBps(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        uint256 old = feeBps;
        feeBps = newFeeBps;
        emit FeeBpsUpdated(old, newFeeBps);
    }

    function setRequestTimeout(uint256 newTimeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTimeout == 0) revert InvalidTimeout();
        uint256 old = requestTimeout;
        requestTimeout = newTimeout;
        emit RequestTimeoutUpdated(old, newTimeout);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function rescueToken(address token, address recipient, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (token == address(gDollar)) revert CannotRescueGDollar();
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransfer(recipient, amount);

        emit TokenRescued(token, recipient, amount);
    }
}
