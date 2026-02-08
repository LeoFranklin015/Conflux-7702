'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { SendTokens } from './SendTokens';

interface DashboardProps {
  walletAddress: string;
}

export function Dashboard({ walletAddress }: DashboardProps) {
  const { clearWallet, hasAuthorization } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout? You will need your passkey to access your wallet again.')) {
      clearWallet();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto space-y-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Manage your wallet and subscriptions
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Logout
          </button>
        </div>

        {/* Wallet Card */}
        <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Your Wallet</p>
                <p className="text-2xl font-bold mt-1">Conflux eSpace</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <p className="text-purple-100 text-xs">Address</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono bg-white/10 px-3 py-2 rounded-lg backdrop-blur flex-1 break-all">
                  {walletAddress}
                </code>
                <button
                  onClick={handleCopy}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition backdrop-blur"
                  title="Copy address"
                >
                  {copied ? '✓' : '📋'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatusCard
            title="Smart Account"
            status={hasAuthorization ? 'Authorized' : 'Not Authorized'}
            icon={hasAuthorization ? '✓' : '○'}
            color={hasAuthorization ? 'green' : 'yellow'}
          />
          <StatusCard
            title="Subscriptions"
            status="0 Active"
            icon="🔄"
            color="blue"
          />
        </div>

        {/* Subscriptions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Subscriptions
          </h2>

          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Subscriptions Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Grant permission to services to enable auto-billing
            </p>
            <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-[1.02]">
              Add Subscription
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionButton
              icon="📤"
              title="Send"
              description="Send tokens"
              onClick={() => setShowSendModal(true)}
            />
            <ActionButton
              icon="📥"
              title="Receive"
              description="Get your address"
              onClick={handleCopy}
            />
            <ActionButton
              icon="⚙️"
              title="Settings"
              description="Manage wallet"
              onClick={() => alert('Settings coming soon!')}
            />
          </div>
        </div>

        {/* Footer Links */}
        <div className="flex items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
          <a
            href="https://evmtestnet.confluxscan.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 dark:hover:text-white transition"
          >
            Block Explorer ↗
          </a>
          <a
            href="https://efaucet.confluxnetwork.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 dark:hover:text-white transition"
          >
            Get Testnet CFX ↗
          </a>
        </div>
      </div>

      {/* Send Tokens Modal */}
      {showSendModal && (
        <SendTokens
          walletAddress={walletAddress}
          onClose={() => setShowSendModal(false)}
          onSuccess={(txHash) => {
            console.log('Transaction sent:', txHash);
          }}
        />
      )}
    </div>
  );
}

interface StatusCardProps {
  title: string;
  status: string;
  icon: string;
  color: 'green' | 'yellow' | 'blue';
}

function StatusCard({ title, status, icon, color }: StatusCardProps) {
  const colorClasses = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{status}</p>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

function ActionButton({ icon, title, description, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition text-left"
    >
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
      </div>
    </button>
  );
}
