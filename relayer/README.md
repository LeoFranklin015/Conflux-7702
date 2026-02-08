# EIP-7702 Gas Sponsorship Relayer

Express-based relayer service for Conflux eSpace that allows users to pay gas fees in USDT/USDC instead of CFX.

## Features

- ✅ **EIP-7702 Support** - Handles Type 4 transactions with delegation
- ✅ **Fee Payment in Stablecoins** - Accept USDT/USDC for gas fees
- ✅ **Automatic Reimbursement** - Gets paid back automatically after execution
- ✅ **REST API** - Simple HTTP endpoints for intent submission
- ✅ **Nonce Management** - Handles replay protection
- ✅ **Fee Estimation** - Calculate required fees in stablecoins

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update with your values:
- `RELAYER_PRIVATE_KEY` - Your relayer wallet (needs CFX for gas)
- `SMART_ACCOUNT_ADDRESS` - Deployed SimpleSmartAccount address
- `NETWORK` - Either `testnet` or `mainnet`

### 3. Run Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
npm start
```

## API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "network": "Conflux eSpace Testnet",
  "chainId": 71
}
```

### GET /stats
Get relayer statistics (balance, address, etc.).

**Response:**
```json
{
  "relayerAddress": "0x...",
  "balance": "100.5",
  "network": "Conflux eSpace Testnet",
  "chainId": 71,
  "smartAccountAddress": "0x..."
}
```

### GET /nonce/:address
Get current nonce for a user address.

**Response:**
```json
{
  "address": "0x...",
  "nonce": "5"
}
```

### POST /execute-with-fee
Execute user intent with fee payment (main endpoint).

**Request Body:**
```json
{
  "userAddress": "0x...",
  "calls": [
    {
      "target": "0x...",
      "value": "0",
      "data": "0x..."
    }
  ],
  "feeToken": "0xfe97E85d13ABD9c1c33384E796F10B73905637cE",
  "feeAmount": "1000000",
  "nonce": "5",
  "signature": "0x...",
  "authorization": {
    "contractAddress": "0x...",
    "chainId": 71,
    "nonce": "0",
    "r": "0x...",
    "s": "0x...",
    "yParity": 0
  }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": "12345",
  "gasUsed": "150000",
  "status": "success",
  "explorer": "https://evmtestnet.confluxscan.io/tx/0x..."
}
```

### POST /estimate-fee
Estimate fee for a transaction.

**Request Body:**
```json
{
  "calls": [
    {
      "target": "0x...",
      "value": "0",
      "data": "0x..."
    }
  ]
}
```

**Response:**
```json
{
  "estimatedGas": "200000",
  "gasPrice": "50000000000",
  "feeAmount": "1000000",
  "feeAmountFormatted": "1.000000"
}
```

## How It Works

1. **User signs intent** off-chain with their private key
2. **User submits intent** to relayer via API
3. **Relayer validates** signature and checks token balance
4. **Relayer submits transaction** to Conflux eSpace, paying CFX gas
5. **Smart contract executes** user's calls
6. **Smart contract transfers** USDT/USDC from user to relayer
7. **Relayer gets reimbursed** automatically in the same transaction

## Transaction Flow

### First Transaction (Type 4):
```
POST /execute-with-fee (with authorization)
  ↓
Relayer submits Type 4 tx with authorizationList
  ↓
User's EOA gets delegated to SimpleSmartAccount
  ↓
Calls execute + Fee transferred to relayer
```

### Subsequent Transactions:
```
POST /execute-with-fee (no authorization)
  ↓
Relayer calls user's EOA directly (delegation persists)
  ↓
Calls execute + Fee transferred to relayer
```

## Configuration

See `.env.example` for all configuration options:

- **Network**: Choose testnet (71) or mainnet (1030)
- **Gas Settings**: Configure max gas price and limits
- **Fee Markup**: Set profit margin (e.g., 0.1 = 10%)

## Security

- Relayer private key must be kept secure
- Relayer can only execute transactions with valid user signatures
- Relayer cannot steal user funds
- Fee is transferred atomically - if execution fails, relayer pays gas but gets no fee

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Type checking
npx tsc --noEmit

# Build
npm run build
```

## License

MIT
