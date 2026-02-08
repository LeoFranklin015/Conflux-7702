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
   * This will prompt for passkey to sign the authorization
   */
  const authorizeSmartAccount = useCallback(async (): Promise<string | null> => {
    setIsAuthorizing(true);
    setError(null);

    try {
      // Use signAndExecute which will automatically prompt for passkey if needed
      const result = await signAndExecute(async (walletClient) => {
        // In a real implementation, this would create and sign an EIP-7702 authorization
        // For now, we'll create a signed message to demonstrate the flow
        const message = `Authorize Smart Account\n\nContract: ${SMART_ACCOUNT_ADDRESS}\nChain ID: 71\nTimestamp: ${Date.now()}`;

        // Sign the authorization message
        const signature = await walletClient.signMessage({
          message,
        });

        return { signature, message };
      });

      if (!result) {
        throw new Error('Failed to sign authorization');
      }

      // Store the signed authorization
      const authData = {
        contractAddress: SMART_ACCOUNT_ADDRESS,
        chainId: 71,
        timestamp: Date.now(),
        address: address,
        signature: result.signature,
      };

      const authString = JSON.stringify(authData);
      storeAuthorizationSignature(authString);
      setHasAuthorization(true);

      return authString;
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
