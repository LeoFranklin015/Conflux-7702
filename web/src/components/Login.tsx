'use client';

import { useState } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { useWallet } from '@/hooks/useWallet';
import { getWalletAddress } from '@/utils/storage';
import { Shield, Key, Loader2 } from 'lucide-react';

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
    const encryptionKey = await authenticate();
    if (!encryptionKey) {
      setIsUnlocking(false);
      return;
    }
    const unlocked = await unlockWallet(encryptionKey);
    if (unlocked) {
      onLoginSuccess();
    }
    setIsUnlocking(false);
  };

  const isLoading = isAuthenticating || isUnlocking;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-in">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white flex items-center justify-center">
            <Shield className="h-8 w-8 text-black" />
          </div>
          <h2 className="text-2xl font-bold">Welcome Back</h2>
          <p className="text-sm text-muted-foreground">Unlock your wallet with your passkey</p>
        </div>

        {/* Card */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Wallet</label>
            <div className="px-4 py-3 rounded-xl bg-muted border border-border">
              <code className="text-xs font-mono break-all">{walletAddress}</code>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-3.5 font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 spinner" />
                {isAuthenticating ? 'Authenticating...' : 'Unlocking...'}
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Unlock with Passkey
              </>
            )}
          </button>
        </div>

        {/* Reset */}
        <div className="text-center">
          <button
            onClick={() => {
              if (confirm('Reset wallet? This deletes all stored data.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Lost access? Reset wallet
          </button>
        </div>
      </div>
    </div>
  );
}
