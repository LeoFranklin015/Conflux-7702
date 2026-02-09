'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useEnsResolve } from '@/hooks/useEnsResolve';
import { parseUnits, isAddress, encodeFunctionData, type Address } from 'viem';
import { TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';
import { QrScanner } from './QrScanner';
import { X, Loader2, Check, ExternalLink, ArrowLeft, ScanLine, Plus, ChevronDown, Trash2 } from 'lucide-react';

interface SendTokensProps {
  walletAddress: string;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
}

type Token = 'CFX' | 'USDC';

interface TransferItem {
  id: string;
  token: Token;
  recipient: string;
  amount: string;
  resolvedAddress: string | null;
  ensName: string | null;
}

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '71');

const TOKEN_LIST: { symbol: Token; name: string; decimals: number; address?: string }[] = [
  { symbol: 'CFX', name: 'Conflux', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 18, address: TESTNET_TOKENS.USDT },
];

const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

const makeTransfer = (): TransferItem => ({
  id: Date.now().toString(),
  token: 'USDC',
  recipient: '',
  amount: '',
  resolvedAddress: null,
  ensName: null,
});

export function SendTokens({ walletAddress, onClose, onSuccess }: SendTokensProps) {
  const { signAndExecute, isSigning, error } = useWallet();

  const [transfers, setTransfers] = useState<TransferItem[]>([makeTransfer()]);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [step, setStep] = useState<'form' | 'confirm' | 'sending' | 'success'>('form');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // ENS resolution for the currently expanded transfer
  const {
    resolvedAddress: liveResolved,
    resolving,
    ensName: liveEnsName,
  } = useEnsResolve(transfers[expandedIndex]?.recipient || '');

  const feeToken = TESTNET_TOKENS.USDT;

  const updateTransfer = (index: number, updates: Partial<TransferItem>) => {
    setTransfers(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t));
  };

  // Persist live ENS resolution into the expanded item's state
  const saveCurrentResolution = () => {
    setTransfers(prev => prev.map((t, i) =>
      i === expandedIndex ? { ...t, resolvedAddress: liveResolved, ensName: liveEnsName } : t
    ));
  };

  // Effective recipient: live hook for expanded, stored for collapsed
  const getEffective = (index: number) => {
    if (index === expandedIndex) return liveResolved || transfers[index].recipient;
    return transfers[index].resolvedAddress || transfers[index].recipient;
  };

  const getEns = (index: number) => {
    if (index === expandedIndex) return liveEnsName;
    return transfers[index].ensName;
  };

  const switchExpanded = (index: number) => {
    if (index === expandedIndex) return;
    saveCurrentResolution();
    setExpandedIndex(index);
  };

  const addTransfer = () => {
    saveCurrentResolution();
    setTransfers(prev => [...prev, makeTransfer()]);
    setExpandedIndex(transfers.length);
  };

  const removeTransfer = (index: number) => {
    if (transfers.length <= 1) return;
    const newLen = transfers.length - 1;
    setTransfers(prev => prev.filter((_, i) => i !== index));
    if (index === expandedIndex) {
      setExpandedIndex(Math.min(index, newLen - 1));
    } else if (index < expandedIndex) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const validateAll = (): string | null => {
    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      const eff = getEffective(i);
      if (!t.recipient) return `Transfer #${i + 1}: Recipient is required`;
      if (i === expandedIndex && resolving) return `Transfer #${i + 1}: Resolving ENS...`;
      if (!isAddress(eff)) return `Transfer #${i + 1}: Invalid address`;
      if (!t.amount || parseFloat(t.amount) <= 0) return `Transfer #${i + 1}: Invalid amount`;
    }
    return null;
  };

  const handleContinue = () => {
    saveCurrentResolution();
    const err = validateAll();
    if (err) { setSendError(err); return; }
    setSendError(null);
    setStep('confirm');
  };

  const handleSend = async () => {
    setStep('sending');
    setSendError(null);

    // Build final transfers snapshot with live resolution applied
    const finalTransfers = transfers.map((t, i) =>
      i === expandedIndex ? { ...t, resolvedAddress: liveResolved, ensName: liveEnsName } : t
    );

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      const calls: Call[] = [];

      for (const t of finalTransfers) {
        const effective = (t.resolvedAddress || t.recipient) as Address;
        const tokenInfo = TOKEN_LIST.find(tk => tk.symbol === t.token)!;

        if (t.token === 'CFX') {
          calls.push({
            target: effective,
            value: parseUnits(t.amount, tokenInfo.decimals),
            data: '0x',
          });
        } else {
          const transferData = encodeFunctionData({
            abi: [{
              type: 'function',
              name: 'transfer',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
            }],
            functionName: 'transfer',
            args: [effective, parseUnits(t.amount, tokenInfo.decimals)],
          });
          calls.push({
            target: tokenInfo.address as Address,
            value: 0n,
            data: transferData,
          });
        }
      }

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
            calls: calls.map(c => ({ target: c.target, value: c.value.toString(), data: c.data })),
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

      if (!result) throw new Error(error || 'Transaction failed');

      if (result.success) {
        setTxHash(result.txHash);
        setStep('success');
        onSuccess?.(result.txHash);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send transaction');
      setStep('confirm');
    }
  };

  const handleReset = () => {
    setTransfers([makeTransfer()]);
    setExpandedIndex(0);
    setStep('form');
    setTxHash(null);
    setSendError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Send Tokens</h2>
            {transfers.length > 1 && step === 'form' && (
              <p className="text-xs text-muted-foreground">{transfers.length} transfers (batch)</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSigning || step === 'sending'}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition disabled:opacity-50"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Form Step */}
          {step === 'form' && (
            <>
              <div className="space-y-3">
                {transfers.map((transfer, index) => {
                  const isExpanded = index === expandedIndex;
                  const eff = getEffective(index);
                  const ens = getEns(index);

                  return (
                    <div
                      key={transfer.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded ? 'border-white/20 bg-muted/30' : 'border-border'
                      }`}
                    >
                      {/* Accordion header */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => switchExpanded(index)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchExpanded(index); }}
                        className="w-full flex items-center justify-between p-3 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {index + 1}
                          </span>
                          {!isExpanded && transfer.recipient && transfer.amount ? (
                            <span className="text-sm truncate">
                              {transfer.amount} {transfer.token} &rarr;{' '}
                              {ens || (isAddress(eff) ? shortAddr(eff) : 'Invalid')}
                            </span>
                          ) : !isExpanded ? (
                            <span className="text-sm text-muted-foreground">Empty transfer</span>
                          ) : (
                            <span className="text-sm font-medium">Transfer #{index + 1}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {transfers.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeTransfer(index); }}
                              className="h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/20 transition"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </button>
                          )}
                          <ChevronDown
                            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded form fields */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3">
                          {/* Token selector */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Token</label>
                            <div className="grid grid-cols-2 gap-2">
                              {TOKEN_LIST.map((token) => {
                                const selected = transfer.token === token.symbol;
                                return (
                                  <button
                                    key={token.symbol}
                                    type="button"
                                    onClick={() => updateTransfer(index, { token: token.symbol })}
                                    className={`relative p-2.5 rounded-lg border-2 transition-all text-left ${
                                      selected
                                        ? 'border-white bg-white/10'
                                        : 'border-border hover:border-muted-foreground/40'
                                    }`}
                                  >
                                    {selected && (
                                      <div className="absolute top-1.5 right-1.5 h-3.5 w-3.5 rounded-full bg-white flex items-center justify-center">
                                        <Check className="h-2 w-2 text-black" />
                                      </div>
                                    )}
                                    <div className="text-xs font-medium">{token.symbol}</div>
                                    <div className="text-[10px] text-muted-foreground">{token.name}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Recipient */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Recipient</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={transfer.recipient}
                                onChange={(e) => updateTransfer(index, { recipient: e.target.value })}
                                placeholder="0x... or ENS name"
                                className={`flex-1 px-3 py-2.5 rounded-lg bg-muted border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition text-sm ${
                                  liveResolved ? 'border-success/50' : 'border-border'
                                } ${isAddress(transfer.recipient) ? 'font-mono' : ''}`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                className="shrink-0 h-[38px] w-[38px] rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-accent transition-colors"
                              >
                                <ScanLine className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                            {resolving && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> Resolving ENS...
                              </div>
                            )}
                            {liveResolved && (
                              <div className="flex items-center gap-1.5 text-xs text-success">
                                <Check className="h-3 w-3" />
                                <span className="font-mono">{shortAddr(liveResolved)}</span>
                              </div>
                            )}
                          </div>

                          {/* Amount */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Amount</label>
                            <input
                              type="number"
                              value={transfer.amount}
                              onChange={(e) => updateTransfer(index, { amount: e.target.value })}
                              placeholder="0.0"
                              step="0.000001"
                              min="0"
                              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add transfer */}
              <button
                type="button"
                onClick={addTransfer}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Transfer
              </button>

              <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Gas Fee:</span> 0.01 USDC (relayer sponsorship)
                  {transfers.length > 1 && (
                    <span className="block mt-1">
                      All {transfers.length} transfers execute in a single batch transaction.
                    </span>
                  )}
                </p>
              </div>

              {(sendError || error) && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {sendError || error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition text-sm"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Confirm Step */}
          {step === 'confirm' && (
            <>
              <div className="space-y-3">
                {transfers.map((t, i) => {
                  const ens = t.ensName;
                  const effective = t.resolvedAddress || t.recipient;
                  return (
                    <div key={t.id} className="rounded-xl bg-muted border border-border p-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-background flex items-center justify-center text-[10px] font-bold">
                          {i + 1}
                        </span>
                        <span className="font-medium">{t.amount} {t.token}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">To</span>
                        <div className="text-right max-w-[200px]">
                          {ens && <p className="text-xs font-medium text-success mb-0.5">{ens}</p>}
                          <span className="font-mono text-xs break-all">{effective}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl bg-muted border border-border p-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Gas Fee</span>
                <span className="font-medium">0.01 USDC</span>
              </div>

              <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  {transfers.length > 1
                    ? `${transfers.length} transfers will execute in a single batch transaction. Confirm with your passkey.`
                    : "You'll be prompted to authenticate with your passkey to sign this transaction."}
                </p>
              </div>

              {sendError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {sendError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setSendError(null); setStep('form'); }}
                  className="flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <button
                  onClick={handleSend}
                  disabled={isSigning}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 transition text-sm"
                >
                  Send {transfers.length > 1 ? `${transfers.length} Transfers` : 'Now'}
                </button>
              </div>
            </>
          )}

          {/* Sending */}
          {step === 'sending' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto animate-spin" />
              <p className="font-semibold">
                Sending {transfers.length > 1 ? 'Batch ' : ''}Transaction...
              </p>
              <p className="text-sm text-muted-foreground">Confirm with your passkey if prompted</p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && txHash && (
            <>
              <div className="text-center py-4 space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <h3 className="text-lg font-semibold">Transaction Sent</h3>
                <p className="text-sm text-muted-foreground">
                  {transfers.length > 1
                    ? `${transfers.length} transfers sent successfully in one batch`
                    : `${transfers[0].amount} ${transfers[0].token} sent successfully`}
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

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition text-sm"
                >
                  Send Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition text-sm"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showScanner && (
        <QrScanner
          onScan={(address) => {
            updateTransfer(expandedIndex, { recipient: address });
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
