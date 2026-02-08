'use client';

import { useState, useCallback } from 'react';
import {
  isWebAuthnSupported,
  registerPasskey,
  authenticatePasskey,
  deriveEncryptionKey,
} from '@/utils/webauthn';
import { getPasskeyCredentialId } from '@/utils/storage';

export interface UsePasskeyReturn {
  isSupported: boolean;
  isRegistering: boolean;
  isAuthenticating: boolean;
  error: string | null;
  register: (username: string) => Promise<string | null>;
  authenticate: () => Promise<CryptoKey | null>;
  clearError: () => void;
}

/**
 * Hook for managing passkey registration and authentication
 */
export function usePasskey(): UsePasskeyReturn {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = isWebAuthnSupported();

  /**
   * Register a new passkey and return the credential ID
   */
  const register = useCallback(async (username: string): Promise<string | null> => {
    setIsRegistering(true);
    setError(null);

    try {
      const credentialId = await registerPasskey(username);
      return credentialId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register passkey';
      setError(message);
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  /**
   * Authenticate with passkey and return the derived encryption key
   */
  const authenticate = useCallback(async (): Promise<CryptoKey | null> => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Get stored credential ID
      const credentialId = getPasskeyCredentialId();
      if (!credentialId) {
        throw new Error('No passkey found. Please set up your wallet first.');
      }

      // Authenticate
      const success = await authenticatePasskey(credentialId);
      if (!success) {
        throw new Error('Authentication failed. Please try again.');
      }

      // Derive encryption key from credential ID
      const encryptionKey = await deriveEncryptionKey(credentialId);
      return encryptionKey;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      return null;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isSupported,
    isRegistering,
    isAuthenticating,
    error,
    register,
    authenticate,
    clearError,
  };
}
