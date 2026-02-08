# EIP-7702 Client SDK

TypeScript client SDK for interacting with the EIP-7702 Gas Sponsorship system on Conflux eSpace.

## Features

✅ **EIP-7702 Authorization Signing** - Sign delegation authorizations  
✅ **Intent Signing** - Sign transaction intents with personal sign  
✅ **Relayer Integration** - Submit transactions via relayer API  
✅ **Fee Estimation** - Estimate gas costs in stablecoins  
✅ **Type-Safe** - Full TypeScript support with viem  
✅ **Multi-Network** - Supports both testnet (71) and mainnet (1030)

## Quick Start

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your values:
```env
USER_PRIVATE_KEY=0x...
SMART_ACCOUNT_ADDRESS=0x...
RELAYER_URL=http://localhost:3000
CHAIN_ID=71
```

### Run Example

```bash
npm run dev
```

## Usage

### Initialize Client

```typescript
import { EIP7702Client } from './client.js';

const client = new EIP7702Client({
  privateKey: '0x...',
  smartAccountAddress: '0x...',
  relayerUrl: 'http://localhost:3000',
  chainId: 71, // 71 = testnet, 1030 = mainnet
});
```

### First Transaction (with Authorization)

For the first transaction, you need to include EIP-7702 authorization:

```typescript
const calls = [
  {
    target: '0x...',
    value: 0n,
    data: '0x',
  },
];

const feeToken = '0xfe97E85d13ABD9c1c33384E796F10B73905637cE'; // USDT
const feeAmount = parseUnits('1.5', 6); // 1.5 USDT

const result = await client.submitIntentWithAuthorization(
  calls,
  feeToken,
  feeAmount
);

console.log(`TX Hash: ${result.txHash}`);
console.log(`Explorer: ${result.explorer}`);
```

### Subsequent Transactions (no Authorization)

After the first transaction, delegation persists:

```typescript
const result = await client.submitIntent(
  calls,
  feeToken,
  feeAmount
);
```

### Token Transfer Example

```typescript
import { encodeFunctionData, parseUnits } from 'viem';

// Encode USDT transfer
const transferData = encodeFunctionData({
  abi: [{
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  }],
  functionName: 'transfer',
  args: ['0x...', parseUnits('10', 6)], // 10 USDT
});

const calls = [{
  target: '0xfe97E85d13ABD9c1c33384E796F10B73905637cE', // USDT
  value: 0n,
  data: transferData,
}];

// Submit with 0.5 USDT fee
await client.submitIntent(
  calls,
  '0xfe97E85d13ABD9c1c33384E796F10B73905637cE',
  parseUnits('0.5', 6)
);
```

### Batch Transactions

Execute multiple calls in a single transaction:

```typescript
const calls = [
  // Call 1: Send CFX
  {
    target: '0xAlice...',
    value: parseUnits('0.1', 18),
    data: '0x',
  },
  // Call 2: Token transfer
  {
    target: '0xUSDT...',
    value: 0n,
    data: transferData,
  },
  // Call 3: Contract interaction
  {
    target: '0xContract...',
    value: 0n,
    data: contractCallData,
  },
];

await client.submitIntent(calls, feeToken, feeAmount);
```

## API Reference

### `EIP7702Client`

#### Constructor

```typescript
new EIP7702Client(config: ClientConfig)
```

**ClientConfig:**
- `privateKey` - User's private key
- `smartAccountAddress` - Deployed SimpleSmartAccount address
- `relayerUrl` - Relayer API endpoint
- `chainId` - 71 (testnet) or 1030 (mainnet)
- `rpcUrl` - Optional custom RPC URL

#### Methods

**`signAuthorization()`**  
Sign EIP-7702 authorization to delegate EOA to SmartAccount.

**`signIntent(calls, feeToken, feeAmount, feeRecipient, nonce)`**  
Sign transaction intent with personal sign.

**`getNonce()`**  
Get current nonce for the user from relayer.

**`getRelayerStats()`**  
Get relayer status (address, balance, etc.).

**`estimateFee(calls)`**  
Estimate transaction fee in stablecoins.

**`submitIntent(calls, feeToken, feeAmount)`**  
Submit intent to relayer (for subsequent transactions).

**`submitIntentWithAuthorization(calls, feeToken, feeAmount)`**  
Submit intent with EIP-7702 authorization (for first transaction).

**`getUserAddress()`**  
Get the user's address.

## How It Works

### 1. User Signs Authorization (First Time Only)

```
User signs EIP-7702 auth
  ↓
Delegates their EOA to SimpleSmartAccount
  ↓
Authorization persists on-chain
```

### 2. User Signs Intent

```
User creates calls (targets, values, data)
  ↓
Signs intent with fee params
  ↓
Signature proves user approval
```

### 3. Submit to Relayer

```
Client submits intent + signature to relayer
  ↓
Relayer validates signature
  ↓
Relayer submits transaction (pays CFX gas)
  ↓
Smart contract executes calls
  ↓
Smart contract transfers USDT/USDC fee to relayer
```

## Transaction Flow

### First Transaction (Type 4):
```
┌──────────┐          ┌──────────┐          ┌───────────┐
│   User   │          │ Relayer  │          │ Conflux   │
└────┬─────┘          └────┬─────┘          └─────┬─────┘
     │                     │                       │
     │ 1. Sign Auth        │                       │
     ├────────────────────►│                       │
     │                     │                       │
     │ 2. Sign Intent      │                       │
     ├────────────────────►│                       │
     │                     │                       │
     │                     │ 3. Type 4 TX          │
     │                     ├──────────────────────►│
     │                     │    (with auth)        │
     │                     │                       │
     │                     │ 4. Execute + Fee      │
     │                     │◄──────────────────────┤
     │                     │    (USDT transfer)    │
     │                     │                       │
     │ 5. TX Hash          │                       │
     │◄────────────────────┤                       │
     │                     │                       │
```

### Subsequent Transactions:
```
     │ 1. Sign Intent      │                       │
     ├────────────────────►│                       │
     │                     │                       │
     │                     │ 2. Regular TX         │
     │                     ├──────────────────────►│
     │                     │    (delegation exists)│
     │                     │                       │
     │                     │ 3. Execute + Fee      │
     │                     │◄──────────────────────┤
     │                     │    (USDT transfer)    │
```

## Examples

See [src/example.ts](src/example.ts) for complete examples:

- **Example 1:** Simple transaction
- **Example 2:** Token transfer
- **Example 3:** Batch transaction

## Development

```bash
# Install dependencies
npm install

# Run examples
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit
```

## Security

- Keep your `USER_PRIVATE_KEY` secure and never commit it
- Validate all calls before signing
- Ensure you have sufficient token balance for fees
- The relayer cannot steal your funds - it can only execute with your signature

## License

MIT
