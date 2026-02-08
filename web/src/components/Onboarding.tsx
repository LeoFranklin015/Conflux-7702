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
  const [username, setUsername] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkExistingWallet = () => {
      if (hasStoredWallet()) {
        const address = getWalletAddress();
        setWalletAddress(address);
        setStep('dashboard');
      } else {
        setStep('welcome');
      }
    };

    checkExistingWallet();
  }, []);

  const handleStart = () => {
    setStep('passkey');
  };

  const handlePasskeyCreated = (credentialId: string, name: string) => {
    setPasskeyCredentialId(credentialId);
    setUsername(name);
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

  if (step === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full spinner" />
      </div>
    );
  }

  return (
    <>
      {step === 'welcome' && <WelcomeScreen onStart={handleStart} />}

      {step === 'passkey' && (
        <PasskeySetup
          onPasskeyCreated={handlePasskeyCreated}
          onBack={() => setStep('welcome')}
        />
      )}

      {step === 'wallet-created' && passkeyCredentialId && username && (
        <WalletCreated
          passkeyCredentialId={passkeyCredentialId}
          username={username}
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
    </>
  );
}
