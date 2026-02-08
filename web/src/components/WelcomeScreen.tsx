'use client';

import { usePasskey } from '@/hooks/usePasskey';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: () => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const { isSupported } = usePasskey();

  return (
    <div className="min-h-screen flex flex-col items-center px-6 animate-in">
      {/* Logo + tagline at top */}
      <div className="w-full max-w-xs text-center mt-16 space-y-8">
        {/* Logo mark */}
        <div className="mx-auto h-20 w-20 rounded-[22px] bg-white flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.08)]">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-[2.5rem] font-bold tracking-tight leading-none">
            Conflux<br />Wallet
          </h1>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            Passkey-secured. Gas-sponsored.
          </p>
        </div>
      </div>

      {/* CTA pinned to bottom */}
      <div className="w-full max-w-xs mt-auto mb-12 space-y-5">
        {!isSupported ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive text-center">
            Passkeys not supported. Use Chrome, Safari, or Edge.
          </div>
        ) : (
          <button
            onClick={onStart}
            className="w-full group flex items-center justify-center gap-2.5 rounded-2xl bg-white text-black px-6 py-4 text-[15px] font-semibold hover:bg-neutral-100 active:scale-[0.98] transition-all"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        <p className="text-[11px] text-center text-muted-foreground/60 tracking-wide">
          CONFLUX eSPACE &middot; EIP-7702
        </p>
      </div>
    </div>
  );
}
