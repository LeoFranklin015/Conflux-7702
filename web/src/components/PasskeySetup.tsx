'use client';

import { useState } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { Key, ArrowLeft, Loader2, Info } from 'lucide-react';

interface PasskeySetupProps {
  onPasskeyCreated: (credentialId: string) => void;
  onBack: () => void;
}

export function PasskeySetup({ onPasskeyCreated, onBack }: PasskeySetupProps) {
  const { isRegistering, error, register, clearError } = usePasskey();
  const [username, setUsername] = useState('');

  const handleRegister = async () => {
    if (!username.trim()) return;
    clearError();
    const credentialId = await register(username.trim());
    if (credentialId) {
      onPasskeyCreated(credentialId);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-in">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Key className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Create Passkey</h2>
          <p className="text-sm text-muted-foreground">
            Your device will prompt for biometric authentication
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-muted-foreground">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
              disabled={isRegistering}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={!username.trim() || isRegistering}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-3 font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isRegistering ? (
              <>
                <Loader2 className="h-4 w-4 spinner" />
                Creating...
              </>
            ) : (
              'Create Passkey'
            )}
          </button>

          <button
            onClick={onBack}
            disabled={isRegistering}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {/* Tip */}
        <div className="flex gap-3 rounded-xl bg-muted/50 border border-border/50 p-4">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Uses Touch ID, Face ID, or Windows Hello. Your passkey never leaves your device.
          </p>
        </div>
      </div>
    </div>
  );
}
