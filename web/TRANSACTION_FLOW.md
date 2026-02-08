# EIP-7702 Transaction Flow with Relayer

## Architecture

```
Web App → Relayer Backend → Conflux eSpace Blockchain
```

The web app does NOT send transactions directly to the blockchain. Instead:
1. User signs intent in the web app
2. Web app sends signed intent to relayer
3. Relayer submits transaction to blockchain and pays gas
4. User pays relayer back in ERC-20 tokens

## Correct Flow

### First Transaction (Nonce = 0)
1. **Check Nonce**: GET `/nonce/{userAddress}` → Returns 0
2. **Sign Authorization**: User signs EIP-7702 authorization delegating EOA to SmartAccount
3. **Sign Intent**: User signs transaction intent (calls + fee)
4. **Submit to Relayer**: POST `/execute-with-fee` with both authorization and signature
5. **Relayer Sends Type 4 TX**: Relayer wraps in Type 4 transaction with authorizationList
6. **Transaction Executes**: Blockchain executes calls and transfers fee to relayer

### Subsequent Transactions (Nonce > 0)
1. **Check Nonce**: GET `/nonce/{userAddress}` → Returns current nonce
2. **Sign Intent**: User signs transaction intent (calls + fee)
3. **Submit to Relayer**: POST `/execute-with-fee` with just signature (no authorization)
4. **Relayer Sends Regular TX**: Relayer calls user's EOA (already delegated)
5. **Transaction Executes**: Blockchain executes calls and transfers fee to relayer

## What Web App Should Do

### On Authorization (Onboarding)
```typescript
// 1. Check if already authorized
const { hasAuthorization } = await relayerClient.hasStoredAuthorization(userAddress);

if (!hasAuthorization) {
  // 2. Get nonce (should be 0)
  const nonce = await relayerClient.getNonce(userAddress);

  // 3. Sign authorization with passkey-unlocked wallet
  const authorization = await walletClient.signAuthorization({
    contractAddress: SMART_ACCOUNT_ADDRESS,
    chainId: 71,
    nonce: Number(nonce),
  });

  // 4. Store authorization in relayer DB
  await relayerClient.storeAuthorization(userAddress, authorization);
}
```

### On Send Transaction
```typescript
// 1. Get current nonce
const nonce = await relayerClient.getNonce(userAddress);

// 2. Get relayer address (fee recipient)
const { relayerAddress } = await relayerClient.getRelayerStats();

// 3. Prepare calls
const calls = [
  {
    target: tokenAddress,
    value: 0n,
    data: encodeFunctionData({...}), // ERC-20 transfer
  }
];

// 4. Get struct hash for signing
const structHash = relayerClient.getStructHash(
  calls,
  feeToken,
  feeAmount,
  relayerAddress,
  nonce
);

// 5. Sign with passkey-unlocked wallet
const signature = await walletClient.signMessage({
  message: { raw: structHash },
});

// 6. Check if first transaction
if (nonce === 0n) {
  // Sign authorization
  const authorization = await walletClient.signAuthorization({...});

  // Submit with authorization
  const result = await relayerClient.submitIntentWithAuthorization(
    userAddress,
    calls,
    feeToken,
    feeAmount,
    nonce,
    signature,
    authorization
  );
} else {
  // Submit without authorization
  const result = await relayerClient.submitIntent(
    userAddress,
    calls,
    feeToken,
    feeAmount,
    nonce,
    signature
  );
}
```

## Prerequisites

1. **Relayer Must Be Running**:
   ```bash
   cd relayer
   npm install
   npm run dev  # Starts on http://localhost:3000
   ```

2. **Relayer Must Have CFX**: The relayer wallet needs CFX to pay for gas

3. **User Must Have Tokens**: User needs both:
   - The token they want to send
   - The fee token (USDT/USDC) to pay relayer

## Common Errors

### "Transaction failed"
- Relayer is not running
- Check `NEXT_PUBLIC_RELAYER_URL` in `.env.local`

### "Failed to fetch nonce"
- Relayer API is not accessible
- Check relayer is running on correct port

### "Invalid nonce"
- Nonce mismatch between what user signed and what's in DB
- Get fresh nonce before each transaction

### "Insufficient fee payment"
- User doesn't have enough fee tokens
- Check user's token balance

## Summary

**DO NOT** use `walletClient.sendTransaction()` or `walletClient.writeContract()` directly!

Instead:
1. Sign intent with wallet
2. Submit to relayer API
3. Relayer handles blockchain interaction
