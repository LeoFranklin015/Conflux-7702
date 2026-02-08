'use client';

import { useState } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { useWallet } from '@/hooks/useWallet';
import { getWalletAddress } from '@/utils/storage';

interface LoginProps {
  onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
  const { authenticate, isAuthenticating, error: passkeyError } = usePasskey();
  const { unlockWallet, error: walletError } = useWallet();
  const [isUnlocking, setIsUnlocking] = useState(false);

  const error = passkeyError || walletError;
  const walletAddress = getWalletAddress();

  const handleLogin = async () => {
    setIsUnlocking(true);

    // Step 1: Authenticate with passkey
    const encryptionKey = await authenticate();
    if (!encryptionKey) {
      setIsUnlocking(false);
      return;
    }

    // Step 2: Unlock wallet
    const unlocked = await unlockWallet(encryptionKey);
    if (unlocked) {
      onLoginSuccess();
    }

    setIsUnlocking(false);
  };

  const isLoading = isAuthenticating || isUnlocking;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-xl">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Unlock your wallet with your passkey
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
          {/* Wallet Address Display */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Wallet Address
            </label>
            <div className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              <code className="text-xs font-mono text-gray-900 dark:text-white break-all">
                {walletAddress}
              </code>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {isAuthenticating ? 'Authenticating...' : 'Unlocking Wallet...'}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                Unlock with Passkey
              </span>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>🔐 Secure Authentication</strong>
            <br />
            Your device will prompt you to use Touch ID, Face ID, Windows Hello, or another
            biometric method to unlock your wallet.
          </p>
        </div>

        {/* Reset Link */}
        <div className="text-center">
          <button
            onClick={() => {
              if (
                confirm(
                  'Are you sure you want to reset your wallet? This will delete all stored data and you will need to create a new wallet.'
                )
              ) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            Lost access? Reset wallet
          </button>
        </div>
      </div>
    </div>
  );
}
