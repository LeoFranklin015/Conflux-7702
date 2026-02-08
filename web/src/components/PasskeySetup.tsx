'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePasskey } from '@/hooks/usePasskey';
import { isUsernameAvailable, formatSubname } from '@/lib/ens';
import { Key, ArrowLeft, Loader2, Info, Check, X } from 'lucide-react';

interface PasskeySetupProps {
  onPasskeyCreated: (credentialId: string, username: string) => void;
  onBack: () => void;
}

export function PasskeySetup({ onPasskeyCreated, onBack }: PasskeySetupProps) {
  const { isRegistering, error, register, clearError } = usePasskey();
  const [username, setUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const checkAvailability = useCallback(async (name: string) => {
    if (!name.trim() || name.trim().length < 3) {
      setIsAvailable(null);
      return;
    }
    setIsChecking(true);
    const available = await isUsernameAvailable(name.trim().toLowerCase());
    setIsAvailable(available);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    setIsAvailable(null);
    const timeout = setTimeout(() => {
      if (username.trim().length >= 3) {
        checkAvailability(username);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [username, checkAvailability]);

  const handleRegister = async () => {
    const name = username.trim().toLowerCase();
    if (!name || name.length < 3 || isAvailable === false) return;
    clearError();
    const credentialId = await register(name);
    if (credentialId) {
      onPasskeyCreated(credentialId, name);
    }
  };

  const canSubmit = username.trim().length >= 3 && isAvailable !== false && !isRegistering;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 animate-in">
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Key className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Choose Username</h2>
          <p className="text-sm text-muted-foreground">
            This will be your on-chain identity
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-muted-foreground">
              Username
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9-]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleRegister()}
                placeholder="alice"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition pr-10"
                disabled={isRegistering}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isChecking && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
                {!isChecking && isAvailable === true && <Check className="h-4 w-4 text-success" />}
                {!isChecking && isAvailable === false && <X className="h-4 w-4 text-destructive" />}
              </div>
            </div>
            {username.trim().length >= 3 && (
              <p className={`text-xs ${isAvailable === false ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isChecking
                  ? 'Checking availability...'
                  : isAvailable === true
                    ? `${formatSubname(username.trim().toLowerCase())} is available`
                    : isAvailable === false
                      ? `${formatSubname(username.trim().toLowerCase())} is taken`
                      : ''}
              </p>
            )}
            {username.trim().length > 0 && username.trim().length < 3 && (
              <p className="text-xs text-muted-foreground">Minimum 3 characters</p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-white text-black px-6 py-3 font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isRegistering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
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
            Your username becomes your ENS identity on conflux.eth. Uses Touch ID, Face ID, or Windows Hello.
          </p>
        </div>
      </div>
    </div>
  );
}
