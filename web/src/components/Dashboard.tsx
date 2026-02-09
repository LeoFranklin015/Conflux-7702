'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useEnsResolve } from '@/hooks/useEnsResolve';
import { getENSName } from '@/utils/storage';
import { createConfluxPublicClient, TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS, SMART_ACCOUNT_ABI } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';
import { SendTokens } from './SendTokens';
import { ManageSubscriptions } from './ManageSubscriptions';
import { formatUnits, parseUnits, encodeFunctionData, isAddress, type Address, erc20Abi } from 'viem';
import {
  Copy, Check, Send, Download,
  ShieldCheck, ExternalLink, Wallet, RefreshCw, Settings, Gift, Plus, Loader2,
} from 'lucide-react';

type Tab = 'wallet' | 'subscriptions' | 'giftcards' | 'settings';

interface DashboardProps {
  walletAddress: string;
}

export function Dashboard({ walletAddress }: DashboardProps) {
  const { clearWallet, hasAuthorization } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('wallet');
  const [cfxBalance, setCfxBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [loadingBalances, setLoadingBalances] = useState(true);
  const ensName = getENSName();

  const shortAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  const fetchBalances = async () => {
    setLoadingBalances(true);
    try {
      const client = createConfluxPublicClient();
      const [cfx, usdc] = await Promise.all([
        client.getBalance({ address: walletAddress as Address }),
        client.readContract({
          address: TESTNET_TOKENS.USDT as Address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [walletAddress as Address],
        }),
      ]);
      setCfxBalance(formatUnits(cfx, 18));
      setUsdcBalance(formatUnits(usdc, 18));
    } catch (err) {
      console.error('Failed to fetch balances:', err);
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 15000);
    return () => clearInterval(interval);
  }, [walletAddress]);

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

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.0001) return '<0.0001';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  return (
    <div className="min-h-screen animate-in flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-sm font-semibold">Conflux Wallet</span>
          <span className="text-xs text-muted-foreground">Conflux eSpace Testnet</span>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 max-w-2xl mx-auto px-6 py-6 space-y-6 w-full pb-24">
        {activeTab === 'wallet' && (
          <>
            {/* Wallet card */}
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Wallet</span>
                <button
                  onClick={fetchBalances}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh balances"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingBalances ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {ensName && (
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{ensName}</p>
                  {hasAuthorization && (
                    <ShieldCheck className="h-4 w-4 text-success" />
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-foreground">{shortAddress}</code>
                </div>
                <button
                  onClick={handleCopy}
                  className="shrink-0 h-8 w-8 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>

            {/* Token balances */}
            <div className="space-y-3">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tokens</h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                <TokenRow
                  symbol="CFX"
                  name="Conflux"
                  balance={formatBalance(cfxBalance)}
                  loading={loadingBalances}
                />
                <TokenRow
                  symbol="USDC"
                  name="USD Coin"
                  balance={formatBalance(usdcBalance)}
                  loading={loadingBalances}
                />
              </div>
            </div>

            {/* Quick actions */}
            <div className="space-y-3">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <ActionButton icon={<Send className="h-4 w-4" />} label="Send" onClick={() => setShowSendModal(true)} />
                <ActionButton icon={<Download className="h-4 w-4" />} label="Receive" onClick={handleCopy} />
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
          </>
        )}

        {activeTab === 'subscriptions' && (
          <ManageSubscriptions
            walletAddress={walletAddress}
            onClose={() => setActiveTab('wallet')}
            inline
          />
        )}

        {activeTab === 'giftcards' && (
          <GiftCardsTab walletAddress={walletAddress} />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Settings</h2>

            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              <a
                href={`https://evmtestnet.confluxscan.io/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
              >
                <span className="text-sm">View on Explorer</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              <a
                href="https://efaucet.confluxnetwork.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
              >
                <span className="text-sm">Get Testnet CFX</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </div>

            <button
              onClick={handleLogout}
              className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </main>

      {/* Bottom navbar */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16">
          <NavButton
            icon={<Wallet className="h-5 w-5" />}
            label="Wallet"
            active={activeTab === 'wallet'}
            onClick={() => setActiveTab('wallet')}
          />
          <NavButton
            icon={<RefreshCw className="h-5 w-5" />}
            label="Subscriptions"
            active={activeTab === 'subscriptions'}
            onClick={() => setActiveTab('subscriptions')}
          />
          <NavButton
            icon={<Gift className="h-5 w-5" />}
            label="Gift Cards"
            active={activeTab === 'giftcards'}
            onClick={() => setActiveTab('giftcards')}
          />
          <NavButton
            icon={<Settings className="h-5 w-5" />}
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>
      </nav>

      {showSendModal && (
        <SendTokens
          walletAddress={walletAddress}
          onClose={() => setShowSendModal(false)}
          onSuccess={(txHash) => {
            console.log('Transaction sent:', txHash);
            fetchBalances();
          }}
        />
      )}
    </div>
  );
}

function TokenRow({ symbol, name, balance, loading }: { symbol: string; name: string; balance: string; loading: boolean }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-bold">{symbol[0]}</span>
        </div>
        <div>
          <p className="text-sm font-medium">{symbol}</p>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
      </div>
      <p className="text-sm font-medium tabular-nums">
        {loading ? <span className="text-muted-foreground">...</span> : balance}
      </p>
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

interface GiftCard {
  id: string;
  to: string;
  from: string;
  message: string;
  amount: string;
  token: string;
  recipientAddress: string;
  createdAt: string;
  status: 'draft' | 'granting' | 'claimable' | 'claimed';
  grantTxHash?: string;
}

const CARD_THEMES = [
  { bg: 'from-violet-600 to-indigo-700', emoji: '🎉' },
  { bg: 'from-rose-500 to-pink-600', emoji: '💝' },
  { bg: 'from-emerald-500 to-teal-600', emoji: '🌟' },
  { bg: 'from-amber-500 to-orange-600', emoji: '🎁' },
  { bg: 'from-cyan-500 to-blue-600', emoji: '✨' },
];

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '71');

function GiftCardsTab({ walletAddress }: { walletAddress: string }) {
  const { signAndExecute, isSigning } = useWallet();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  // Form state
  const [to, setTo] = useState('');
  const [from, setFrom] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const { resolvedAddress: ensResolvedAddress, resolving: ensResolving, ensName, effectiveAddress: effectiveRecipient } = useEnsResolve(recipientAddress);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`giftcards_${walletAddress}`);
    if (saved) {
      // Migrate old cards that used `sent: boolean` to new `status` field
      const parsed = JSON.parse(saved).map((c: GiftCard & { sent?: boolean }) => {
        if (!c.status) {
          return { ...c, status: c.sent ? 'claimed' as const : 'claimable' as const };
        }
        return c;
      });
      setCards(parsed);
    }
  }, [walletAddress]);

  const saveCards = (updated: GiftCard[]) => {
    setCards(updated);
    localStorage.setItem(`giftcards_${walletAddress}`, JSON.stringify(updated));
  };

  // Create gift card = grant permission to recipient to claim the amount
  const handleCreate = async () => {
    if (!to.trim()) { setFormError('Recipient name is required'); return; }
    if (!amount || parseFloat(amount) <= 0) { setFormError('Enter a valid amount'); return; }
    if (!isAddress(effectiveRecipient)) { setFormError('Enter a valid wallet address or ENS name'); return; }
    setFormError(null);

    const card: GiftCard = {
      id: Date.now().toString(),
      to: to.trim(),
      from: from.trim() || 'Anonymous',
      message: message.trim() || 'Enjoy this gift!',
      amount,
      token: 'USDC',
      recipientAddress: effectiveRecipient,
      createdAt: new Date().toISOString(),
      status: 'granting',
    };

    // Save as granting immediately so user sees progress
    saveCards([card, ...cards]);
    setTo(''); setFrom(''); setMessage(''); setAmount(''); setRecipientAddress('');
    setShowCreate(false);
    setProcessing(card.id);

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      // Grant permission: recipient can claim up to `amount` (monthly limit = amount, per-tx limit = amount)
      const grantData = encodeFunctionData({
        abi: SMART_ACCOUNT_ABI,
        functionName: 'grantPermission',
        args: [
          effectiveRecipient as Address,
          parseUnits(amount, 18),
          parseUnits(amount, 18),
        ],
      });

      const calls: Call[] = [{
        target: walletAddress as Address,
        value: 0n,
        data: grantData,
      }];

      const feeAmount = parseUnits('0.01', 18);
      const feeToken = TESTNET_TOKENS.USDT;

      const result = await signAndExecute(async (walletClient) => {
        const structHash = relayerClient.getStructHash(
          calls, feeToken as Address, feeAmount, relayerAddress as Address, nonce
        );
        const signature = await walletClient.signMessage({ message: { raw: structHash } });

        const response = await fetch(`${RELAYER_URL}/execute-with-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: walletAddress,
            calls: calls.map((c) => ({ target: c.target, value: c.value.toString(), data: c.data })),
            feeToken, feeAmount: feeAmount.toString(), nonce: nonce.toString(), signature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Relayer error (${response.status}): ${errorText}`);
        }
        return response.json();
      });

      if (result?.success) {
        const updated = [{ ...card, status: 'claimable' as const, grantTxHash: result.txHash }, ...cards];
        saveCards(updated);
      } else {
        // Remove failed card
        saveCards(cards);
      }
    } catch (err) {
      console.error('Failed to create gift card:', err);
      // Remove failed card
      saveCards(cards);
      setFormError('Failed to grant permission. Try again.');
      setShowCreate(true);
    } finally {
      setProcessing(null);
    }
  };

  const statusLabel = (status: GiftCard['status']) => {
    switch (status) {
      case 'draft': return { text: 'Draft', color: 'text-muted-foreground' };
      case 'granting': return { text: 'Granting...', color: 'text-amber-400' };
      case 'claimable': return { text: 'Claimable', color: 'text-blue-400' };
      case 'claimed': return { text: 'Claimed', color: 'text-success' };
      default: return { text: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  const theme = (index: number) => CARD_THEMES[index % CARD_THEMES.length];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Gift Cards</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {showCreate ? 'Cancel' : 'Create'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="Recipient's name"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">From</label>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Greeting Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Happy Birthday! / Congratulations!"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Amount (USDC)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Token</label>
              <div className="px-4 py-3 rounded-xl bg-muted border border-border text-foreground text-sm">
                USDC
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Recipient Wallet</label>
            <input
              type="text"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder="0x... or ENS name"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition font-mono text-sm"
            />
            {ensResolving && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Resolving ENS...
              </div>
            )}
            {ensResolvedAddress && (
              <div className="flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3 w-3" /> {ensResolvedAddress.slice(0, 6)}...{ensResolvedAddress.slice(-4)}
              </div>
            )}
            {!ensResolving && !ensResolvedAddress && recipientAddress && !isAddress(recipientAddress) && !recipientAddress.startsWith('0x') && recipientAddress.length >= 2 && (
              <p className="text-xs text-muted-foreground">No address found for this name</p>
            )}
          </div>

          <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
            <p className="text-xs text-muted-foreground">
              This grants the recipient permission to claim up to {amount || '0'} USDC from your wallet. They must claim it themselves. Gas fee: 0.01 USDC.
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={isSigning || processing !== null}
            className="w-full rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:bg-white/90 disabled:opacity-40 transition"
          >
            {processing ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Granting Permission...
              </span>
            ) : (
              'Create Gift Card'
            )}
          </button>
        </div>
      )}

      {/* Cards */}
      {cards.length === 0 && !showCreate ? (
        <div className="text-center py-12">
          <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Gift className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No Gift Cards</p>
          <p className="text-xs text-muted-foreground">Grant someone permission to claim tokens with a greeting</p>
        </div>
      ) : (
        <div className="space-y-4">
          {cards.map((card, i) => {
            const t = theme(i);
            const s = statusLabel(card.status);
            return (
              <div key={card.id} className="rounded-2xl overflow-hidden border border-border">
                {/* Card visual */}
                <div className={`bg-gradient-to-br ${t.bg} p-6 relative overflow-hidden`}>
                  <div className="absolute top-3 right-4 text-4xl opacity-30">{t.emoji}</div>
                  <div className="relative space-y-3">
                    <p className="text-white/70 text-xs uppercase tracking-wider font-medium">Gift Card</p>
                    <p className="text-white text-2xl font-bold">{card.amount} {card.token}</p>
                    <p className="text-white/90 text-sm italic">&ldquo;{card.message}&rdquo;</p>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="text-white/60 text-[10px] uppercase">To</p>
                        <p className="text-white text-sm font-medium">{card.to}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-[10px] uppercase">From</p>
                        <p className="text-white text-sm font-medium">{card.from}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card footer */}
                <div className="bg-card p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      {card.recipientAddress.slice(0, 6)}...{card.recipientAddress.slice(-4)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(card.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.status === 'granting' && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    )}
                    {card.status === 'claimed' && (
                      <Check className="h-3.5 w-3.5 text-success" />
                    )}
                    <span className={`text-xs font-medium ${s.color}`}>{s.text}</span>
                    {card.grantTxHash && (
                      <a
                        href={`https://evmtestnet.confluxscan.io/tx/${card.grantTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors ${
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
