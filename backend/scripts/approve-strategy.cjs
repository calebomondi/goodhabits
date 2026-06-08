const { createPublicClient, createWalletClient, http } = require('viem')
const { celo } = require('viem/chains')
const { privateKeyToAccount } = require('viem/accounts')

const TREASURY = '0x64E169FB7e544D10e3aF116AB25738A02C402903'
const STRATEGY = '0xb5f3feFeDB2a7c10BECd417215E5183f3E774E82'
const RPC = 'https://celo-mainnet.infura.io/v3/18f7267d6c1544ecad55744dd50b6185'

const ABI = [
  {
    type: 'function',
    name: 'approveStrategy',
    inputs: [{ type: 'address', name: 'strategy' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
]

async function main() {
  const pk = process.env.DEPLOYER_KEY
  if (!pk) {
    console.error('Usage: DEPLOYER_KEY=0x... node scripts/approve-strategy.cjs')
    process.exit(1)
  }

  const key = pk.startsWith('0x') ? pk : `0x${pk}`
  const account = privateKeyToAccount(key)
  console.log('Caller:', account.address)

  const publicClient = createPublicClient({ chain: celo, transport: http(RPC) })
  const walletClient = createWalletClient({ account, chain: celo, transport: http(RPC) })

  console.log(`Approving strategy ${STRATEGY}...`)
  const hash = await walletClient.writeContract({
    address: TREASURY,
    abi: ABI,
    functionName: 'approveStrategy',
    args: [STRATEGY],
    chain: celo,
  })
  console.log('Tx sent:', hash)

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('Status:', receipt.status === 'success' ? 'SUCCESS' : 'FAILED')
}

main().catch(e => {
  console.error('Error:', e.shortMessage || e.message)
  process.exit(1)
})
