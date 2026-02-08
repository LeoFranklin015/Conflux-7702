'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { getENSName } from '@/utils/storage';
import { SendTokens } from './SendTokens';
import { ManageSubscriptions } from './ManageSubscriptions';
import {
  Copy, Check, LogOut, Send, Download, Settings,
  ShieldCheck, RefreshCw, ExternalLink,
} from 'lucide-react';

interface DashboardProps {
  walletAddress: string;
}

export function Dashboard({ walletAddress }: DashboardProps) {
  const { clearWallet, hasAuthorization } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(false);
  const ensName = getENSName();

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    if (confirm('Logout? You will need your passkey to access your wallet again.')) {
      clearWallet();
      window.location.reload();
    }
  };

  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  return (
    <div className="min-h-screen animate-in">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold">Conflux Wallet</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Wallet card */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Wallet</span>
            <span className="text-xs text-muted-foreground">Conflux eSpace Testnet</span>
          </div>

          {ensName && (
            <p className="text-lg font-semibold">{ensName}</p>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <code className="text-sm font-mono break-all text-foreground">{walletAddress}</code>
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Status row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Smart Account</span>
            </div>
            <p className={`text-sm font-medium ${hasAuthorization ? 'text-success' : 'text-muted-foreground'}`}>
              {hasAuthorization ? 'Authorized' : 'Not Set Up'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Subscriptions</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">0 Active</p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            <ActionButton icon={<Send className="h-4 w-4" />} label="Send" onClick={() => setShowSendModal(true)} />
            <ActionButton icon={<Download className="h-4 w-4" />} label="Receive" onClick={handleCopy} />
            <ActionButton icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => alert('Settings coming soon')} />
          </div>
        </div>

        {/* Subscriptions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Subscriptions</h2>
            <button
              onClick={() => setShowSubscriptions(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Manage
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Grant permission to services for auto-billing with spending limits
            </p>
            <button
              onClick={() => setShowSubscriptions(true)}
              className="rounded-xl bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-white/90 transition-colors"
            >
              Manage Subscriptions
            </button>
          </div>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
          <a
            href={`https://evmtestnet.confluxscan.io/address/${walletAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://efaucet.confluxnetwork.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Faucet <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </main>

      {showSendModal && (
        <SendTokens
          walletAddress={walletAddress}
          onClose={() => setShowSendModal(false)}
          onSuccess={(txHash) => console.log('Transaction sent:', txHash)}
        />
      )}

      {showSubscriptions && (
        <ManageSubscriptions
          walletAddress={walletAddress}
          onClose={() => setShowSubscriptions(false)}
        />
      )}
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:bg-accent transition-colors"
    >
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
