'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { parseUnits, isAddress, encodeFunctionData, type Address, type Hex } from 'viem';
import { TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';
import { X, Loader2, Check, ExternalLink, ArrowLeft } from 'lucide-react';

interface SendTokensProps {
  walletAddress: string;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
}

type Token = 'CFX' | 'USDT';

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL || 'http://localhost:3000';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '71');

export function SendTokens({ walletAddress, onClose, onSuccess }: SendTokensProps) {
  const { signAndExecute, isSigning, error } = useWallet();

  const [selectedToken, setSelectedToken] = useState<Token>('USDT');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'sending' | 'success'>('form');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const tokens = [
    { symbol: 'CFX', name: 'Conflux', decimals: 18 },
    { symbol: 'USDT', name: 'Tether USD', decimals: 18, address: TESTNET_TOKENS.USDT },
  ] as const;

  const selectedTokenInfo = tokens.find((t) => t.symbol === selectedToken)!;
  const feeToken = TESTNET_TOKENS.USDT;

  const validateForm = () => {
    if (!recipient) return 'Recipient address is required';
    if (!isAddress(recipient)) return 'Invalid recipient address';
    if (!amount || parseFloat(amount) <= 0) return 'Invalid amount';
    return null;
  };

  const handleContinue = () => {
    const validationError = validateForm();
    if (validationError) {
      setSendError(validationError);
      return;
    }
    setSendError(null);
    setStep('confirm');
  };

  const handleSend = async () => {
    const validationError = validateForm();
    if (validationError) {
      setSendError(validationError);
      return;
    }

    setStep('sending');
    setSendError(null);

    try {
      const relayerClient = new RelayerClient(RELAYER_URL, SMART_ACCOUNT_ADDRESS as Address, CHAIN_ID);
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      const { relayerAddress } = await relayerClient.getRelayerStats();

      const calls: Call[] = [];

      if (selectedToken === 'CFX') {
        calls.push({
          target: recipient as Address,
          value: parseUnits(amount, selectedTokenInfo.decimals),
          data: '0x',
        });
      } else {
        const tokenAddress = 'address' in selectedTokenInfo ? selectedTokenInfo.address : '';
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
          args: [recipient as Address, parseUnits(amount, selectedTokenInfo.decimals)],
        });

        calls.push({
          target: tokenAddress as Address,
          value: 0n,
          data: transferData,
        });
      }

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
        throw new Error(error || 'Transaction failed - no result');
      }

      if (result.success) {
        setTxHash(result.txHash);
        setStep('success');
        onSuccess?.(result.txHash);
      } else {
        throw new Error('Transaction failed');
      }
    } catch (err) {
      let message = 'Failed to send transaction';
      if (err instanceof Error) message = err.message;
      setSendError(message);
      setStep('form');
    }
  };

  const handleReset = () => {
    setRecipient('');
    setAmount('');
    setStep('form');
    setTxHash(null);
    setSendError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-border rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Send Tokens</h2>
          <button
            onClick={onClose}
            disabled={isSigning || step === 'sending'}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition disabled:opacity-50"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Form */}
          {step === 'form' && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Token</label>
                <div className="grid grid-cols-2 gap-2">
                  {tokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`p-3 rounded-xl border transition text-left ${
                        selectedToken === token.symbol
                          ? 'border-white/30 bg-muted'
                          : 'border-border hover:border-border/80'
                      }`}
                    >
                      <div className="text-sm font-medium">{token.symbol}</div>
                      <div className="text-xs text-muted-foreground">{token.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Recipient</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/30 transition"
                />
              </div>

              <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Gas Fee:</span> 0.01 USDT (relayer sponsorship)
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

          {/* Confirm */}
          {step === 'confirm' && (
            <>
              <div className="rounded-xl bg-muted border border-border p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <span className="font-medium">{selectedToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{amount} {selectedToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gas Fee</span>
                  <span className="font-medium">0.01 USDT</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-mono text-xs text-right break-all max-w-[200px]">{recipient}</span>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 border border-border/50 p-3">
                <p className="text-xs text-muted-foreground">
                  You'll be prompted to authenticate with your passkey to sign this transaction.
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
                  onClick={handleSend}
                  disabled={isSigning}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 disabled:opacity-40 transition text-sm"
                >
                  Send Now
                </button>
              </div>
            </>
          )}

          {/* Sending */}
          {step === 'sending' && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-muted-foreground mx-auto spinner" />
              <p className="font-semibold">Sending Transaction...</p>
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
                  {amount} {selectedToken} sent successfully
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
    </div>
  );
}
