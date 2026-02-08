'use client';

import { useWallet } from '@/hooks/useWallet';
import { ShieldCheck, Zap, RefreshCw, Loader2, Info } from 'lucide-react';

interface AuthorizationProps {
  walletAddress: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function Authorization({ walletAddress, onComplete, onSkip }: AuthorizationProps) {
  const { authorizeSmartAccount, isAuthorizing, error } = useWallet();

  const handleAuthorize = async () => {
    const authSignature = await authorizeSmartAccount();
    if (authSignature) {
      onComplete();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-in">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Enable Smart Features</h2>
          <p className="text-sm text-muted-foreground">
            Delegate your wallet to use gas sponsorship and subscriptions
          </p>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {!isAuthorizing ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border/50 px-4 py-3">
                  <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Pay fees in USDT instead of CFX</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border/50 px-4 py-3">
                  <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Auto-subscriptions with spending limits</span>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                onClick={handleAuthorize}
                className="w-full rounded-xl bg-white text-black px-6 py-3 font-medium hover:bg-white/90 transition-colors"
              >
                Authorize
              </button>

              <button
                onClick={onSkip}
                className="w-full rounded-xl px-6 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for Now
              </button>
            </>
          ) : (
            <div className="text-center space-y-4 py-8">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto spinner" />
              <div className="space-y-1">
                <p className="font-semibold">Setting up authorization...</p>
                <p className="text-sm text-muted-foreground">This will only take a moment</p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex gap-3 rounded-xl bg-muted/50 border border-border/50 p-4">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            EIP-7702 delegation. One-time setup that enables advanced features while keeping you in full control.
          </p>
        </div>
      </div>
    </div>
  );
}
