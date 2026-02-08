'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';

interface WalletCreatedProps {
  passkeyCredentialId: string;
  onWalletCreated: (address: string) => void;
}

export function WalletCreated({ passkeyCredentialId, onWalletCreated }: WalletCreatedProps) {
  const { address, isCreating, error, createWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Auto-create wallet when component mounts
    if (!address && !isCreating) {
      createWallet(passkeyCredentialId);
    }
  }, [passkeyCredentialId, address, isCreating, createWallet]);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContinue = () => {
    if (address) {
      onWalletCreated(address);
    }
  };

  if (isCreating) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <svg
              className="animate-spin h-16 w-16 text-purple-600"
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
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Creating Your Wallet...
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Generating keys and encrypting with your passkey
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Failed to Create Wallet
            </h2>
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-gray-600 px-6 py-3 font-semibold text-white hover:bg-gray-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Success Icon */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Wallet Created!</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Your wallet has been securely created and encrypted
          </p>
        </div>

        {/* Wallet Address */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Wallet Address
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                <code className="text-sm font-mono text-gray-900 dark:text-white break-all">
                  {address}
                </code>
              </div>
              <button
                onClick={handleCopy}
                className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Copy address"
              >
                {copied ? (
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={handleContinue}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-[1.02]"
          >
            Continue
          </button>
        </div>

        {/* Security Info */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 space-y-3">
          <h3 className="font-semibold text-purple-900 dark:text-purple-200">
            🔒 Your Wallet is Secure
          </h3>
          <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-2">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Private key encrypted with your passkey</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Stored locally on your device only</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Decrypted only during signing, then immediately discarded</span>
            </li>
          </ul>
        </div>

        {/* Faucet Link */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>💰 Need testnet CFX?</strong>
            <br />
            Get free testnet tokens at:{' '}
            <a
              href="https://efaucet.confluxnetwork.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              Conflux eSpace Faucet
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
