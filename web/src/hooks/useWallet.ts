'use client';

import { useState, useCallback, useEffect } from 'react';
import { privateKeyToAddress } from 'viem/accounts';
import { generatePrivateKey, encryptPrivateKey, decryptPrivateKey } from '@/utils/crypto';
import {
  hasStoredWallet,
  storeWallet,
  getStoredWallet,
  getWalletAddress,
  clearWallet as clearStoredWallet,
  storeAuthorizationSignature,
  getAuthorizationSignature,
} from '@/utils/storage';
import { deriveEncryptionKey } from '@/utils/webauthn';
import { createConfluxWalletClient, SMART_ACCOUNT_ADDRESS } from '@/lib/viem-client';

export interface UseWalletReturn {
  address: string | null;
  isUnlocked: boolean;
  isCreating: boolean;
  isSigning: boolean;
  isAuthorizing: boolean;
  hasWallet: boolean;
  error: string | null;
  createWallet: (passkeyCredentialId: string) => Promise<string | null>;
  unlockWallet: (encryptionKey: CryptoKey) => Promise<boolean>;
  signAndExecute: <T>(
    action: (walletClient: ReturnType<typeof createConfluxWalletClient>) => Promise<T>
  ) => Promise<T | null>;
  authorizeSmartAccount: () => Promise<string | null>;
  hasAuthorization: boolean;
  clearWallet: () => void;
  clearError: () => void;
}

/**
 * Hook for managing wallet creation, unlocking, and signing
 */
export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [hasAuthorization, setHasAuthorization] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlockedPrivateKey, setUnlockedPrivateKey] = useState<`0x${string}` | null>(null);

  // Check if wallet exists on mount
  useEffect(() => {
    const walletExists = hasStoredWallet();
    setHasWallet(walletExists);

    if (walletExists) {
      const storedAddress = getWalletAddress();
      setAddress(storedAddress);

      const authSig = getAuthorizationSignature();
      setHasAuthorization(authSig !== null);
    }
  }, []);

  /**
   * Create a new wallet and encrypt it with the passkey
   */
  const createWallet = useCallback(
    async (passkeyCredentialId: string): Promise<string | null> => {
      setIsCreating(true);
      setError(null);

      try {
        // Generate new private key
        const privateKey = generatePrivateKey();

        // Derive address
        const walletAddress = privateKeyToAddress(privateKey as `0x${string}`);

        // Derive encryption key from passkey
        const encryptionKey = await deriveEncryptionKey(passkeyCredentialId);

        // Encrypt private key
        const encryptedPrivateKey = await encryptPrivateKey(privateKey, encryptionKey);

        // Store encrypted wallet
        storeWallet({
          encryptedPrivateKey,
          walletAddress,
          passkeyCredentialId,
        });

        setAddress(walletAddress);
        setHasWallet(true);

        return walletAddress;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create wallet';
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  /**
   * Unlock wallet using encryption key from passkey authentication
   * This keeps the private key in memory for signing operations
   */
  const unlockWallet = useCallback(async (encryptionKey: CryptoKey): Promise<boolean> => {
    setError(null);

    try {
      const wallet = getStoredWallet();
      if (!wallet) {
        throw new Error('No wallet found');
      }

      // Decrypt private key
      const privateKey = await decryptPrivateKey(wallet.encryptedPrivateKey, encryptionKey);

      // Store in memory (will be cleared on lock/refresh)
      setUnlockedPrivateKey(privateKey as `0x${string}`);
      setIsUnlocked(true);
      setAddress(wallet.walletAddress);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock wallet';
      setError(message);
      return false;
    }
  }, []);

  /**
   * Sign and execute a transaction
   * Automatically prompts for passkey if wallet is locked
   */
  const signAndExecute = useCallback(
    async <T,>(
      action: (walletClient: ReturnType<typeof createConfluxWalletClient>) => Promise<T>
    ): Promise<T | null> => {
      setIsSigning(true);
      setError(null);

      try {
        let privateKey = unlockedPrivateKey;

        // If wallet is locked, prompt for passkey authentication
        if (!privateKey) {
          const wallet = getStoredWallet();
          if (!wallet) {
            throw new Error('No wallet found');
          }

          // Import deriveEncryptionKey and authenticatePasskey dynamically to avoid circular deps
          const { deriveEncryptionKey } = await import('@/utils/webauthn');
          const { authenticatePasskey } = await import('@/utils/webauthn');

          // Authenticate with passkey
          const credentialId = wallet.passkeyCredentialId;
          const authenticated = await authenticatePasskey(credentialId);
          if (!authenticated) {
            throw new Error('Authentication failed');
          }

          // Derive encryption key and decrypt
          const encryptionKey = await deriveEncryptionKey(credentialId);
          privateKey = (await decryptPrivateKey(
            wallet.encryptedPrivateKey,
            encryptionKey
          )) as `0x${string}`;

          // Store in memory for this session
          setUnlockedPrivateKey(privateKey);
          setIsUnlocked(true);
        }

        // Create wallet client with unlocked key
        const walletClient = createConfluxWalletClient(privateKey);

        // Execute the action
        const result = await action(walletClient);

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        return null;
      } finally {
        setIsSigning(false);
      }
    },
    [unlockedPrivateKey]
  );

  /**
   * Authorize the smart account using EIP-7702
   * Signs a real EIP-7702 authorization and stores it in the relayer DB
   */
  const authorizeSmartAccount = useCallback(async (): Promise<string | null> => {
    setIsAuthorizing(true);
    setError(null);

    const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3000';
    const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '71');

    try {
      const result = await signAndExecute(async (walletClient) => {
        // Get the account's current chain nonce for the authorization
        const nonce = 0; // First authorization

        // Sign EIP-7702 authorization
        const auth = await walletClient.signAuthorization({
          account: walletClient.account!,
          contractAddress: SMART_ACCOUNT_ADDRESS as `0x${string}`,
          chainId: CHAIN_ID,
          nonce,
        });

        // Store authorization in relayer DB
        const response = await fetch(`${RELAYER_URL}/store-authorization`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: walletClient.account!.address,
            contractAddress: SMART_ACCOUNT_ADDRESS,
            chainId: CHAIN_ID,
            nonce: nonce.toString(),
            r: auth.r,
            s: auth.s,
            yParity: auth.yParity ?? 0,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to store authorization: ${JSON.stringify(error)}`);
        }

        return response.json();
      });

      if (!result) {
        throw new Error('Failed to sign authorization');
      }

      // Store locally that we have authorization
      storeAuthorizationSignature(JSON.stringify({ stored: true, timestamp: Date.now() }));
      setHasAuthorization(true);

      return 'authorized';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authorization failed';
      setError(message);
      return null;
    } finally {
      setIsAuthorizing(false);
    }
  }, [address, signAndExecute]);

  /**
   * Clear wallet and logout
   */
  const clearWallet = useCallback(() => {
    clearStoredWallet();
    setAddress(null);
    setIsUnlocked(false);
    setHasWallet(false);
    setHasAuthorization(false);
    setUnlockedPrivateKey(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    address,
    isUnlocked,
    isCreating,
    isSigning,
    isAuthorizing,
    hasWallet,
    hasAuthorization,
    error,
    createWallet,
    unlockWallet,
    signAndExecute,
    authorizeSmartAccount,
    clearWallet,
    clearError,
  };
}
