'use client';

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { parseUnits, isAddress, encodeFunctionData, type Address, type Hex } from 'viem';
import { TESTNET_TOKENS, SMART_ACCOUNT_ADDRESS } from '@/lib/viem-client';
import { RelayerClient, type Call } from '@/lib/relayer-client';

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
  const feeToken = TESTNET_TOKENS.USDT; // Always pay fees in USDT

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
      // Initialize relayer client
      const relayerClient = new RelayerClient(
        RELAYER_URL,
        SMART_ACCOUNT_ADDRESS as Address,
        CHAIN_ID
      );

      // Get current nonce from relayer
      const nonce = await relayerClient.getNonce(walletAddress as Address);
      console.log(`Current nonce: ${nonce}`);

      // Get relayer address (fee recipient)
      const { relayerAddress } = await relayerClient.getRelayerStats();
      console.log(`Relayer address: ${relayerAddress}`);

      // Prepare calls based on token type
      const calls: Call[] = [];

      if (selectedToken === 'CFX') {
        // Native CFX transfer
        calls.push({
          target: recipient as Address,
          value: parseUnits(amount, selectedTokenInfo.decimals),
          data: '0x',
        });
      } else {
        // ERC-20 token transfer
        const tokenAddress = 'address' in selectedTokenInfo ? selectedTokenInfo.address : '';
        const transferData = encodeFunctionData({
          abi: [
            {
              type: 'function',
              name: 'transfer',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'amount', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
            },
          ],
          functionName: 'transfer',
          args: [recipient as Address, parseUnits(amount, selectedTokenInfo.decimals)],
        });

        calls.push({
          target: tokenAddress as Address,
          value: 0n,
          data: transferData,
        });
      }

      // Fee amount (0.01 tokens)
      const feeAmount = parseUnits('0.01', 18);

      // Use signAndExecute to handle passkey authentication
      const result = await signAndExecute(async (walletClient) => {
        // Sign intent
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

        const requestBody = {
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
        };

        console.log('Sending to relayer:', RELAYER_URL + '/execute-with-fee');
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        // Submit to relayer (it will fetch authorization from DB if needed)
        const response = await fetch(`${RELAYER_URL}/execute-with-fee`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        console.log('Response status:', response.status);
        console.log('Response ok?', response.ok);

        if (!response.ok) {
          console.log('Response not OK, getting error...');
          const errorText = await response.text();
          console.error('Relayer error text:', errorText);

          let errorObj;
          try {
            errorObj = JSON.parse(errorText);
            console.error('Relayer error JSON:', errorObj);
          } catch (e) {
            console.error('Error is not JSON');
          }

          throw new Error(`Relayer error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('Relayer success response:', result);
        return result;
      });

      console.log('Result from signAndExecute:', result);

      // Check if signAndExecute returned null (error was caught inside)
      if (!result) {
        // The error is stored in the useWallet error state
        console.error('signAndExecute returned null, check useWallet error:', error);
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
      console.error('Full error object:', err);
      let message = 'Failed to send transaction';
      if (err instanceof Error) {
        message = err.message;
      }
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send Tokens</h2>
          <button
            onClick={onClose}
            disabled={isSigning || step === 'sending'}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Form Step */}
          {step === 'form' && (
            <>
              {/* Token Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Token
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {tokens.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`p-4 rounded-xl border-2 transition ${
                        selectedToken === token.symbol
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{token.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Address */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition font-mono text-sm"
                />
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Amount
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  step="0.000001"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition text-lg"
                />
              </div>

              {/* Fee Info */}
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  <strong>💰 Gas Fee:</strong> 0.01 USDT
                  <br />
                  <span className="text-xs">Paid to relayer for gas sponsorship</span>
                </p>
              </div>

              {/* Error Display */}
              {(sendError || error) && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {sendError || error}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContinue}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Confirmation Step */}
          {step === 'confirm' && (
            <>
              <div className="space-y-4">
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Token</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {amount} {selectedToken}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Gas Fee</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      0.01 USDT
                    </span>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total Cost</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {selectedToken === 'USDT'
                        ? `${parseFloat(amount) + 0.01} USDT`
                        : `${amount} ${selectedToken} + 0.01 USDT`}
                    </span>
                  </div>
                  <div className="flex justify-between items-start pt-2 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-gray-600 dark:text-gray-400">To</span>
                    <span className="font-mono text-sm text-gray-900 dark:text-white text-right break-all">
                      {recipient}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>🔐 Passkey Required</strong>
                    <br />
                    You'll be prompted to authenticate with your passkey to sign this transaction.
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
                  onClick={handleSend}
                  disabled={isSigning}
                  className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition"
                >
                  Send Now
                </button>
              </div>
            </>
          )}

          {/* Sending Step */}
          {step === 'sending' && (
            <div className="text-center py-8">
              <svg
                className="animate-spin h-16 w-16 text-purple-600 mx-auto mb-4"
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Sending Transaction...
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                Please confirm with your passkey if prompted
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Submitting to relayer...
              </p>
            </div>
          )}

          {/* Success Step */}
          {step === 'success' && txHash && (
            <>
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-green-600 dark:text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Transaction Sent!
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {amount} {selectedToken} sent successfully
                </p>

                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 mb-4">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Transaction Hash</p>
                  <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                    {txHash}
                  </p>
                </div>

                <a
                  href={`https://evmtestnet.confluxscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:underline"
                >
                  View on Explorer
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Send Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
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
