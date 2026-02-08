# Quick Start Guide - Testing the Web App

## Prerequisites

Make sure you have testnet tokens:
1. **CFX** - Get from https://efaucet.confluxnetwork.org/
2. **USDT** (testnet token at `0xfBeF97434ffd0587E5a1c88Efd5F7BDC405bA6Fa`)

## Step 1: Start the Relayer

```bash
cd /Users/untitled_folder/blockchian/gwdc/relayer
npm install  # If not done already
npm run dev
```

You should see:
```
🚀 Relayer running on http://localhost:3000
Relayer Address: 0x...
Balance: X CFX
```

**Important**: Keep this terminal running!

## Step 2: Start the Web App

Open a **new terminal**:

```bash
cd /Users/untitled_folder/blockchian/gwdc/web
npm run dev
```

You should see:
```
▲ Next.js 16.1.6
- Local:        http://localhost:3001
```

## Step 3: Open in Browser

Go to: http://localhost:3001

**Requirements**:
- Modern browser (Chrome, Safari, Edge, Firefox)
- Device with biometric authentication (Touch ID, Face ID, Windows Hello)

## Step 4: Complete Onboarding

### First Time Setup

1. **Welcome Screen** → Click "Get Started"
2. **Passkey Setup** → Enter your email → Authenticate with biometric
3. **Wallet Created** → Your address is shown → Click "Continue"
4. **Authorization** → Click "Authorize Now" → Passkey prompt → Signs authorization
5. **Dashboard** → You're in!

### What Just Happened?

- ✅ Passkey created (stored in your device's secure enclave)
- ✅ Wallet generated (private key encrypted with passkey)
- ✅ Authorization signed (stored in relayer's database)
- ✅ Ready to send transactions!

## Step 5: Send Your First Transaction

1. Click **"Send"** button on dashboard
2. Select token (CFX or USDT)
3. Enter recipient address (try: `0x742d35Cc6634C0532925a3b844Bc454e4438f44e`)
4. Enter amount (e.g., `2`)
5. Click **"Continue"** → Review details
6. Click **"Send Now"** → **Passkey prompt appears!** 👆
7. Authenticate → Transaction submits to relayer
8. ✅ Success! Transaction hash shown

## What Happens Behind the Scenes?

### First Transaction (Nonce = 0)
```
1. Get nonce from relayer → 0
2. Sign EIP-7702 authorization → Delegates EOA to SmartAccount
3. Sign transaction intent → User approves calls + fee
4. Submit to relayer with authorization
5. Relayer sends Type 4 transaction to blockchain
6. Transaction executes → Fee paid in USDT
```

### Subsequent Transactions (Nonce > 0)
```
1. Get nonce from relayer → 1, 2, 3...
2. Sign transaction intent → User approves calls + fee
3. Submit to relayer (no authorization needed)
4. Relayer calls user's delegated EOA
5. Transaction executes → Fee paid in USDT
```

## Troubleshooting

### Error: "Failed to fetch nonce"
**Solution**: Make sure relayer is running on http://localhost:3000

```bash
cd relayer
npm run dev
```

### Error: "Transaction failed"
**Check**:
1. Relayer has CFX for gas
2. User has USDT for fees (1.5 USDT per transaction)
3. User has tokens to send

### Browser Console Logs
Open DevTools (F12) → Console tab to see:
```
Current nonce: 0
Relayer address: 0x...
Intent signed: 0x...
Authorization signed, submitting with intent...
```

### Passkey Not Prompting
- Make sure you're on localhost (not 0.0.0.0 or IP)
- Check browser supports WebAuthn
- Try Chrome or Safari

## Testing Checklist

- [ ] Relayer running and has CFX
- [ ] Web app running on localhost:3001
- [ ] Can create passkey (biometric prompt appears)
- [ ] Wallet created and address shown
- [ ] Authorization completes (passkey prompt for signing)
- [ ] Dashboard loads with wallet info
- [ ] Send modal opens
- [ ] First transaction prompts for passkey twice (auth + intent)
- [ ] Transaction succeeds and shows TX hash
- [ ] Second transaction only prompts once (just intent)
- [ ] Can view transaction on explorer

## Success Criteria

✅ **Everything is working if**:
1. Passkey prompts appear (biometric authentication)
2. Transactions succeed and return TX hash
3. Can see transactions on https://evmtestnet.confluxscan.com
4. Fee of 1.5 USDT is deducted from your balance
5. Tokens are received by recipient

## Next Steps

- Test multiple transactions (nonce increments)
- Try both CFX and USDT transfers
- Check transaction details on block explorer
- Verify fee payments to relayer
- Test authorization flow on fresh wallet

## Important Notes

- **Relayer must be running** - Web app can't work without it
- **First transaction is special** - Includes EIP-7702 authorization
- **Fees are in USDT** - Need USDT balance for gas sponsorship
- **Passkey is local** - Stored on your device, never leaves it
- **Private key encrypted** - Can only be decrypted with passkey

---

🎉 **That's it!** You now have a fully functional EIP-7702 gas sponsorship wallet with passkey authentication!
