'use client';

import { useState } from 'react';
import { usePasskey } from '@/hooks/usePasskey';

interface PasskeySetupProps {
  onPasskeyCreated: (credentialId: string) => void;
  onBack: () => void;
}

export function PasskeySetup({ onPasskeyCreated, onBack }: PasskeySetupProps) {
  const { isRegistering, error, register, clearError } = usePasskey();
  const [username, setUsername] = useState('');

  const handleRegister = async () => {
    if (!username.trim()) {
      return;
    }

    clearError();
    const credentialId = await register(username.trim());

    if (credentialId) {
      onPasskeyCreated(credentialId);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-purple-600 dark:text-purple-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Set Up Your Passkey</h2>
          <p className="text-gray-600 dark:text-gray-300">
            Create a secure passkey using your device's biometric authentication
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Username or Email
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              disabled={isRegistering}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              This will be used to identify your passkey
            </p>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            onClick={handleRegister}
            disabled={!username.trim() || isRegistering}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02]"
          >
            {isRegistering ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
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
                Creating Passkey...
              </span>
            ) : (
              'Create Passkey'
            )}
          </button>

          <button
            onClick={onBack}
            disabled={isRegistering}
            className="w-full px-6 py-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← Back
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>💡 Tip:</strong> Your device will prompt you to use Touch ID, Face ID, Windows
            Hello, or another biometric method. This passkey never leaves your device and cannot be
            stolen.
          </p>
        </div>
      </div>
    </div>
  );
}
