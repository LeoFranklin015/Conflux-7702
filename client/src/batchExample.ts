import { EIP7702Client, type Call } from './client.js';
import { type Address, parseUnits, encodeFunctionData } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY as `0x${string}`;
const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS as Address;
const RELAYER_URL = process.env.RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '71') as 71 | 1030;

// Stablecoin addresses
const USDT_MAINNET = '0xfe97E85d13ABD9c1c33384E796F10B73905637cE' as Address;
const USDC_MAINNET = '0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372' as Address;

// Testnet fee token
const TESTNET_TOKEN = '0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa' as Address;

// Select fee token based on network
const FEE_TOKEN = CHAIN_ID === 1030 ? USDT_MAINNET : TESTNET_TOKEN;

/**
 * Example: Batch transaction - Multiple operations in a single transaction
 *
 * This demonstrates the power of EIP-7702:
 * - Execute multiple calls atomically (all succeed or all fail)
 * - Save gas by bundling operations
 * - Pay a single fee for multiple actions
 */
async function batchTransactionExample() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BATCH TRANSACTION EXAMPLE`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  console.log(`\n--- Building Batch Transaction ---`);

  // Recipient addresses
  const recipient1 = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
  const recipient2 = '0x1234567890123456789012345678901234567890' as Address;

  // Build multiple calls
  const calls: Call[] = [];

  // Call 1: Transfer 1 token to recipient 1
  console.log(`\n1. Token Transfer to ${recipient1}`);
  const transfer1Data = encodeFunctionData({
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
    args: [recipient1, parseUnits('1', 18)], // 1 token
  });

  calls.push({
    target: FEE_TOKEN,
    value: 0n,
    data: transfer1Data,
  });

  // Call 2: Transfer 0.5 tokens to recipient 2
  console.log(`2. Token Transfer to ${recipient2}`);
  const transfer2Data = encodeFunctionData({
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
    args: [recipient2, parseUnits('0.5', 18)], // 0.5 tokens
  });

  calls.push({
    target: FEE_TOKEN,
    value: 0n,
    data: transfer2Data,
  });

  // Call 3: Send some CFX to recipient 1
  console.log(`3. Send 0.01 CFX to ${recipient1}`);
  calls.push({
    target: recipient1,
    value: parseUnits('0.01', 18), // 0.01 CFX
    data: '0x',
  });

  // Summary
  console.log(`\n--- Transaction Summary ---`);
  console.log(`Total Calls: ${calls.length}`);
  console.log(`  - 1 token to ${recipient1}`);
  console.log(`  - 0.5 tokens to ${recipient2}`);
  console.log(`  - 0.01 CFX to ${recipient1}`);
  console.log(`Fee Token: ${FEE_TOKEN}`);

  // Calculate total cost
  const tokenTransfers = parseUnits('1.5', 18); // 1 + 0.5
  const cfxTransfer = parseUnits('0.01', 18);
  const feeAmount = parseUnits('0.3', 18); // Fee for batch tx
  const totalTokenCost = tokenTransfers + feeAmount; // 1.8 tokens

  console.log(`\nCost Breakdown:`);
  console.log(`  Token Transfers: 1.5 tokens`);
  console.log(`  CFX Transfer: 0.01 CFX`);
  console.log(`  Relayer Fee: 0.3 tokens`);
  console.log(`  Total Token Cost: ${totalTokenCost / BigInt(1e18)} tokens`);

  // Get current nonce
  const nonce = await client.getNonce();
  console.log(`\nCurrent nonce: ${nonce}`);

  // Submit transaction
  console.log(`\n--- Submitting Batch Transaction ---`);

  if (nonce === 0n) {
    console.log(`\n⚠️  First transaction - including EIP-7702 authorization...`);
    const result = await client.submitIntentWithAuthorization(
      calls,
      FEE_TOKEN,
      feeAmount
    );

    console.log(`\n✅ SUCCESS!`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`View on explorer: ${result.explorer}`);
  } else {
    console.log(`\nSubsequent transaction (nonce ${nonce}) - no authorization needed...`);
    const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);

    console.log(`\n✅ SUCCESS!`);
    console.log(`All ${calls.length} operations executed atomically!`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`View on explorer: ${result.explorer}`);
  }

  console.log(`\n💡 Benefits of Batch Transactions:`);
  console.log(`   - All operations execute atomically (all or nothing)`);
  console.log(`   - Single signature required for multiple actions`);
  console.log(`   - Single relayer fee instead of multiple`);
  console.log(`   - Gas efficient compared to separate transactions`);
}

/**
 * Example: Advanced batch with token approvals + swaps
 * This demonstrates a more complex use case
 */
async function advancedBatchExample() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ADVANCED BATCH EXAMPLE: Approve + Transfer`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  const spender = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;
  const approveAmount = parseUnits('10', 18);
  const transferAmount = parseUnits('5', 18);

  console.log(`\n--- Building Advanced Batch ---`);
  console.log(`1. Approve ${approveAmount / BigInt(1e18)} tokens to ${spender}`);
  console.log(`2. Transfer ${transferAmount / BigInt(1e18)} tokens to same address`);

  const calls: Call[] = [];

  // Call 1: Approve tokens
  const approveData = encodeFunctionData({
    abi: [
      {
        type: 'function',
        name: 'approve',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
      },
    ],
    functionName: 'approve',
    args: [spender, approveAmount],
  });

  calls.push({
    target: FEE_TOKEN,
    value: 0n,
    data: approveData,
  });

  // Call 2: Transfer tokens
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
    args: [spender, transferAmount],
  });

  calls.push({
    target: FEE_TOKEN,
    value: 0n,
    data: transferData,
  });

  const feeAmount = parseUnits('0.2', 18);

  console.log(`\nFee: 0.2 tokens`);
  console.log(`Total cost: ${(transferAmount + feeAmount) / BigInt(1e18)} tokens (5 transfer + 0.2 fee)`);

  const nonce = await client.getNonce();
  console.log(`\nCurrent nonce: ${nonce}`);

  console.log(`\n--- Submitting Transaction ---`);

  if (nonce === 0n) {
    const result = await client.submitIntentWithAuthorization(
      calls,
      FEE_TOKEN,
      feeAmount
    );
    console.log(`\n✅ SUCCESS! TX: ${result.txHash}`);
  } else {
    const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);
    console.log(`\n✅ SUCCESS!`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`View on explorer: ${result.explorer}`);
  }

  console.log(`\n✨ In a single transaction, you:`);
  console.log(`   - Approved ${approveAmount / BigInt(1e18)} tokens`);
  console.log(`   - Transferred ${transferAmount / BigInt(1e18)} tokens`);
  console.log(`   - Paid fee in tokens (no CFX needed!)`);
}

/**
 * Main function
 */
async function main() {
  try {
    // Check environment variables
    if (!USER_PRIVATE_KEY) {
      throw new Error('USER_PRIVATE_KEY not set in environment');
    }
    if (!SMART_ACCOUNT_ADDRESS) {
      throw new Error('SMART_ACCOUNT_ADDRESS not set in environment');
    }

    console.log(`\n🚀 EIP-7702 Batch Transaction Examples`);
    console.log(`Network: ${CHAIN_ID === 71 ? 'Testnet' : 'Mainnet'}`);
    console.log(`Relayer: ${RELAYER_URL}`);

    // Run basic batch example
    await batchTransactionExample();

    // Uncomment to run advanced example:
    // await advancedBatchExample();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Batch transaction completed successfully!`);
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

export { batchTransactionExample, advancedBatchExample };
