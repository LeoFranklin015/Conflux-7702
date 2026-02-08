'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Check, Copy, Loader2, X, ArrowRight, Lock } from 'lucide-react';

interface WalletCreatedProps {
  passkeyCredentialId: string;
  onWalletCreated: (address: string) => void;
}

export function WalletCreated({ passkeyCredentialId, onWalletCreated }: WalletCreatedProps) {
  const { address, isCreating, error, createWallet } = useWallet();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
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

  if (isCreating) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-muted-foreground mx-auto spinner" />
          <div className="space-y-1">
            <p className="text-lg font-semibold">Creating Wallet</p>
            <p className="text-sm text-muted-foreground">Generating keys and encrypting...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold">Failed to Create Wallet</p>
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl bg-muted px-6 py-3 text-sm font-medium hover:bg-muted/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-in">
      <div className="w-full max-w-sm space-y-8">
        {/* Success */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="h-6 w-6 text-success" />
          </div>
          <h2 className="text-2xl font-bold">Wallet Created</h2>
          <p className="text-sm text-muted-foreground">
            Your wallet is encrypted and stored locally
          </p>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Your Address</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-muted border border-border overflow-hidden">
                <code className="text-xs font-mono break-all">{address}</code>
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 h-[46px] w-[46px] rounded-xl bg-muted border border-border flex items-center justify-center hover:bg-accent transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <button
            onClick={() => address && onWalletCreated(address)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-3 font-medium hover:bg-white/90 transition-colors"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Security info */}
        <div className="flex gap-3 rounded-xl bg-muted/50 border border-border/50 p-4">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Private key encrypted with passkey. Stored locally. Decrypted only during signing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
