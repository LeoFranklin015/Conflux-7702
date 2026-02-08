'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { parseUnits, formatUnits, isAddress, encodeFunctionData, type Address } from 'viem';
import { TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS, SMART_ACCOUNT_ABI } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';

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
}

export function ManageSubscriptions({ walletAddress, onClose }: ManageSubscriptionsProps) {
  const { signAndExecute, isSigning, error } = useWallet();

  const [view, setView] = useState<'list' | 'add' | 'revoking'>('list');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [granteeAddress, setGranteeAddress] = useState('');
  const [granteeLabel, setGranteeLabel] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [perTxLimit, setPerTxLimit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'confirm' | 'sending' | 'success'>('form');

  const feeToken = TESTNET_TOKENS.USDT;

  // Load saved subscriptions from localStorage
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

      // Fetch on-chain info for each saved subscription
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

  // Save subscription to localStorage
  const saveSubscription = (grantee: string, label: string) => {
    const saved = localStorage.getItem(`subscriptions_${walletAddress}`);
    const subs: { granteeAddress: string; label: string }[] = saved ? JSON.parse(saved) : [];
    if (!subs.find((s) => s.granteeAddress.toLowerCase() === grantee.toLowerCase())) {
      subs.push({ granteeAddress: grantee, label });
      localStorage.setItem(`subscriptions_${walletAddress}`, JSON.stringify(subs));
    }
  };

  // Remove subscription from localStorage
  const removeSubscription = (grantee: string) => {
    const saved = localStorage.getItem(`subscriptions_${walletAddress}`);
    if (!saved) return;
    const subs: { granteeAddress: string; label: string }[] = JSON.parse(saved);
    const filtered = subs.filter((s) => s.granteeAddress.toLowerCase() !== grantee.toLowerCase());
    localStorage.setItem(`subscriptions_${walletAddress}`, JSON.stringify(filtered));
  };

  // Grant permission: wrap grantPermission call inside executeWithFee
  // Following client/src/subscriptionExample.ts pattern
  const handleGrantPermission = async () => {
    if (!isAddress(granteeAddress)) {
      setFormError('Invalid grantee address');
      return;
    }
    if (!monthlyLimit || parseFloat(monthlyLimit) <= 0) {
      setFormError('Monthly limit must be greater than 0');
      return;
    }
    if (!perTxLimit || parseFloat(perTxLimit) <= 0) {
      setFormError('Per-transaction limit must be greater than 0');
      return;
    }

    setStep('sending');
    setFormError(null);

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);

      // Get current nonce
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      // Encode grantPermission call to user's own EOA
      // Under EIP-7702 delegation, calling grantPermission on user's EOA sets
      // granteePermissions[user][grantee] in the user's storage
      const grantPermissionData = encodeFunctionData({
        abi: SMART_ACCOUNT_ABI,
        functionName: 'grantPermission',
        args: [
          granteeAddress as Address,
          parseUnits(monthlyLimit, 18), // 18 decimals (testnet token)
          parseUnits(perTxLimit, 18),
        ],
      });

      const calls: Call[] = [
        {
          target: walletAddress as Address, // Call user's own EOA
          value: 0n,
          data: grantPermissionData,
        },
      ];

      // Fee: 0.01 USDT
      const feeAmount = parseUnits('0.01', 18);

      const result = await signAndExecute(async (walletClient) => {
        const structHash = relayerClient.getStructHash(
          calls,
          feeToken as Address,
          feeAmount,
          relayerAddress as Address,
          nonce
        );

        const signature = await walletClient.signMessage({
          message: { raw: structHash },
        });

        const response = await fetch(`${RELAYER_URL}/execute-with-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: walletAddress,
            calls: calls.map((c) => ({
              target: c.target,
              value: c.value.toString(),
              data: c.data,
            })),
            feeToken,
            feeAmount: feeAmount.toString(),
            nonce: nonce.toString(),
            signature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Relayer error (${response.status}): ${errorText}`);
        }

        return response.json();
      });

      if (!result) {
        throw new Error(error || 'Failed to grant permission');
      }

      if (result.success) {
        // Save to localStorage
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

  // Revoke permission: wrap revokePermission call inside executeWithFee
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

      const calls: Call[] = [
        {
          target: walletAddress as Address,
          value: 0n,
          data: revokeData,
        },
      ];

      const feeAmount = parseUnits('0.01', 18);

      const result = await signAndExecute(async (walletClient) => {
        const structHash = relayerClient.getStructHash(
          calls,
          feeToken as Address,
          feeAmount,
          relayerAddress as Address,
          nonce
        );

        const signature = await walletClient.signMessage({
          message: { raw: structHash },
        });

        const response = await fetch(`${RELAYER_URL}/execute-with-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: walletAddress,
            calls: calls.map((c) => ({
              target: c.target,
              value: c.value.toString(),
              data: c.data,
            })),
            feeToken,
            feeAmount: feeAmount.toString(),
            nonce: nonce.toString(),
            signature,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Relayer error (${response.status}): ${errorText}`);
        }

        return response.json();
      });

      if (!result) {
        throw new Error(error || 'Failed to revoke permission');
      }

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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {view === 'add' ? 'Add Subscription' : 'Subscriptions'}
          </h2>
          <button
            onClick={onClose}
            disabled={isSigning || step === 'sending' || view === 'revoking'}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* List View */}
          {view === 'list' && (
            <>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-300">Loading subscriptions...</p>
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Subscriptions</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Grant permission to services for auto-billing
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.granteeAddress}
                      className="rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{sub.label}</p>
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 break-all">
                            {sub.granteeAddress}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            sub.isAuthorized
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {sub.isAuthorized ? 'Active' : 'Revoked'}
                        </span>
                      </div>

                      {sub.isAuthorized && (
                        <>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2">
                              <p className="text-gray-500 dark:text-gray-400 text-xs">Monthly Spent</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {formatUnits(BigInt(sub.monthlySpent), 18)} / {formatUnits(BigInt(sub.monthlyLimit), 18)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-2">
                              <p className="text-gray-500 dark:text-gray-400 text-xs">Per-Tx Limit</p>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {formatUnits(BigInt(sub.perTxLimit), 18)}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevoke(sub.granteeAddress)}
                            disabled={isSigning}
                            className="w-full px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm disabled:opacity-50"
                          >
                            Revoke Permission
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setView('add')}
                className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition"
              >
                Add Subscription
              </button>

              {formError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
                </div>
              )}
            </>
          )}

          {/* Revoking View */}
          {view === 'revoking' && (
            <div className="text-center py-8">
              <div className="animate-spin h-16 w-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Revoking Permission...</h3>
              <p className="text-gray-600 dark:text-gray-300">Please confirm with your passkey</p>
            </div>
          )}

          {/* Add Subscription Form */}
          {view === 'add' && step === 'form' && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Service Label
                  </label>
                  <input
                    type="text"
                    value={granteeLabel}
                    onChange={(e) => setGranteeLabel(e.target.value)}
                    placeholder="e.g. Netflix, Spotify"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Grantee Address
                  </label>
                  <input
                    type="text"
                    value={granteeAddress}
                    onChange={(e) => setGranteeAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Monthly Limit (tokens)
                  </label>
                  <input
                    type="number"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                    placeholder="e.g. 10"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Per-Transaction Limit (tokens)
                  </label>
                  <input
                    type="number"
                    value={perTxLimit}
                    onChange={(e) => setPerTxLimit(e.target.value)}
                    placeholder="e.g. 5"
                    step="0.01"
                    min="0"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                  />
                </div>

                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>How it works:</strong> The grantee can auto-charge your wallet up to these limits without requiring your signature each time. You can revoke anytime.
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>Gas Fee:</strong> 0.01 USDT (paid to relayer)
                  </p>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{formError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    const err = !isAddress(granteeAddress)
                      ? 'Invalid grantee address'
                      : !monthlyLimit || parseFloat(monthlyLimit) <= 0
                        ? 'Monthly limit required'
                        : !perTxLimit || parseFloat(perTxLimit) <= 0
                          ? 'Per-tx limit required'
                          : null;
                    if (err) {
                      setFormError(err);
                      return;
                    }
                    setFormError(null);
                    setStep('confirm');
                  }}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Confirm Step */}
          {view === 'add' && step === 'confirm' && (
            <>
              <div className="space-y-4">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Service</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {granteeLabel || 'Unnamed'}
                    </span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600 dark:text-gray-400">Grantee</span>
                    <span className="font-mono text-sm text-gray-900 dark:text-white text-right break-all max-w-[200px]">
                      {granteeAddress}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Monthly Limit</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{monthlyLimit} tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Per-Tx Limit</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{perTxLimit} tokens</span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gas Fee</span>
                    <span className="font-semibold text-gray-900 dark:text-white">0.01 USDT</span>
                  </div>
                </div>

                <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <p className="text-sm text-yellow-900 dark:text-yellow-200">
                    <strong>Warning:</strong> This allows the grantee to automatically charge your wallet within the set limits. Make sure you trust this address.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('form')}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleGrantPermission}
                  disabled={isSigning}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition"
                >
                  Grant Permission
                </button>
              </div>
            </>
          )}

          {/* Sending Step */}
          {view === 'add' && step === 'sending' && (
            <div className="text-center py-8">
              <svg
                className="animate-spin h-16 w-16 text-purple-600 mx-auto mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Granting Permission...
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Please confirm with your passkey if prompted
              </p>
            </div>
          )}

          {/* Success Step */}
          {view === 'add' && step === 'success' && txHash && (
            <>
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Permission Granted!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {granteeLabel || 'Service'} can now auto-charge up to {monthlyLimit} tokens/month
                </p>

                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 mb-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Transaction Hash</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{txHash}</p>
                </div>

                <a
                  href={`https://evmtestnet.confluxscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View on Explorer
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <button
                onClick={resetForm}
                className="w-full px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
