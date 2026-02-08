'use client';

import { useState, useEffect } from 'react';
import { hasStoredWallet, getWalletAddress } from '@/utils/storage';
import { WelcomeScreen } from './WelcomeScreen';
import { PasskeySetup } from './PasskeySetup';
import { WalletCreated } from './WalletCreated';
import { Authorization } from './Authorization';
import { Dashboard } from './Dashboard';

type OnboardingStep = 'checking' | 'welcome' | 'passkey' | 'wallet-created' | 'authorization' | 'dashboard';

export function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('checking');
  const [passkeyCredentialId, setPasskeyCredentialId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Check if wallet already exists on mount
  useEffect(() => {
    const checkExistingWallet = () => {
      if (hasStoredWallet()) {
        const address = getWalletAddress();
        setWalletAddress(address);
        setStep('dashboard'); // Go directly to dashboard
      } else {
        setStep('welcome');
      }
    };

    checkExistingWallet();
  }, []);

  const handleStart = () => {
    setStep('passkey');
  };

  const handlePasskeyCreated = (credentialId: string) => {
    setPasskeyCredentialId(credentialId);
    setStep('wallet-created');
  };

  const handleWalletCreated = (address: string) => {
    setWalletAddress(address);
    setStep('authorization');
  };

  const handleAuthorizationComplete = () => {
    setStep('dashboard');
  };

  const handleSkipAuthorization = () => {
    setStep('dashboard');
  };

  // Show loading state while checking
  if (step === 'checking') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-12 w-12 text-purple-600 mx-auto mb-4"
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
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {step === 'welcome' && <WelcomeScreen onStart={handleStart} />}

      {step === 'passkey' && (
        <PasskeySetup
          onPasskeyCreated={handlePasskeyCreated}
          onBack={() => setStep('welcome')}
        />
      )}

      {step === 'wallet-created' && passkeyCredentialId && (
        <WalletCreated
          passkeyCredentialId={passkeyCredentialId}
          onWalletCreated={handleWalletCreated}
        />
      )}

      {step === 'authorization' && walletAddress && (
        <Authorization
          walletAddress={walletAddress}
          onComplete={handleAuthorizationComplete}
          onSkip={handleSkipAuthorization}
        />
      )}

      {step === 'dashboard' && walletAddress && <Dashboard walletAddress={walletAddress} />}
    </div>
  );
}
