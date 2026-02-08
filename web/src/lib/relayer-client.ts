/**
 * Relayer API Client
 * Communicates with the relayer backend for EIP-7702 transactions
 */

import type { Address, Hex } from 'viem';
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  toHex,
} from 'viem';

export interface Call {
  target: Address;
  value: bigint;
  data: Hex;
}

export interface Authorization {
  contractAddress: Address;
  chainId: number;
  nonce: string;
  r: Hex;
  s: Hex;
  yParity: number;
}

export interface TransactionResult {
  success: boolean;
  txHash: string;
  explorer: string;
  blockNumber?: string;
  gasUsed?: string;
}

export class RelayerClient {
  private relayerUrl: string;
  private smartAccountAddress: Address;
  private chainId: number;

  // Type hash (must match contract)
  private readonly EXECUTE_WITH_FEE_TYPEHASH = keccak256(
    toHex(
      'ExecuteWithFee(bytes32 callsHash,address feeToken,uint256 feeAmount,address feeRecipient,uint256 nonce,uint256 chainId)'
    )
  );

  constructor(relayerUrl: string, smartAccountAddress: Address, chainId: number) {
    this.relayerUrl = relayerUrl;
    this.smartAccountAddress = smartAccountAddress;
    this.chainId = chainId;
  }

  /**
   * Get current nonce from relayer
   */
  async getNonce(userAddress: Address): Promise<bigint> {
    const response = await fetch(`${this.relayerUrl}/nonce/${userAddress}`);

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
    const response = await fetch(`${this.relayerUrl}/stats`);

    if (!response.ok) {
      throw new Error(`Failed to fetch relayer stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if user has stored authorization
   */
  async hasStoredAuthorization(userAddress: Address): Promise<{
    hasAuthorization: boolean;
    hasDelegation: boolean;
  }> {
    const response = await fetch(`${this.relayerUrl}/authorization/${userAddress}`);

    if (!response.ok) {
      throw new Error(`Failed to check authorization: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Hash an array of calls (same logic as contract)
   */
  private hashCalls(calls: Call[]): Hex {
    let concatenated = '0x' as Hex;

    for (const call of calls) {
      const callHash = keccak256(
        encodeAbiParameters(parseAbiParameters('address, uint256, bytes32'), [
          call.target,
          call.value,
          keccak256(call.data),
        ])
      );
      concatenated = concat([concatenated, callHash]);
    }

    return keccak256(concatenated);
  }

  /**
   * Get struct hash for signing
   */
  getStructHash(
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint,
    feeRecipient: Address,
    nonce: bigint
  ): Hex {
    const callsHash = this.hashCalls(calls);

    return keccak256(
      encodeAbiParameters(parseAbiParameters('bytes32, bytes32, address, uint256, address, uint256, uint256'), [
        this.EXECUTE_WITH_FEE_TYPEHASH,
        callsHash,
        feeToken,
        feeAmount,
        feeRecipient,
        nonce,
        BigInt(this.chainId),
      ])
    );
  }

  /**
   * Submit intent to relayer (without authorization - for subsequent txs)
   */
  async submitIntent(
    userAddress: Address,
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint,
    nonce: bigint,
    signature: Hex
  ): Promise<TransactionResult> {
    const response = await fetch(`${this.relayerUrl}/execute-with-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
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

    return response.json();
  }

  /**
   * Submit intent with authorization (for first transaction)
   */
  async submitIntentWithAuthorization(
    userAddress: Address,
    calls: Call[],
    feeToken: Address,
    feeAmount: bigint,
    nonce: bigint,
    signature: Hex,
    authorization: Authorization
  ): Promise<TransactionResult> {
    const response = await fetch(`${this.relayerUrl}/execute-with-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        calls: calls.map((c) => ({
          target: c.target,
          value: c.value.toString(),
          data: c.data,
        })),
        feeToken,
        feeAmount: feeAmount.toString(),
        nonce: nonce.toString(),
        signature,
        authorization,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to submit intent with authorization: ${JSON.stringify(error)}`);
    }

    return response.json();
  }

  /**
   * Store authorization signature without submitting a transaction
   */
  async storeAuthorization(userAddress: Address, authorization: Authorization): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await fetch(`${this.relayerUrl}/store-authorization`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        ...authorization,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to store authorization: ${JSON.stringify(error)}`);
    }

    return response.json();
  }
}
