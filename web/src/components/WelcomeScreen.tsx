'use client';

import { usePasskey } from '@/hooks/usePasskey';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const { isSupported } = usePasskey();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Logo/Icon */}
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-xl">
            <svg
              className="w-12 h-12 text-white"
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

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
            Conflux Wallet
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Secure, passwordless wallet with subscription management
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 pt-8">
          <Feature
            icon="🔐"
            title="Passkey Security"
            description="No passwords to remember. Use biometrics or hardware keys."
          />
          <Feature
            icon="⚡"
            title="Gas Sponsorship"
            description="Pay transaction fees in USDT/USDC instead of CFX."
          />
          <Feature
            icon="🔄"
            title="Auto-Subscriptions"
            description="Grant permission for services to auto-charge within limits."
          />
        </div>

        {/* CTA */}
        <div className="pt-8">
          {!isSupported ? (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-6 text-red-800 dark:text-red-200">
              <p className="font-semibold">⚠️ Passkeys Not Supported</p>
              <p className="text-sm mt-2">
                Your browser doesn't support passkeys. Please use a modern browser like Chrome,
                Safari, or Edge.
              </p>
            </div>
          ) : (
            <button
              onClick={onStart}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-[1.02]"
            >
              Get Started
            </button>
          )}
        </div>

        {/* Footer */}
        <p className="text-sm text-gray-500 dark:text-gray-400 pt-4">
          Built on Conflux eSpace with EIP-7702
        </p>
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
    <div className="flex items-start gap-4 rounded-xl bg-white/60 dark:bg-gray-800/60 p-6 text-left shadow-sm backdrop-blur">
      <div className="text-3xl">{icon}</div>
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{description}</p>
      </div>
    </div>
  );
}
