import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  type Hash,
  formatEther,
  parseUnits,
  encodeFunctionData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem/utils';
import {
  ACTIVE_NETWORK,
  RELAYER_CONFIG,
  SMART_ACCOUNT_ADDRESS,
  SIMPLE_SMART_ACCOUNT_ABI,
  ERC20_ABI,
} from './config.js';

// Define Conflux eSpace chains for viem
export const confluxESpaceTestnet = defineChain({
  id: 71,
  name: 'Conflux eSpace Testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmtestnet.confluxrpc.com'] },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan',
      url: 'https://evmtestnet.confluxscan.io',
    },
  },
});

export const confluxESpaceMainnet = defineChain({
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
  },
  blockExplorers: {
    default: {
      name: 'ConfluxScan',
      url: 'https://evm.confluxscan.io',
    },
  },
});

const activeChain =
  ACTIVE_NETWORK.chainId === 71 ? confluxESpaceTestnet : confluxESpaceMainnet;

// Types
export interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface ExecuteIntent {
  userAddress: Address;
  calls: Call[];
  nonce: bigint;
  signature: Hex;
}

export interface ExecuteWithFeeIntent {
  userAddress: Address;
  calls: Call[];
  feeToken: Address;
  feeAmount: bigint;
  nonce: bigint;
  signature: Hex;
  authorization?: {
    contractAddress: Address;
    chainId: number;
    nonce: bigint;
    r: Hex;
    s: Hex;
    yParity: number;
  };
}

export interface RelayerStats {
  relayerAddress: Address;
  balance: string;
  network: string;
  chainId: number;
  smartAccountAddress: Address;
}

export class RelayerService {
  private account;
  private walletClient;
  private publicClient;

  constructor() {
    // Initialize relayer account
    this.account = privateKeyToAccount(RELAYER_CONFIG.privateKey);

    // Create wallet client for sending transactions
    this.walletClient = createWalletClient({
      account: this.account,
      chain: activeChain,
      transport: http(ACTIVE_NETWORK.rpcUrl),
    });

    // Create public client for reading blockchain state
    this.publicClient = createPublicClient({
      chain: activeChain,
      transport: http(ACTIVE_NETWORK.rpcUrl),
    });

    console.log(`Relayer initialized:`);
    console.log(`  Address: ${this.account.address}`);
    console.log(`  Network: ${ACTIVE_NETWORK.name} (Chain ID: ${ACTIVE_NETWORK.chainId})`);
    console.log(`  RPC: ${ACTIVE_NETWORK.rpcUrl}`);
    console.log(`  SmartAccount: ${SMART_ACCOUNT_ADDRESS}`);
  }

  /**
   * Get relayer stats (balance, address, etc.)
   */
  async getStats(): Promise<RelayerStats> {
    const balance = await this.publicClient.getBalance({
      address: this.account.address,
    });

    return {
      relayerAddress: this.account.address,
      balance: formatEther(balance),
      network: ACTIVE_NETWORK.name,
      chainId: ACTIVE_NETWORK.chainId,
      smartAccountAddress: SMART_ACCOUNT_ADDRESS,
    };
  }

  /**
   * Get nonce for a user account
   * IMPORTANT: Under EIP-7702, storage lives in the EOA's address space!
   * We must call the user's EOA, not the SMART_ACCOUNT contract
   */
  async getNonce(userAddress: Address): Promise<bigint> {
    try {
      // Call the USER's address (which has delegated code), not SMART_ACCOUNT
      const nonce = await this.publicClient.readContract({
        address: userAddress, // ← User's EOA, not SMART_ACCOUNT!
        abi: SIMPLE_SMART_ACCOUNT_ABI,
        functionName: 'getNonce',
        args: [userAddress],
      });

      return nonce as bigint;
    } catch (error) {
      // If contract not deployed or user not delegated yet, nonce is 0
      console.log(`Could not fetch nonce for ${userAddress}, defaulting to 0`);
      return 0n;
    }
  }

  /**
   * Check if user has sufficient token balance for fee payment
   */
  async checkTokenBalance(
    userAddress: Address,
    tokenAddress: Address,
    requiredAmount: bigint
  ): Promise<boolean> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      });

      return (balance as bigint) >= requiredAmount;
    } catch (error) {
      console.error('Error checking token balance:', error);
      return false;
    }
  }

  /**
   * Estimate gas cost in stablecoin (USDT/USDC with 6 decimals)
   */
  async estimateFeeCost(
    estimatedGas: bigint,
    gasPrice: bigint
  ): Promise<bigint> {
    // Calculate gas cost in CFX (wei)
    const gasCostWei = estimatedGas * gasPrice;

    // Add markup for relayer profit (e.g., 10%)
    const gasCostWithMarkup =
      gasCostWei + (gasCostWei * BigInt(Math.floor(RELAYER_CONFIG.feeMarkup * 100))) / 100n;

    // TODO: Fetch CFX/USD price from oracle or exchange
    // For now, assume 1 CFX = $0.10 (this should be replaced with real price feed)
    const cfxPriceUsd = 0.1;

    // Convert to USD amount in stablecoin units (6 decimals for USDT/USDC)
    const gasCostCfx = Number(formatEther(gasCostWithMarkup));
    const gasCostUsd = gasCostCfx * cfxPriceUsd;

    // Return as 6-decimal stablecoin amount
    return parseUnits(gasCostUsd.toFixed(6), 6);
  }

  /**
   * Execute user intent without fee (for testing)
   */
  async executeIntent(intent: ExecuteIntent): Promise<Hash> {
    console.log(`\n=== Executing Intent (No Fee) ===`);
    console.log(`User: ${intent.userAddress}`);
    console.log(`Calls: ${intent.calls.length}`);
    console.log(`Nonce: ${intent.nonce}`);

    // Prepare transaction data
    const txHash = await this.walletClient.writeContract({
      address: SMART_ACCOUNT_ADDRESS,
      abi: SIMPLE_SMART_ACCOUNT_ABI,
      functionName: 'execute',
      args: [intent.calls, intent.nonce, intent.signature],
      account: this.account,
    });

    console.log(`Transaction submitted: ${txHash}`);
    console.log(`Explorer: ${ACTIVE_NETWORK.explorer}/tx/${txHash}`);

    return txHash;
  }

  /**
   * Execute user intent with fee payment (main relayer function)
   */
  async executeIntentWithFee(intent: ExecuteWithFeeIntent): Promise<Hash> {
    console.log(`\n=== Executing Intent With Fee ===`);
    console.log(`User: ${intent.userAddress}`);
    console.log(`Calls: ${intent.calls.length}`);
    console.log(`Fee Token: ${intent.feeToken}`);
    console.log(`Fee Amount: ${intent.feeAmount}`);
    console.log(`Nonce: ${intent.nonce}`);

    // Check if this is the first transaction (needs 7702 authorization)
    const needsAuthorization = intent.authorization !== undefined;

    if (needsAuthorization && intent.authorization) {
      console.log(`First transaction - including EIP-7702 authorization`);

      // For Type 4 transactions with authorization
      // Note: viem's support for EIP-7702 Type 4 txs may vary by version
      // This is the conceptual approach - actual implementation may need adjustment
      const auth = intent.authorization;

      const txHash = await this.walletClient.sendTransaction({
        to: intent.userAddress,
        data: encodeFunctionData({
          abi: SIMPLE_SMART_ACCOUNT_ABI,
          functionName: 'executeWithFee',
          args: [
            intent.calls,
            intent.feeToken,
            intent.feeAmount,
            this.account.address,
            intent.nonce,
            intent.signature,
          ],
        }),
        // @ts-ignore - EIP-7702 support
        authorizationList: [
          {
            address: SMART_ACCOUNT_ADDRESS,
            chainId: auth.chainId,
            nonce: Number(auth.nonce),
            r: auth.r,
            s: auth.s,
            yParity: auth.yParity,
          },
        ],
      });

      console.log(`Type 4 transaction submitted: ${txHash}`);
      console.log(`Explorer: ${ACTIVE_NETWORK.explorer}/tx/${txHash}`);

      return txHash;
    } else {
      // Regular transaction (delegation already exists)
      console.log(`Delegation exists - sending regular transaction`);

      const txHash = await this.walletClient.writeContract({
        address: intent.userAddress, // Call user's EOA directly
        abi: SIMPLE_SMART_ACCOUNT_ABI,
        functionName: 'executeWithFee',
        args: [
          intent.calls,
          intent.feeToken,
          intent.feeAmount,
          this.account.address, // Relayer receives fee
          intent.nonce,
          intent.signature,
        ],
        account: this.account,
      });

      console.log(`Transaction submitted: ${txHash}`);
      console.log(`Explorer: ${ACTIVE_NETWORK.explorer}/tx/${txHash}`);

      return txHash;
    }
  }

  /**
   * Wait for transaction receipt
   */
  async waitForTransaction(txHash: Hash) {
    console.log(`Waiting for transaction confirmation...`);

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed}`);
    console.log(`Status: ${receipt.status}`);

    return receipt;
  }
}
