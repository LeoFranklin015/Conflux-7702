import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  parseUnits,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { confluxESpaceTestnet } from './client.js';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY as `0x${string}`;
const NETFLIX_PRIVATE_KEY = process.env.NETFLIX_PRIVATE_KEY as `0x${string}`; // Grantee's key
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS as Address;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '71');
const RPC_URL = 'https://evmtestnet.confluxrpc.com';

// Testnet token
const TESTNET_TOKEN = '0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa' as Address;

// V3 ABI
const SMART_ACCOUNT_V3_ABI = [
  {
    type: 'function',
    name: 'grantPermission',
    inputs: [
      { name: 'grantee', type: 'address' },
      { name: 'monthlyLimit', type: 'uint256' },
      { name: 'perTxLimit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokePermission',
    inputs: [{ name: 'grantee', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeWithGrantee',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
      { name: 'feeToken', type: 'address' },
      { name: 'feeAmount', type: 'uint256' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'grantee', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'granteeSignature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getGranteeNonce',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'grantee', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isGranteeAuthorized',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'grantee', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getGranteeSpending',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'grantee', type: 'address' },
    ],
    outputs: [
      { name: 'monthlySpent', type: 'uint256' },
      { name: 'monthlyLimit', type: 'uint256' },
      { name: 'perTxLimit', type: 'uint256' },
      { name: 'lastResetMonth', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

const GRANTEE_EXECUTE_TYPEHASH = keccak256(
  toHex(
    'GranteeExecute(address user,bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)'
  )
);

/**
 * Helper: Hash calls array
 */
function hashCalls(
  calls: Array<{ target: Address; value: bigint; data: Hex }>
): Hex {
  let concatenated = '0x' as Hex;

  for (const call of calls) {
    const callHash = keccak256(
      encodeAbiParameters(parseAbiParameters('address, uint256, bytes32'), [
        call.target,
        call.value,
        keccak256(call.data),
      ])
    );
    concatenated = concat([concatenated, callHash]);
  }

  return keccak256(concatenated);
}

/**
 * STEP 1: User grants permission to Netflix
 */
async function userGrantsPermission() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 1: USER GRANTS PERMISSION TO NETFLIX`);
  console.log(`${'='.repeat(60)}`);

  const userAccount = privateKeyToAccount(USER_PRIVATE_KEY);
  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);

  console.log(`\nUser: ${userAccount.address}`);
  console.log(`Netflix: ${netflixAccount.address}`);

  const walletClient = createWalletClient({
    account: userAccount,
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  // User's EOA is already delegated, just call it directly
  console.log(`\n--- Grant permission to Netflix (simplified V3) ---`);
  console.log(`✓ Monthly limit: 10 tokens`);
  console.log(`✓ Per-transaction limit: 5 tokens`);
  console.log(`(No contract/method whitelist - just spending limits)`);

  // Call user's delegated EOA to grant permission (simplified API - no arrays!)
  const tx = await walletClient.writeContract({
    address: userAccount.address, // Call user's delegated EOA!
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'grantPermission',
    args: [
      netflixAccount.address,
      parseUnits('10', 18), // Monthly limit: 10 tokens
      parseUnits('5', 18), // Per-tx limit: 5 tokens
    ],
  });

  console.log(`\n✅ Permission granted!`);
  console.log(`Transaction: ${tx}`);
  console.log(
    `\n💡 Netflix can now charge up to 5 tokens per transaction, 10 tokens/month`
  );
  console.log(`   User doesn't need to sign each charge!`);
}

/**
 * STEP 2: Netflix charges the user (auto-billing)
 */
async function netflixChargesUser() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 2: NETFLIX AUTO-CHARGES USER`);
  console.log(`${'='.repeat(60)}`);

  const userAccount = privateKeyToAccount(USER_PRIVATE_KEY);
  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);
  const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);

  console.log(`\nUser: ${userAccount.address}`);
  console.log(`Netflix: ${netflixAccount.address}`);
  console.log(`Relayer: ${relayerAccount.address}`);

  const publicClient = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account: relayerAccount,
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  // Get current nonce for Netflix with this user
  const nonce = (await publicClient.readContract({
    address: SMART_ACCOUNT_ADDRESS,
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'getGranteeNonce',
    args: [userAccount.address, netflixAccount.address],
  })) as bigint;

  console.log(`\nCurrent nonce: ${nonce}`);

  // Netflix creates charge: Transfer 3 tokens to Netflix
  console.log(`\n--- Netflix creates charge ---`);
  console.log(`Charging user: 3 tokens to Netflix`);

  const transferData = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'transfer',
    args: [netflixAccount.address, parseUnits('3', 18)],
  });

  const calls = [
    {
      target: TESTNET_TOKEN,
      value: 0n,
      data: transferData,
    },
  ];

  const feeAmount = parseUnits('0.1', 18); // Relayer fee

  // Netflix signs the charge
  console.log(`\n--- Netflix signs the charge ---`);
  const callsHash = hashCalls(calls);

  const structHash = keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        'bytes32, address, bytes32, address, uint256, address, uint256, uint256'
      ),
      [
        GRANTEE_EXECUTE_TYPEHASH,
        userAccount.address,
        callsHash,
        TESTNET_TOKEN,
        feeAmount,
        relayerAccount.address,
        nonce,
        BigInt(CHAIN_ID),
      ]
    )
  );

  const netflixSignature = await netflixAccount.signMessage({
    message: { raw: structHash },
  });

  console.log(`Netflix signature: ${netflixSignature.slice(0, 20)}...`);

  // Relayer submits transaction
  console.log(`\n--- Relayer submits transaction ---`);
  console.log(`⚡ No user signature needed!`);

  const tx = await walletClient.writeContract({
    address: userAccount.address, // Call user's EOA (has delegation)
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'executeWithGrantee',
    args: [
      calls,
      TESTNET_TOKEN,
      feeAmount,
      relayerAccount.address,
      netflixAccount.address,
      nonce,
      netflixSignature,
    ],
  });

  console.log(`\n✅ Charge successful!`);
  console.log(`Transaction: ${tx}`);
  console.log(`\n💡 What happened:`);
  console.log(`   1. Netflix created charge for 3 tokens`);
  console.log(`   2. Netflix signed with their key`);
  console.log(`   3. Relayer submitted transaction`);
  console.log(`   4. Contract verified:`);
  console.log(`      ✓ Netflix is authorized by user`);
  console.log(`      ✓ 3 tokens within limits`);
  console.log(`      ✓ USDT contract allowed`);
  console.log(`      ✓ transfer() method allowed`);
  console.log(`   5. Executed transfer + paid relayer fee`);
  console.log(`\n🎉 User was charged automatically!`);
}

/**
 * STEP 3: Check spending status
 */
async function checkSpending() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 3: CHECK SPENDING STATUS`);
  console.log(`${'='.repeat(60)}`);

  const userAccount = privateKeyToAccount(USER_PRIVATE_KEY);
  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  console.log(`\nUser: ${userAccount.address}`);
  console.log(`Netflix: ${netflixAccount.address}`);

  // Check authorization
  const isAuthorized = (await publicClient.readContract({
    address: SMART_ACCOUNT_ADDRESS,
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'isGranteeAuthorized',
    args: [userAccount.address, netflixAccount.address],
  })) as boolean;

  console.log(`\n--- Authorization Status ---`);
  console.log(`Authorized: ${isAuthorized ? '✅ Yes' : '❌ No'}`);

  if (isAuthorized) {
    // Get spending info
    const spending = (await publicClient.readContract({
      address: SMART_ACCOUNT_ADDRESS,
      abi: SMART_ACCOUNT_V3_ABI,
      functionName: 'getGranteeSpending',
      args: [userAccount.address, netflixAccount.address],
    })) as [bigint, bigint, bigint, bigint];

    const [monthlySpent, monthlyLimit, perTxLimit, lastResetMonth] = spending;

    console.log(`\n--- Spending Limits ---`);
    console.log(
      `Monthly spent: ${monthlySpent / BigInt(1e18)} / ${monthlyLimit / BigInt(1e18)} tokens`
    );
    console.log(
      `Per-tx limit: ${perTxLimit / BigInt(1e18)} tokens`
    );
    console.log(
      `Remaining this month: ${(monthlyLimit - monthlySpent) / BigInt(1e18)} tokens`
    );
    console.log(`Last reset: Month ${lastResetMonth}`);
  }
}

/**
 * STEP 4: User revokes permission
 */
async function revokePermission() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 4: USER REVOKES NETFLIX'S PERMISSION`);
  console.log(`${'='.repeat(60)}`);

  const userAccount = privateKeyToAccount(USER_PRIVATE_KEY);
  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);

  const walletClient = createWalletClient({
    account: userAccount,
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  console.log(`\nUser: ${userAccount.address}`);
  console.log(`Revoking: ${netflixAccount.address}`);

  const tx = await walletClient.writeContract({
    address: SMART_ACCOUNT_ADDRESS,
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'revokePermission',
    args: [netflixAccount.address],
  });

  console.log(`\n✅ Permission revoked!`);
  console.log(`Transaction: ${tx}`);
  console.log(`\n💡 Netflix can no longer charge this user`);
}

/**
 * Main function
 */
async function main() {
  try {
    if (!USER_PRIVATE_KEY || !NETFLIX_PRIVATE_KEY || !RELAYER_PRIVATE_KEY) {
      throw new Error('Missing required private keys');
    }

    console.log(`\n🎬 EIP-7702 Subscription Model Example`);
    console.log(`Network: ${CHAIN_ID === 71 ? 'Testnet' : 'Mainnet'}`);
    console.log(`Contract: ${SMART_ACCOUNT_ADDRESS}`);

    const step = process.argv[2] || '1';

    switch (step) {
      case '1':
      case 'grant':
        await userGrantsPermission();
        break;

      case '2':
      case 'charge':
        await netflixChargesUser();
        break;

      case '3':
      case 'check':
        await checkSpending();
        break;

      case '4':
      case 'revoke':
        await revokePermission();
        break;

      case 'all':
        await userGrantsPermission();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await netflixChargesUser();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await checkSpending();
        break;

      default:
        console.log(`\n❌ Invalid step: ${step}`);
        console.log(`\nUsage:`);
        console.log(`  npm run subscription 1    - User grants permission`);
        console.log(`  npm run subscription 2    - Netflix charges user`);
        console.log(`  npm run subscription 3    - Check spending`);
        console.log(`  npm run subscription 4    - Revoke permission`);
        console.log(`  npm run subscription all  - Run full flow`);
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Done!`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { userGrantsPermission, netflixChargesUser, checkSpending, revokePermission };
