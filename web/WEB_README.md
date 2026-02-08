# Conflux Wallet - Web Application

A secure, passwordless web3 wallet with passkey authentication, gas sponsorship, and subscription management on Conflux eSpace.

## Features

- 🔐 **Passkey Security**: No passwords to remember. Use biometrics (Touch ID, Face ID, Windows Hello) or hardware keys
- ⚡ **Gas Sponsorship**: Pay transaction fees in USDT/USDC instead of CFX using EIP-7702
- 🔄 **Auto-Subscriptions**: Grant permission to services to auto-charge within your set limits
- 💾 **Encrypted Storage**: Private keys encrypted with passkey-derived keys, stored locally
- 🔒 **Just-in-Time Decryption**: Keys only decrypted during signing, then immediately discarded

## Tech Stack

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **viem** - Ethereum/Conflux interactions with native EIP-7702 support
- **WebAuthn API** - Passkey authentication
- **WebCrypto API** - Private key encryption/decryption

## Project Structure

```
web/
├── app/
│   ├── layout.tsx          # Root layout with fonts
│   ├── page.tsx            # Main page (Onboarding)
│   └── globals.css         # Global styles
├── src/
│   ├── components/         # React components
│   │   ├── Onboarding.tsx     # Main onboarding flow
│   │   ├── WelcomeScreen.tsx  # Landing page
│   │   ├── PasskeySetup.tsx   # Passkey registration
│   │   ├── WalletCreated.tsx  # Wallet creation success
│   │   ├── Authorization.tsx  # EIP-7702 authorization
│   │   └── Dashboard.tsx      # Main dashboard
│   ├── hooks/              # Custom React hooks
│   │   ├── usePasskey.ts      # Passkey management
│   │   └── useWallet.ts       # Wallet operations
│   ├── utils/              # Utility functions
│   │   ├── webauthn.ts        # WebAuthn/passkey utilities
│   │   ├── crypto.ts          # Encryption/decryption
│   │   └── storage.ts         # localStorage wrapper
│   └── lib/                # External library configs
│       └── viem-client.ts     # Viem client setup
├── .env.local              # Environment variables
└── package.json
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

The `.env.local` file is already set up with testnet configuration:

- Chain: Conflux eSpace Testnet (Chain ID: 71)
- Smart Account: `0xc7B7F951439e7CEc48fC9B428Cf487D9bE75C33F`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Browser Requirements

Passkey authentication requires a modern browser with WebAuthn support:

- ✅ Chrome 108+
- ✅ Safari 16+
- ✅ Edge 108+
- ✅ Firefox 122+

## Onboarding Flow

### Step 1: Welcome

- Introduction to the wallet features
- Check for passkey support

### Step 2: Passkey Setup

- User enters username/email
- Browser prompts for biometric authentication
- Passkey credential created and stored

### Step 3: Wallet Creation

- Generate new private key
- Derive Ethereum address
- Encrypt private key with passkey-derived key
- Store encrypted wallet in localStorage

### Step 4: Authorization (Optional)

- Authenticate with passkey
- Unlock wallet (decrypt private key)
- Sign EIP-7702 authorization to delegate to smart account
- Store authorization signature

### Step 5: Dashboard

- View wallet address
- Check authorization status
- Manage subscriptions (coming soon)
- Send/receive tokens (coming soon)

## Security Model

### Passkey-Based Encryption

1. **Registration**: User creates passkey via WebAuthn
2. **Key Derivation**: Credential ID is used to derive AES-GCM encryption key
3. **Wallet Encryption**: Private key encrypted with derived key
4. **Storage**: Encrypted private key stored in localStorage
5. **Authentication**: When signing, user authenticates with passkey
6. **Decryption**: Private key temporarily decrypted in memory
7. **Signing**: Transaction signed with decrypted key
8. **Cleanup**: Private key immediately discarded from memory

### Why This is Secure

- **No Passwords**: Passkeys are phishing-resistant and can't be stolen
- **Biometric/Hardware**: Uses device's secure enclave or hardware key
- **Encrypted Storage**: Private key never stored in plaintext
- **Just-in-Time Decryption**: Key only in memory during signing
- **Local-Only**: Everything happens on user's device
- **No Backend Required**: No server can access private keys

### localStorage Safety

While localStorage can be vulnerable to XSS attacks, the private key is:

1. **Encrypted** - Useless without the passkey
2. **Requires Authentication** - Can't be decrypted without biometric/hardware auth
3. **Device-Bound** - Passkey tied to user's device

For maximum security in production:

- Use Content Security Policy (CSP)
- Audit dependencies for XSS vulnerabilities
- Consider moving to IndexedDB with encryption

## EIP-7702 Authorization

The authorization step delegates the user's EOA to the `SimpleSmartAccountV3Simple` contract. This enables:

- **Gas Sponsorship**: Pay fees in ERC-20 tokens instead of CFX
- **Subscription Management**: Grant services permission to auto-charge
- **Batched Transactions**: Execute multiple calls in one transaction

### How It Works

1. User signs EIP-7702 authorization (one-time)
2. Authorization sets EOA's code pointer to smart account contract
3. When user's EOA is called, smart account code executes
4. Contract validates permissions and enforces spending limits
5. User retains full control - can revoke anytime

## Next Steps

### Immediate

- [ ] Test onboarding flow
- [ ] Get testnet CFX from faucet
- [ ] Test authorization

### Coming Soon

- [ ] Subscription management UI
- [ ] Grant/revoke permissions interface
- [ ] Transaction history
- [ ] Send/receive tokens
- [ ] Multiple wallet support
- [ ] Backup/recovery flow
- [ ] Mobile responsive improvements

## Troubleshooting

### Passkey Registration Fails

- Ensure you're using a supported browser
- Check that you have biometric authentication set up on your device
- Try using localhost (not 0.0.0.0 or IP address)

### Authorization Fails

- Make sure you have testnet CFX for gas
- Get free CFX at: https://efaucet.confluxnetwork.org/
- Check that smart account contract is deployed

### Wallet Not Persisting

- Check browser localStorage is enabled
- Make sure you're not in incognito/private mode
- Clear localStorage and start fresh if corrupted

## Resources

- [Conflux eSpace Docs](https://doc.confluxnetwork.org/docs/espace/)
- [EIP-7702 Specification](https://eips.ethereum.org/EIPS/eip-7702)
- [WebAuthn Guide](https://webauthn.guide/)
- [viem Documentation](https://viem.sh/)

## License

MIT
