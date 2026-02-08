import { Address } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'RELAYER_PRIVATE_KEY',
  'SMART_ACCOUNT_ADDRESS',
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Network configuration
export const NETWORKS = {
  testnet: {
    name: 'Conflux eSpace Testnet',
    chainId: 71,
    rpcUrl: process.env.TESTNET_RPC_URL || 'https://evmtestnet.confluxrpc.com',
    explorer: 'https://evmtestnet.confluxscan.io',
  },
  mainnet: {
    name: 'Conflux eSpace Mainnet',
    chainId: 1030,
    rpcUrl: process.env.MAINNET_RPC_URL || 'https://evm.confluxrpc.com',
    explorer: 'https://evm.confluxscan.io',
  },
} as const;

// Active network
const networkName = (process.env.NETWORK || 'testnet') as keyof typeof NETWORKS;
if (!NETWORKS[networkName]) {
  throw new Error(`Invalid network: ${networkName}. Must be 'testnet' or 'mainnet'`);
}

export const ACTIVE_NETWORK = NETWORKS[networkName];

// Contract addresses
export const SMART_ACCOUNT_ADDRESS = process.env.SMART_ACCOUNT_ADDRESS as Address;

// Stablecoin addresses (Mainnet)
export const STABLECOIN_ADDRESSES = {
  USDT: '0xfe97E85d13ABD9c1c33384E796F10B73905637cE' as Address,
  USDC: '0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372' as Address,
} as const;

// Relayer configuration
export const RELAYER_CONFIG = {
  privateKey: process.env.RELAYER_PRIVATE_KEY as `0x${string}`,
  port: parseInt(process.env.PORT || '3000', 10),
  maxFeePerGas: BigInt(process.env.MAX_FEE_PER_GAS || '50000000000'), // 50 Gwei default
  maxPriorityFeePerGas: BigInt(process.env.MAX_PRIORITY_FEE_PER_GAS || '2000000000'), // 2 Gwei default
  gasLimitMultiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'), // 20% buffer
  feeMarkup: parseFloat(process.env.FEE_MARKUP || '0.1'), // 10% markup on gas cost
} as const;

// SimpleSmartAccount ABI (only functions we need)
export const SIMPLE_SMART_ACCOUNT_ABI = [
  {
    type: 'function',
    name: 'execute',
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
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeWithFee',
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
      { name: 'nonce', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
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
    name: 'getNonce',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
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
    ],
    stateMutability: 'view',
  },
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
] as const;

// ERC20 ABI (for balance checks)
export const ERC20_ABI = [
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
