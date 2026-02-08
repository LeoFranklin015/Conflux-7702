import { createPublicClient, http, type Address, formatUnits } from 'viem';
import { confluxESpaceTestnet } from './client.js';
import dotenv from 'dotenv';

dotenv.config();

const USER_ADDRESS = '0x1a4Cb37affed4A3Bd060EaaE5016FfcE4b632509' as Address;
const TOKEN_ADDRESS = '0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa' as Address;
const SMART_ACCOUNT = '0x08cB1541928f1F2dddcE9528a5E383A6f85A2fc6' as Address;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;

const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'getNonce',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

async function main() {
  const client = createPublicClient({
    chain: confluxESpaceTestnet,
    transport: http('https://evmtestnet.confluxrpc.com'),
  });

  console.log('\n🔍 Checking Balances...\n');

  // Check token balance
  const balance = await client.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [USER_ADDRESS],
  });

  const decimals = await client.readContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    args: [],
  });

  console.log(`User Address: ${USER_ADDRESS}`);
  console.log(`Token: ${TOKEN_ADDRESS}`);
  console.log(`Balance: ${formatUnits(balance as bigint, decimals as number)} tokens`);
  console.log(`Balance (raw): ${balance}`);

  // Check nonce
  // IMPORTANT: Under EIP-7702, storage is in the EOA's address space!
  // Call the user's EOA, not the SMART_ACCOUNT contract
  try {
    const nonce = await client.readContract({
      address: USER_ADDRESS, // ← User's EOA, not SMART_ACCOUNT!
      abi: CONTRACT_ABI,
      functionName: 'getNonce',
      args: [USER_ADDRESS],
    });
    console.log(`\nContract Nonce: ${nonce}`);
  } catch (e) {
    console.log('\nCould not fetch nonce (delegation might not be set yet)');
  }

  // Check if user has enough for transaction
  const needed = BigInt(2500000); // 2.5 tokens with 6 decimals
  console.log(`\nNeeded for transaction: ${formatUnits(needed, decimals as number)} tokens`);
  console.log(`Have enough? ${(balance as bigint) >= needed ? '✅ YES' : '❌ NO'}`);
}

main();
