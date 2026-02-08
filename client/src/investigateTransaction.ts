import { createPublicClient, http, type Address, type Hex } from 'viem';
import { confluxESpaceTestnet } from './client.js';
import dotenv from 'dotenv';

dotenv.config();

const USER_ADDRESS = '0x1a4Cb37affed4A3Bd060EaaE5016FfcE4b632509' as Address;
const SMART_ACCOUNT = '0x08cB1541928f1F2dddcE9528a5E383A6f85A2fc6' as Address;
const FIRST_TX_HASH = '0x0f3222a44327217ff2c5fd4ff39fc330d3d310dcf80e1067163da6e6d9cb80aa' as Hex;

const SMART_ACCOUNT_ABI = [
  {
    type: 'function',
    name: 'getNonce',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ExecutedWithFee',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
      { name: 'feeToken', type: 'address', indexed: false },
      { name: 'feeAmount', type: 'uint256', indexed: false },
      { name: 'feeRecipient', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Executed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'nonce', type: 'uint256', indexed: false },
    ],
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http('https://evmtestnet.confluxrpc.com'),
  });

  console.log('\n🔍 Investigating First Transaction...\n');
  console.log(`Transaction: ${FIRST_TX_HASH}\n`);

  // 1. Get transaction receipt to see logs
  console.log('='.repeat(60));
  console.log('TRANSACTION RECEIPT');
  console.log('='.repeat(60));

  const receipt = await client.getTransactionReceipt({
    hash: FIRST_TX_HASH,
  });

  console.log(`Status: ${receipt.status === 'success' ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Block: ${receipt.blockNumber}`);
  console.log(`Gas Used: ${receipt.gasUsed}`);
  console.log(`From: ${receipt.from}`);
  console.log(`To: ${receipt.to}`);
  console.log(`Type: ${receipt.type}`);
  console.log(`\nTotal Logs: ${receipt.logs.length}`);

  // 2. Analyze each log
  console.log('\n' + '='.repeat(60));
  console.log('LOG ANALYSIS');
  console.log('='.repeat(60));

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    console.log(`\nLog ${i + 1}:`);
    console.log(`  Address: ${log.address}`);
    console.log(`  Topics[0] (Event Sig): ${log.topics[0]}`);
    console.log(`  Topics: ${log.topics.length} total`);
    console.log(`  Data: ${log.data}`);

    // Try to identify the event
    if (log.topics[0]) {
      // ExecutedWithFee event signature
      const executedWithFeeSig = '0x' + '8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925'; // This is actually ERC20 Transfer
      const transferSig = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

      if (log.topics[0] === transferSig) {
        console.log(`  ➜ This is a Transfer event`);
        if (log.topics[1] && log.topics[2]) {
          const from = '0x' + log.topics[1].slice(26);
          const to = '0x' + log.topics[2].slice(26);
          console.log(`    From: ${from}`);
          console.log(`    To: ${to}`);
          // Amount is in data
          const amount = BigInt(log.data);
          console.log(`    Amount: ${amount}`);
        }
      }
    }
  }

  // 3. Check current nonce from contract
  console.log('\n' + '='.repeat(60));
  console.log('CURRENT CONTRACT STATE');
  console.log('='.repeat(60));

  try {
    const nonce = await client.readContract({
      address: SMART_ACCOUNT,
      abi: SMART_ACCOUNT_ABI,
      functionName: 'getNonce',
      args: [USER_ADDRESS],
    });
    console.log(`\nContract Nonce for ${USER_ADDRESS}:`);
    console.log(`  ${nonce}`);
  } catch (e: any) {
    console.log(`\n❌ Could not read nonce: ${e.message}`);
  }

  // 4. Get the actual transaction data
  console.log('\n' + '='.repeat(60));
  console.log('TRANSACTION DATA');
  console.log('='.repeat(60));

  const tx = await client.getTransaction({
    hash: FIRST_TX_HASH,
  });

  console.log(`\nInput: ${tx.input.slice(0, 100)}...`);
  console.log(`Value: ${tx.value}`);

  // Check if it has authorizationList (Type 4 specific)
  if ('authorizationList' in tx && tx.authorizationList) {
    console.log(`\n✅ Has Authorization List (Type 4 tx)`);
    console.log(`Authorization List: ${JSON.stringify(tx.authorizationList, null, 2)}`);
  }

  // Decode input data
  if (tx.input.length > 10) {
    const functionSelector = tx.input.slice(0, 10);
    console.log(`\nFunction Selector: ${functionSelector}`);

    // executeWithFee selector: 0x + first 8 chars of keccak256("executeWithFee(Call[],address,uint256,address,uint256,bytes)")
    // Let me just show the full input
    console.log(`Full Input Data Length: ${tx.input.length}`);
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n1. Transaction Status: ${receipt.status}`);
  console.log(`2. Number of Logs: ${receipt.logs.length}`);
  console.log(`3. Transaction Type: ${tx.type}`);

  const transferLogs = receipt.logs.filter(
    log => log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
  );
  console.log(`4. Transfer Events: ${transferLogs.length}`);

  console.log(`\n🤔 Analysis:`);
  if (transferLogs.length === 2) {
    console.log(`   - Found ${transferLogs.length} Transfer events`);
    console.log(`   - Expected: 1 Transfer (fee) + 1 ExecutedWithFee event`);
    console.log(`   - Missing: ExecutedWithFee event`);
    console.log(`   - This suggests executeWithFee may not have emitted its event`);
  }
}

main().catch(console.error);
