/**
 * Viem client configuration for Conflux eSpace
 */

import { createPublicClient, createWalletClient, http, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Conflux eSpace Testnet chain configuration
export const confluxESpaceTestnet: Chain = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'CFX',
    symbol: 'CFX',
  },
  rpcUrls: {
    default: {
      http: ['https://evmtestnet.confluxrpc.com'],
    },
    public: {
      http: ['https://evmtestnet.confluxrpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Conflux Scan',
      url: 'https://evmtestnet.confluxscan.com',
    },
  },
  testnet: true,
};

// Conflux eSpace Mainnet chain configuration
export const confluxESpace: Chain = {
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: {
    decimals: 18,
    name: 'CFX',
    symbol: 'CFX',
  },
  rpcUrls: {
    default: {
      http: ['https://evm.confluxrpc.com'],
    },
    public: {
      http: ['https://evm.confluxrpc.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Conflux Scan',
      url: 'https://evm.confluxscan.io',
    },
  },
  testnet: false,
};

// Use testnet by default
const CHAIN = confluxESpaceTestnet;

/**
 * Create a public client for reading blockchain data
 */
export function createConfluxPublicClient() {
  return createPublicClient({
    chain: CHAIN,
    transport: http(),
  });
}

/**
 * Create a wallet client from a private key
 * @param privateKey - Private key (hex string with 0x prefix)
 */
export function createConfluxWalletClient(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);

  return createWalletClient({
    account,
    chain: CHAIN,
    transport: http(),
  });
}

/**
 * Get account from private key
 */
export function getAccountFromPrivateKey(privateKey: `0x${string}`) {
  return privateKeyToAccount(privateKey);
}

/**
 * Smart Account contract address (deployed SimpleSmartAccountV3Simple)
 */
export const SMART_ACCOUNT_ADDRESS = '0xc7B7F951439e7CEc48fC9B428Cf487D9bE75C33F' as const;

/**
 * Smart Account ABI (simplified V3)
 */
export const SMART_ACCOUNT_ABI = [
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
    type: 'event',
    name: 'GranteeAuthorized',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'grantee', type: 'address', indexed: true },
      { name: 'monthlyLimit', type: 'uint256', indexed: false },
      { name: 'perTxLimit', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'GranteeRevoked',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'grantee', type: 'address', indexed: true },
    ],
  },
] as const;

/**
 * Token addresses on Conflux eSpace Testnet
 */
export const TESTNET_TOKENS = {
  // Add your testnet token address here
  USDT: '0xfBeF973C6374A24F0E40EFe7E987219E3c8472c6', // Example testnet token
} as const;
