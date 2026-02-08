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
 * Example 1: Simple transaction - Just log a message (no actual call)
 */
async function exampleSimpleTransaction() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EXAMPLE 1: Simple Transaction`);
  console.log(`${'='.repeat(60)}`);

  // Initialize client
  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  // Get relayer stats
  console.log(`\n--- Relayer Status ---`);
  const stats = await client.getRelayerStats();
  console.log(`Relayer: ${stats.relayerAddress}`);
  console.log(`Balance: ${stats.balance} CFX`);

  // Get user nonce
  const nonce = await client.getNonce();
  console.log(`\nUser nonce: ${nonce}`);

  // Create a simple call (sending 0 CFX to ourselves - basically a no-op)
  const calls: Call[] = [
    {
      target: client.getUserAddress(),
      value: 0n,
      data: '0x',
    },
  ];

  // Estimate fee
  console.log(`\n--- Estimating Fee ---`);
  const feeEstimate = await client.estimateFee(calls);
  console.log(`Estimated gas: ${feeEstimate.estimatedGas}`);
  console.log(`Fee amount: ${feeEstimate.feeAmountFormatted} USDT`);

  // Use a reasonable fee (18 decimals for this testnet token)
  const feeAmount = parseUnits('1.5', 18); // 1.5 tokens

  console.log(`\n--- Submitting Transaction ---`);
  console.log(`⚠️  NOTE: This is the FIRST transaction, so it includes EIP-7702 authorization`);
  console.log(`⚠️  Make sure user has ${feeAmount / BigInt(1e18)} tokens in their wallet!`);

  // Check if this is the first transaction
  if (nonce === 0n) {
    console.log(`\nThis is the first transaction - including authorization...`);
    const result = await client.submitIntentWithAuthorization(
      calls,
      FEE_TOKEN,
      feeAmount
    );

    console.log(`\n✅ SUCCESS!`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`Block: ${result.blockNumber}`);
    console.log(`Gas used: ${result.gasUsed}`);
    console.log(`View on explorer: ${result.explorer}`);
  } else {
    console.log(`\nSubsequent transaction - no authorization needed...`);
    const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);

    console.log(`\n✅ SUCCESS!`);
    console.log(`Transaction: ${result.txHash}`);
    console.log(`View on explorer: ${result.explorer}`);
  }
}

/**
 * Example 2: Token transfer via sponsored transaction
 */
async function exampleTokenTransfer() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EXAMPLE 2: Sponsored Token Transfer`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  // Example: Transfer 2 tokens to another address (for testing)
  const recipient = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address; // Example recipient
  const amount = parseUnits('2', 18); // 2 tokens (18 decimals for this token)

  // Encode ERC20 transfer call
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
      target: FEE_TOKEN, // Transfer the same token we use for fees
      value: 0n,
      data: transferData,
    },
  ];

  // Fee for this transaction
  const feeAmount = parseUnits('0.5', 18); // 0.5 tokens as fee (18 decimals)

  console.log(`\nTransferring 2 tokens to ${recipient}`);
  console.log(`Using token: ${FEE_TOKEN}`);
  console.log(`Fee: 0.5 tokens`);
  console.log(`Total cost: 2.5 tokens (2 transfer + 0.5 fee)`);

  const nonce = await client.getNonce();
  console.log(`\nCurrent nonce: ${nonce}`);

  console.log(`\n--- Submitting Transaction ---`);

  if (nonce === 0n) {
    console.log(`\nFirst transaction - including authorization...`);
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
    console.log(`Transaction: ${result.txHash}`);
    console.log(`View on explorer: ${result.explorer}`);
  }
}

/**
 * Example 3: Batch transaction - Multiple calls in one tx
 */
async function exampleBatchTransaction() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`EXAMPLE 3: Batch Transaction`);
  console.log(`${'='.repeat(60)}`);

  const client = new EIP7702Client({
    privateKey: USER_PRIVATE_KEY,
    smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    relayerUrl: RELAYER_URL,
    chainId: CHAIN_ID,
  });

  // Multiple calls in a single transaction
  const calls: Call[] = [
    // Call 1: Send some CFX to address A
    {
      target: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address,
      value: parseUnits('0.1', 18), // 0.1 CFX
      data: '0x',
    },
    // Call 2: Send some CFX to address B
    {
      target: '0x1234567890123456789012345678901234567890' as Address,
      value: parseUnits('0.05', 18), // 0.05 CFX
      data: '0x',
    },
    // Call 3: Could be a contract interaction, token approval, etc.
    {
      target: client.getUserAddress(),
      value: 0n,
      data: '0x',
    },
  ];

  const feeAmount = parseUnits('1.0', 6); // 1.0 USDT fee

  console.log(`\nExecuting ${calls.length} calls in a single transaction`);
  console.log(`Fee: 1.0 USDT`);

  const nonce = await client.getNonce();

  if (nonce === 0n) {
    const result = await client.submitIntentWithAuthorization(
      calls,
      FEE_TOKEN,
      feeAmount
    );
    console.log(`\n✅ Batch transaction complete! TX: ${result.txHash}`);
  } else {
    const result = await client.submitIntent(calls, FEE_TOKEN, feeAmount);
    console.log(`\n✅ Batch transaction complete! TX: ${result.txHash}`);
  }
}

/**
 * Main function - Run the examples
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

    console.log(`\n🚀 EIP-7702 Gas Sponsorship Client - Examples`);
    console.log(`Network: ${CHAIN_ID === 71 ? 'Testnet' : 'Mainnet'}`);
    console.log(`Relayer: ${RELAYER_URL}`);

    // Run Example 1 - Simple transaction
    // await exampleSimpleTransaction();

    // Run Example 2 - Real token transfer
    await exampleTokenTransfer();

    // Uncomment to run batch example:
    // await exampleBatchTransaction();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ All examples completed successfully!`);
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

export { exampleSimpleTransaction, exampleTokenTransfer, exampleBatchTransaction };
