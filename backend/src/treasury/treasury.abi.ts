export const TREASURY_ABI = [
  // ── State-mutating (STRATEGY_ROLE) ──
  {
    type: 'function' as const,
    name: 'deployToStrategy',
    inputs: [
      { type: 'address', name: 'strategy' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'receiveFromStrategy',
    inputs: [{ type: 'uint256', name: 'amount' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'registerPosition',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'uint256', name: 'initialValue' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'closePosition',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'uint256', name: 'returnedAssets' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'updatePositionValue',
    inputs: [
      { type: 'uint256', name: 'tokenId' },
      { type: 'uint256', name: 'value' },
    ],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'markWithdrawalReady',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'finalizeWithdrawal',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'collectFees',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },

  // ── State-mutating (DEFAULT_ADMIN_ROLE) ──
  {
    type: 'function' as const,
    name: 'claimFees',
    inputs: [{ type: 'address', name: 'recipient' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'approveStrategy',
    inputs: [{ type: 'address', name: 'strategy' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'removeStrategy',
    inputs: [{ type: 'address', name: 'strategy' }],
    outputs: [],
    stateMutability: 'nonpayable' as const,
  },

  // ── Read ──
  {
    type: 'function' as const,
    name: 'calculateTotalAssets',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'pricePerShare',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'previewDeposit',
    inputs: [{ type: 'uint256', name: 'assets' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'previewWithdraw',
    inputs: [{ type: 'uint256', name: 'shareAmount' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getPosition',
    inputs: [{ type: 'uint256', name: 'tokenId' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { type: 'uint256', name: 'tokenId' },
          { type: 'uint256', name: 'value' },
          { type: 'uint40', name: 'createdAt' },
          { type: 'bool', name: 'active' },
        ],
      },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getUserPosition',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { type: 'uint256', name: 'unlockedShares' },
          { type: 'uint256', name: 'lockedShares' },
          { type: 'uint256', name: 'ownershipBps' },
          { type: 'uint256', name: 'unlockedValue' },
          { type: 'uint256', name: 'totalValue' },
          { type: 'uint256', name: 'deposited' },
          { type: 'uint256', name: 'withdrawn' },
          { type: 'int256', name: 'pnl' },
        ],
      },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getActivePositionIds',
    inputs: [],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getWithdrawalRequest',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { type: 'uint256', name: 'id' },
          { type: 'uint256', name: 'sharesLocked' },
          { type: 'uint256', name: 'assetsQuoted' },
          { type: 'address', name: 'user' },
          { type: 'uint40', name: 'createdAt' },
          {
            type: 'uint8',
            name: 'status',
          },
        ],
      },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getUserHabit',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { type: 'uint256', name: 'toSpend' },
          { type: 'uint256', name: 'toSave' },
          { type: 'uint256', name: 'toInvest' },
        ],
      },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'getUserAllocation',
    inputs: [{ type: 'address', name: 'user' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { type: 'uint256', name: 'spendAmount' },
          { type: 'uint256', name: 'saveAmount' },
          { type: 'uint256', name: 'investAmount' },
        ],
      },
    ],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'assetsToInvest',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'deployedAssets',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'reservedAssets',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'totalShares',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'accruedFees',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'feeBps',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'shares',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'STRATEGY_ROLE',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view' as const,
  },
  {
    type: 'function' as const,
    name: 'SYNC_ROLE',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view' as const,
  },
] as const
