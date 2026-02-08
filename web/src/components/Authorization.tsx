'use client';

import { useWallet } from '@/hooks/useWallet';

interface AuthorizationProps {
  walletAddress: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function Authorization({ walletAddress, onComplete, onSkip }: AuthorizationProps) {
  const { authorizeSmartAccount, isAuthorizing, error } = useWallet();

  const handleAuthorize = async () => {
    // Just authorize - no need for passkey since it's just storing a placeholder
    const authSignature = await authorizeSmartAccount();
    if (authSignature) {
      onComplete();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Enable Smart Features
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Authorize your wallet to use subscriptions and gas sponsorship
          </p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
          {!isAuthorizing ? (
            <>
              <div className="space-y-4">
                <Feature
                  icon="⚡"
                  title="Gas Sponsorship"
                  description="Pay transaction fees in USDT/USDC instead of CFX"
                />
                <Feature
                  icon="🔄"
                  title="Auto-Subscriptions"
                  description="Allow services to auto-charge within your set limits"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              <button
                onClick={handleAuthorize}
                disabled={isAuthorizing}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
              >
                Authorize Now
              </button>

              <button
                onClick={onSkip}
                disabled={isAuthorizing}
                className="w-full px-6 py-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
              >
                Skip for Now
              </button>
            </>
          ) : (
            <div className="text-center space-y-4 py-8">
              <svg
                className="animate-spin h-12 w-12 text-purple-600 mx-auto"
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
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                Setting up authorization...
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                This will only take a moment
              </p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>ℹ️ What is this?</strong>
            <br />
            This uses EIP-7702 to delegate your wallet's execution to a smart contract. This is a
            one-time authorization that enables advanced features while keeping you in full control.
          </p>
        </div>
      </div>
    </div>
  );
}

interface FeatureProps {
  icon: string;
  title: string;
  description: string;
}

function Feature({ icon, title, description }: FeatureProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4">
      <div className="text-2xl">{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{description}</p>
      </div>
    </div>
  );
}
