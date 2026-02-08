import {
  type Address,
  type Hex,
  type WalletClient,
  createWalletClient,
  http,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem/utils';

// Define Conflux eSpace chains
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

// Types
export interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface Authorization {
  contractAddress: Address;
  chainId: number;
  nonce: bigint;
  r: Hex;
  s: Hex;
  yParity: number;
}

export interface SignedIntent {
  userAddress: Address;
  calls: Call[];
  feeToken: Address;
  feeAmount: bigint;
  nonce: bigint;
  signature: Hex;
  authorization?: Authorization;
}

export interface ClientConfig {
  privateKey: `0x${string}`;
  smartAccountAddress: Address;
  relayerUrl: string;
  chainId: 71 | 1030;
  rpcUrl?: string;
}

export class EIP7702Client {
  private account;
  private walletClient: WalletClient;
  private config: ClientConfig;
  private chain;

  // Type hashes (must match contract)
  private readonly EXECUTE_WITH_FEE_TYPEHASH = keccak256(
    toHex(
      'ExecuteWithFee(bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)'
    )
  );

  constructor(config: ClientConfig) {
    this.config = config;
    this.account = privateKeyToAccount(config.privateKey);

    // Select chain
    this.chain =
      config.chainId === 71 ? confluxESpaceTestnet : confluxESpaceMainnet;

    // Create wallet client
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.chain,
      transport: http(config.rpcUrl || this.chain.rpcUrls.default.http[0]),
    });

    console.log(`Client initialized:`);
    console.log(`  User Address: ${this.account.address}`);
    console.log(`  Chain: ${this.chain.name} (${config.chainId})`);
    console.log(`  SmartAccount: ${config.smartAccountAddress}`);
    console.log(`  Relayer: ${config.relayerUrl}`);
  }

  /**
   * Sign EIP-7702 authorization to delegate EOA to SmartAccount
   * This is typically done once per user
   */
  async signAuthorization(): Promise<Authorization> {
    console.log(`\n=== Signing EIP-7702 Authorization ===`);

    // Get current nonce for the user
    const nonce = await this.getNonce();

    // Sign authorization using viem's built-in method
    const authorization = await this.walletClient.signAuthorization({
      account: this.account,
      contractAddress: this.config.smartAccountAddress,
      chainId: this.config.chainId,
      nonce: Number(nonce),
    });

    console.log(`Authorization signed:`);
    console.log(`  Contract: ${this.config.smartAccountAddress}`);
    console.log(`  Chain ID: ${this.config.chainId}`);
    console.log(`  Nonce: ${nonce}`);
    console.log(`  Signature: r=${authorization.r.slice(0, 10)}..., s=${authorization.s.slice(0, 10)}...`);

    return {
      contractAddress: this.config.smartAccountAddress,
      chainId: this.config.chainId,
      nonce,
      r: authorization.r,
      s: authorization.s,
      yParity: authorization.yParity ?? 0,
    };
  }

  /**
   * Hash an array of calls (same logic as contract)
   */
  private hashCalls(calls: Call[]): Hex {
    let concatenated = '0x' as Hex;

    for (const call of calls) {
      const callHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, uint256, bytes32'),
          [call.target, call.value, keccak256(call.data)]
        )
      );
      concatenated = concat([concatenated, callHash]);
    }

    return keccak256(concatenated);
  }

  /**
   * Sign an intent to execute calls with fee payment
   */
  async signIntent(
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint,
    feeRecipient: Address,
    nonce: bigint
  ): Promise<Hex> {
    console.log(`\n=== Signing Intent ===`);
    console.log(`  Calls: ${calls.length}`);
    console.log(`  Fee Token: ${feeToken}`);
    console.log(`  Fee Amount: ${feeAmount}`);
    console.log(`  Nonce: ${nonce}`);

    // Hash the calls array
    const callsHash = this.hashCalls(calls);

    // Create struct hash
    const structHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          'bytes32, bytes32, address, uint256, address, uint256, uint256'
        ),
        [
          this.EXECUTE_WITH_FEE_TYPEHASH,
          callsHash,
          feeToken,
          feeAmount,
          feeRecipient,
          nonce,
          BigInt(this.config.chainId),
        ]
      )
    );

    // Sign with personal sign format (adds "\x19Ethereum Signed Message:\n32" prefix)
    const signature = await this.account.signMessage({
      message: { raw: structHash },
    });

    console.log(`Intent signed: ${signature.slice(0, 20)}...`);

    return signature;
  }

  /**
   * Get current nonce from relayer
   */
  async getNonce(): Promise<bigint> {
    const response = await fetch(
      `${this.config.relayerUrl}/nonce/${this.account.address}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch nonce: ${response.statusText}`);
    }

    const data = (await response.json()) as { nonce: string };
    return BigInt(data.nonce);
  }

  /**
   * Get relayer stats
   */
  async getRelayerStats(): Promise<{
    relayerAddress: string;
    balance: string;
    network: string;
    chainId: number;
  }> {
    const response = await fetch(`${this.config.relayerUrl}/stats`);

    if (!response.ok) {
      throw new Error(`Failed to fetch relayer stats: ${response.statusText}`);
    }

    return response.json() as Promise<{
      relayerAddress: string;
      balance: string;
      network: string;
      chainId: number;
    }>;
  }

  /**
   * Estimate fee for a transaction
   */
  async estimateFee(calls: Call[]): Promise<{
    estimatedGas: string;
    gasPrice: string;
    feeAmount: string;
    feeAmountFormatted: string;
  }> {
    const response = await fetch(`${this.config.relayerUrl}/estimate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calls: calls.map((c) => ({
          target: c.target,
          value: c.value.toString(),
          data: c.data,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to estimate fee: ${response.statusText}`);
    }

    return response.json() as Promise<{
      estimatedGas: string;
      gasPrice: string;
      feeAmount: string;
      feeAmountFormatted: string;
    }>;
  }

  /**
   * Submit intent to relayer (without authorization - for subsequent txs)
   */
  async submitIntent(
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint
  ): Promise<{
    success: boolean;
    txHash: string;
    explorer: string;
    blockNumber?: string;
    gasUsed?: string;
  }> {
    console.log(`\n=== Submitting Intent to Relayer ===`);

    // Get current nonce
    const nonce = await this.getNonce();

    // Get relayer address from stats
    const stats = await this.getRelayerStats();
    const relayerAddress = stats.relayerAddress as Address;

    // Sign intent
    const signature = await this.signIntent(
      calls,
      feeToken,
      feeAmount,
      relayerAddress,
      nonce
    );

    // Submit to relayer
    const response = await fetch(`${this.config.relayerUrl}/execute-with-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: this.account.address,
        calls: calls.map((c) => ({
          target: c.target,
          value: c.value.toString(),
          data: c.data,
        })),
        feeToken,
        feeAmount: feeAmount.toString(),
        nonce: nonce.toString(),
        signature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to submit intent: ${JSON.stringify(error)}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      txHash: string;
      explorer: string;
      blockNumber?: string;
      gasUsed?: string;
    };
    console.log(`\n✅ Transaction submitted!`);
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(`  Explorer: ${result.explorer}`);

    return result;
  }

  /**
   * Submit intent with authorization (for first transaction)
   */
  async submitIntentWithAuthorization(
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint
  ): Promise<{
    success: boolean;
    txHash: string;
    explorer: string;
    blockNumber?: string;
    gasUsed?: string;
  }> {
    console.log(`\n=== Submitting First Transaction (With Authorization) ===`);

    // Sign authorization
    const authorization = await this.signAuthorization();

    // Get current nonce
    const nonce = await this.getNonce();

    // Get relayer address
    const stats = await this.getRelayerStats();
    const relayerAddress = stats.relayerAddress as Address;

    // Sign intent
    const signature = await this.signIntent(
      calls,
      feeToken,
      feeAmount,
      relayerAddress,
      nonce
    );

    // Submit to relayer with authorization
    const response = await fetch(`${this.config.relayerUrl}/execute-with-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress: this.account.address,
        calls: calls.map((c) => ({
          target: c.target,
          value: c.value.toString(),
          data: c.data,
        })),
        feeToken,
        feeAmount: feeAmount.toString(),
        nonce: nonce.toString(),
        signature,
        authorization: {
          contractAddress: authorization.contractAddress,
          chainId: authorization.chainId,
          nonce: authorization.nonce.toString(),
          r: authorization.r,
          s: authorization.s,
          yParity: authorization.yParity,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to submit intent with authorization: ${JSON.stringify(error)}`
      );
    }

    const result = (await response.json()) as {
      success: boolean;
      txHash: string;
      explorer: string;
      blockNumber?: string;
      gasUsed?: string;
    };
    console.log(`\n✅ First transaction submitted!`);
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(`  Explorer: ${result.explorer}`);

    return result;
  }

  /**
   * Helper: Get user address
   */
  getUserAddress(): Address {
    return this.account.address;
  }
}
