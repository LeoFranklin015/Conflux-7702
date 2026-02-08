import { EIP7702Client, type Call } from './client.js';
import { type Address, parseUnits, encodeFunctionData } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY as `0x${string}`;
const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS as Address;
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '71') as 71 | 1030;

// Testnet fee token
const TESTNET_TOKEN = '0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa' as Address;
const FEE_TOKEN = TESTNET_TOKEN;

/**
 * Step 1: Onboarding - Store authorization without transaction
 *
 * This allows users to "sign up" without paying gas or making a transaction.
 * The authorization signature is stored in the relayer's database.
 */
async function onboardUser() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 1: USER ONBOARDING`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  console.log(`\n💡 Benefits of this approach:`);
  console.log(`   - User signs authorization (off-chain, FREE)`);
  console.log(`   - No transaction needed yet`);
  console.log(`   - No CFX balance required`);
  console.log(`   - Can onboard without any tokens`);

  // Check if user already has authorization stored
  const status = await client.hasStoredAuthorization();

  if (status.hasAuthorization) {
    console.log(`\n✅ User already has stored authorization!`);
    console.log(`   Ready to make transactions`);
    return;
  }

  if (status.hasDelegation) {
    console.log(`\n✅ User already has delegation set up!`);
    console.log(`   No authorization needed`);
    return;
  }

  console.log(`\n--- Signing Authorization ---`);
  console.log(`⚠️  This is FREE - no transaction, no gas!`);

  // Sign and store authorization
  const result = await client.storeAuthorization();

  console.log(`\n✅ SUCCESS!`);
  console.log(`   ${result.message}`);
  console.log(`   User is now onboarded and can make transactions anytime!`);
}

/**
 * Step 2: First real transaction - Uses stored authorization
 *
 * When the user makes their first transaction, the relayer will:
 * 1. Retrieve the stored authorization
 * 2. Include it in the Type 4 transaction
 * 3. Execute the user's calls + set up delegation atomically
 * 4. Mark authorization as used
 */
async function firstTransaction() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 2: FIRST TRANSACTION (Uses Stored Authorization)`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  // Check authorization status
  const status = await client.hasStoredAuthorization();

  if (!status.hasAuthorization && !status.hasDelegation) {
    console.log(`\n❌ No stored authorization found!`);
    console.log(`   Please run onboarding first (Step 1)`);
    return;
  }

  console.log(`\n--- Transaction Details ---`);
  const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
  const amount = parseUnits('1', 18); // 1 token

  // Encode token transfer
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
    args: [recipient, amount],
  });

  const calls: Call[] = [
    {
      target: FEE_TOKEN,
      value: 0n,
      data: transferData,
    },
  ];

  const feeAmount = parseUnits('0.3', 18); // 0.3 tokens as fee

  console.log(`Transferring 1 token to ${recipient}`);
  console.log(`Fee: 0.3 tokens`);
  console.log(`Total cost: 1.3 tokens`);

  console.log(`\n--- Submitting Transaction ---`);
  console.log(`💡 Relayer will automatically:`);
  console.log(`   1. Retrieve stored authorization`);
  console.log(`   2. Create Type 4 transaction`);
  console.log(`   3. Set up delegation + execute calls atomically`);

  // Submit transaction WITHOUT providing authorization
  // The relayer will use the stored one!
  const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);

  console.log(`\n✅ SUCCESS!`);
  console.log(`Transaction: ${result.txHash}`);
  console.log(`View on explorer: ${result.explorer}`);

  if (result.usedStoredAuthorization) {
    console.log(`\n🎉 Used stored authorization!`);
    console.log(`   Delegation is now set up`);
    console.log(`   Future transactions won't need authorization`);
  }
}

/**
 * Step 3: Subsequent transactions - No authorization needed
 *
 * After the first transaction, delegation is set up.
 * All future transactions are simple calls to the user's EOA.
 */
async function subsequentTransaction() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`STEP 3: SUBSEQUENT TRANSACTION (No Authorization)`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  const nonce = await client.getNonce();
  console.log(`\nCurrent nonce: ${nonce}`);

  if (nonce === 0n) {
    console.log(`\n❌ User hasn't made first transaction yet!`);
    console.log(`   Please run Step 2 first`);
    return;
  }

  // Simple transaction
  const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
  const amount = parseUnits('0.5', 18); // 0.5 tokens

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
    args: [recipient, amount],
  });

  const calls: Call[] = [
    {
      target: FEE_TOKEN,
      value: 0n,
      data: transferData,
    },
  ];

  const feeAmount = parseUnits('0.2', 18); // 0.2 tokens as fee

  console.log(`\nTransferring 0.5 tokens to ${recipient}`);
  console.log(`Fee: 0.2 tokens`);
  console.log(`Total cost: 0.7 tokens`);

  const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);

  console.log(`\n✅ SUCCESS!`);
  console.log(`Transaction: ${result.txHash}`);
  console.log(`View on explorer: ${result.explorer}`);
}

/**
 * Main function - Run the complete flow
 */
async function main() {
  try {
    if (!USER_PRIVATE_KEY) {
      throw new Error('USER_PRIVATE_KEY not set in environment');
    }
    if (!SMART_ACCOUNT_ADDRESS) {
      throw new Error('SMART_ACCOUNT_ADDRESS not set in environment');
    }

    console.log(`\n🚀 EIP-7702 Onboarding Flow Example`);
    console.log(`Network: ${CHAIN_ID === 71 ? 'Testnet' : 'Mainnet'}`);
    console.log(`Relayer: ${RELAYER_URL}`);

    // Choose which step to run
    const step = process.argv[2] || '1';

    switch (step) {
      case '1':
      case 'onboard':
        await onboardUser();
        break;

      case '2':
      case 'first':
        await firstTransaction();
        break;

      case '3':
      case 'subsequent':
        await subsequentTransaction();
        break;

      case 'all':
        // Run complete flow
        await onboardUser();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait a bit
        await firstTransaction();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait a bit
        await subsequentTransaction();
        break;

      default:
        console.log(`\n❌ Invalid step: ${step}`);
        console.log(`\nUsage:`);
        console.log(`  npm run onboard 1       - Onboard user (store authorization)`);
        console.log(`  npm run onboard 2       - First transaction (uses stored auth)`);
        console.log(`  npm run onboard 3       - Subsequent transaction`);
        console.log(`  npm run onboard all     - Run complete flow`);
        process.exit(1);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Step ${step} completed successfully!`);
    console.log(`${'='.repeat(60)}\n`);
  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { onboardUser, firstTransaction, subsequentTransaction };
