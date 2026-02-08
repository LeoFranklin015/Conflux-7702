import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { confluxESpaceTestnet } from './client.js';
import dotenv from 'dotenv';

dotenv.config();

const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY as `0x${string}`;
const NETFLIX_PRIVATE_KEY = process.env.NETFLIX_PRIVATE_KEY as `0x${string}`;
const RPC_URL = 'https://evmtestnet.confluxrpc.com';

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

async function main() {
  const userAccount = privateKeyToAccount(USER_PRIVATE_KEY);
  const netflixAccount = privateKeyToAccount(NETFLIX_PRIVATE_KEY);

  console.log(`User: ${userAccount.address}`);
  console.log(`Netflix (grantee): ${netflixAccount.address}`);

  const walletClient = createWalletClient({
    account: userAccount,
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http(RPC_URL),
  });

  // Grant permission: call user's own delegated EOA
  console.log(`\nGranting permission...`);
  console.log(`  Monthly limit: 10 tokens`);
  console.log(`  Per-tx limit: 5 tokens`);

  const tx = await walletClient.writeContract({
    address: userAccount.address, // User's delegated EOA
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'grantPermission',
    args: [
      netflixAccount.address,
      parseUnits('10', 18),
      parseUnits('5', 18),
    ],
  });

  console.log(`\nTX: ${tx}`);
  console.log(`Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

  // Verify
  const isAuthorized = await publicClient.readContract({
    address: userAccount.address,
    abi: SMART_ACCOUNT_V3_ABI,
    functionName: 'isGranteeAuthorized',
    args: [userAccount.address, netflixAccount.address],
  });

  console.log(`\nAuthorized: ${isAuthorized}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
