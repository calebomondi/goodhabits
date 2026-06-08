// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { GoodHabitsAdmin } from "./GoodHabitsAdmin.sol";
import { GoodHabitsAccounting } from "./GoodHabitsAccounting.sol";

/// @title GoodHabitsTreasury
/// @notice Final (non-abstract) treasury contract. Inherits all domain logic from:
///         GoodHabitsAdmin → GoodHabitsStrategyMgmt → GoodHabitsWithdrawal → GoodHabitsAccounting.
///         Only overrides the `_requireStrategySet()` hook to enforce that callers
///         have set a habit strategy before depositing.
contract GoodHabitsTreasury is GoodHabitsAdmin {

    constructor(address _gDollar, uint256 _feeBps, uint256 _requestTimeout)
        GoodHabitsAccounting(_gDollar, _feeBps, _requestTimeout)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _requireStrategySet() internal view override {
        Habit memory habit = userHabits[msg.sender];
        if (habit.toSpend + habit.toSave + habit.toInvest != 10000) revert StrategyNotSet();
    }
}
