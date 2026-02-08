'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { parseUnits, formatUnits, isAddress, encodeFunctionData, type Address } from 'viem';
import { TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS, SMART_ACCOUNT_ABI } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';
import { X, Loader2, Check, ExternalLink, ArrowLeft, Plus, AlertTriangle } from 'lucide-react';

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '71');

interface Subscription {
  granteeAddress: string;
  label: string;
  isAuthorized: boolean;
  monthlySpent: string;
  monthlyLimit: string;
  perTxLimit: string;
}

interface ManageSubscriptionsProps {
  walletAddress: string;
  onClose: () => void;
  inline?: boolean;
}

export function ManageSubscriptions({ walletAddress, onClose, inline }: ManageSubscriptionsProps) {
  const { signAndExecute, isSigning, error } = useWallet();

  const [view, setView] = useState<'list' | 'add' | 'revoking'>('list');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const [granteeAddress, setGranteeAddress] = useState('');
  const [granteeLabel, setGranteeLabel] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [perTxLimit, setPerTxLimit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'sending' | 'success'>('form');

  const feeToken = TESTNET_TOKENS.USDT;

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const saved = localStorage.getItem(`subscriptions_${walletAddress}`);
      if (!saved) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      const savedSubs: { granteeAddress: string; label: string }[] = JSON.parse(saved);
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);

      const subs: Subscription[] = await Promise.all(
        savedSubs.map(async (s) => {
          try {
            const info = await relayerClient.getGranteeInfo(
              walletAddress as Address,
              s.granteeAddress as Address
            );
            return {
              granteeAddress: s.granteeAddress,
              label: s.label,
              isAuthorized: info.isAuthorized,
              monthlySpent: info.monthlySpent,
              monthlyLimit: info.monthlyLimit,
              perTxLimit: info.perTxLimit,
            };
          } catch {
            return {
              granteeAddress: s.granteeAddress,
              label: s.label,
              isAuthorized: false,
              monthlySpent: '0',
              monthlyLimit: '0',
              perTxLimit: '0',
            };
          }
        })
      );

      setSubscriptions(subs);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const saveSubscription = (grantee: string, label: string) => {
    const saved = localStorage.getItem(`subscriptions_${walletAddress}`);
    const subs: { granteeAddress: string; label: string }[] = saved ? JSON.parse(saved) : [];
    if (!subs.find((s) => s.granteeAddress.toLowerCase() === grantee.toLowerCase())) {
      subs.push({ granteeAddress: grantee, label });
      localStorage.setItem(`subscriptions_${walletAddress}`, JSON.stringify(subs));
    }
  };

  const removeSubscription = (grantee: string) => {
    const saved = localStorage.getItem(`subscriptions_${walletAddress}`);
    if (!saved) return;
    const subs: { granteeAddress: string; label: string }[] = JSON.parse(saved);
    const filtered = subs.filter((s) => s.granteeAddress.toLowerCase() !== grantee.toLowerCase());
    localStorage.setItem(`subscriptions_${walletAddress}`, JSON.stringify(filtered));
  };

  const handleGrantPermission = async () => {
    if (!isAddress(granteeAddress)) { setFormError('Invalid grantee address'); return; }
    if (!monthlyLimit || parseFloat(monthlyLimit) <= 0) { setFormError('Monthly limit must be > 0'); return; }
    if (!perTxLimit || parseFloat(perTxLimit) <= 0) { setFormError('Per-tx limit must be > 0'); return; }

    setStep('sending');
    setFormError(null);

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      const grantPermissionData = encodeFunctionData({
        abi: SMART_ACCOUNT_ABI,
        functionName: 'grantPermission',
        args: [
          granteeAddress as Address,
          parseUnits(monthlyLimit, 18),
          parseUnits(perTxLimit, 18),
        ],
      });

      const calls: Call[] = [{
        target: walletAddress as Address,
        value: 0n,
        data: grantPermissionData,
      }];

      const feeAmount = parseUnits('0.01', 18);

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

      if (!result) throw new Error(error || 'Failed to grant permission');
      if (result.success) {
        saveSubscription(granteeAddress, granteeLabel || `Service ${granteeAddress.slice(0, 8)}`);
        setTxHash(result.txHash);
        setStep('success');
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      console.error('Grant permission error:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to grant permission');
      setStep('form');
    }
  };

  const handleRevoke = async (grantee: string) => {
    setView('revoking');
    setFormError(null);

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      const revokeData = encodeFunctionData({
        abi: SMART_ACCOUNT_ABI,
        functionName: 'revokePermission',
        args: [grantee as Address],
      });

      const calls: Call[] = [{ target: walletAddress as Address, value: 0n, data: revokeData }];
      const feeAmount = parseUnits('0.01', 18);

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

      if (!result) throw new Error(error || 'Failed to revoke permission');
      if (result.success) {
        removeSubscription(grantee);
        await loadSubscriptions();
        setView('list');
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      console.error('Revoke error:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to revoke');
      setView('list');
    }
  };

  const resetForm = () => {
    setGranteeAddress('');
    setGranteeLabel('');
    setMonthlyLimit('');
    setPerTxLimit('');
    setFormError(null);
    setTxHash(null);
    setStep('form');
    setView('list');
    loadSubscriptions();
  };

  const content = (
    <>
      <div className={inline ? 'flex items-center justify-between mb-6' : 'p-5 border-b border-border flex items-center justify-between'}>
        <h2 className="text-lg font-semibold">
          {view === 'add' ? 'Add Subscription' : 'Subscriptions'}
        </h2>
        {!inline && (
          <button
            onClick={onClose}
            disabled={isSigning || step === 'sending' || view === 'revoking'}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition disabled:opacity-50"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className={inline ? 'space-y-5' : 'p-5 space-y-5'}>
          {/* List View */}
          {view === 'list' && (
            <>
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 text-muted-foreground mx-auto animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Plus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">No Subscriptions</p>
                  <p className="text-xs text-muted-foreground">Grant permission to services for auto-billing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <div key={sub.granteeAddress} className="rounded-xl border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{sub.label}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">
                            {sub.granteeAddress}
                          </p>
                        </div>
                        <span className={`shrink-0 ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          sub.isAuthorized
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {sub.isAuthorized ? 'Active' : 'Revoked'}
                        </span>
                      </div>

                      {sub.isAuthorized && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-muted p-2">
                              <p className="text-[10px] text-muted-foreground">Monthly</p>
                              <p className="text-xs font-medium">
                                {formatUnits(BigInt(sub.monthlySpent), 18)} / {formatUnits(BigInt(sub.monthlyLimit), 18)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-muted p-2">
                              <p className="text-[10px] text-muted-foreground">Per-Tx Limit</p>
                              <p className="text-xs font-medium">{formatUnits(BigInt(sub.perTxLimit), 18)}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevoke(sub.granteeAddress)}
                            disabled={isSigning}
                            className="w-full px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-xs hover:bg-destructive/10 transition disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setView('add')}
                className="w-full rounded-xl bg-white text-black px-4 py-3 text-sm font-medium hover:bg-white/90 transition"
              >
                Add Subscription
              </button>

              {formError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}
            </>
          )}

          {/* Revoking */}
          {view === 'revoking' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
              <p className="font-semibold">Revoking Permission...</p>
              <p className="text-sm text-muted-foreground">Confirm with your passkey</p>
            </div>
          )}

          {/* Add Form */}
          {view === 'add' && step === 'form' && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Service Label</label>
                  <input
                    type="text"
                    value={granteeLabel}
                    onChange={(e) => setGranteeLabel(e.target.value)}
                    placeholder="e.g. Netflix, Spotify"
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Grantee Address</label>
                  <input
                    type="text"
                    value={granteeAddress}
                    onChange={(e) => setGranteeAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Monthly Limit</label>
                    <input
                      type="number"
                      value={monthlyLimit}
                      onChange={(e) => setMonthlyLimit(e.target.value)}
                      placeholder="10"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Per-Tx Limit</label>
                    <input
                      type="number"
                      value={perTxLimit}
                      onChange={(e) => setPerTxLimit(e.target.value)}
                      placeholder="5"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">
                    The grantee can auto-charge up to these limits without your signature. You can revoke anytime. Gas fee: 0.01 USDT.
                  </p>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  onClick={() => {
                    const err = !isAddress(granteeAddress)
                      ? 'Invalid address'
                      : !monthlyLimit || parseFloat(monthlyLimit) <= 0
                        ? 'Monthly limit required'
                        : !perTxLimit || parseFloat(perTxLimit) <= 0
                          ? 'Per-tx limit required'
                          : null;
                    if (err) { setFormError(err); return; }
                    setFormError(null);
                    setStep('confirm');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition text-sm"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Confirm */}
          {view === 'add' && step === 'confirm' && (
            <>
              <div className="rounded-xl bg-muted border border-border p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{granteeLabel || 'Unnamed'}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Grantee</span>
                  <span className="font-mono text-xs text-right break-all max-w-[200px]">{granteeAddress}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Limit</span>
                  <span className="font-medium">{monthlyLimit} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Per-Tx Limit</span>
                  <span className="font-medium">{perTxLimit} tokens</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-muted-foreground">Gas Fee</span>
                  <span className="font-medium">0.01 USDT</span>
                </div>
              </div>

              <div className="flex gap-3 rounded-xl bg-muted/50 border border-border/50 p-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This allows the grantee to automatically charge your wallet within limits. Make sure you trust this address.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  onClick={handleGrantPermission}
                  disabled={isSigning}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 transition text-sm"
                >
                  Grant Permission
                </button>
              </div>
            </>
          )}

          {/* Sending */}
          {view === 'add' && step === 'sending' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
              <p className="font-semibold">Granting Permission...</p>
              <p className="text-sm text-muted-foreground">Confirm with your passkey if prompted</p>
            </div>
          )}

          {/* Success */}
          {view === 'add' && step === 'success' && txHash && (
            <>
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <h3 className="text-lg font-semibold">Permission Granted</h3>
                <p className="text-sm text-muted-foreground">
                  {granteeLabel || 'Service'} can now auto-charge up to {monthlyLimit} tokens/month
                </p>

                <div className="rounded-xl bg-muted border border-border p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Transaction Hash</p>
                  <p className="font-mono text-xs break-all">{txHash}</p>
                </div>

                <a
                  href={`https://evmtestnet.confluxscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  View on Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <button
                onClick={resetForm}
                className="w-full px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition text-sm"
              >
                Done
              </button>
            </>
          )}
      </div>
    </>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5">
        {content}
      </div>
    </div>
  );
}
