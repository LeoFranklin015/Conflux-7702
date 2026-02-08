# CLAUDE.md

## Project Overview

This is a **pure EIP-7702 gas sponsorship PoC** on **Conflux eSpace**. It lets users execute transactions and pay fees in USDT/USDC instead of CFX. A relayer pays CFX gas on the user's behalf and gets reimbursed in stablecoins.

**No ERC-4337 infrastructure.** No bundlers, no EntryPoint, no paymaster contracts. Conflux eSpace has zero AA providers — this is a standalone relayer + delegation contract setup.

## Architecture

```
User (EOA) ──signs 7702 auth + intent──▶ Relayer (backend)
                                              │
                                              ▼
                                     Conflux eSpace RPC
                                              │
                                              ▼
                                   User's EOA executes calls
                                   (delegated to SimpleSmartAccount)
                                              │
                                              ▼
                                   Fee paid in USDT/USDC to relayer
```

**Flow:**
1. User signs a 7702 authorization delegating their EOA to `SimpleSmartAccount` (one-time)
2. User signs an intent: batched calls + fee token + fee amount + nonce
3. Relayer wraps it in a Type 4 tx (first time) or regular tx (subsequent), pays CFX gas
4. Contract executes user's calls, then transfers stablecoin fee to relayer

**Key insight:** Under 7702 delegation, `address(this)` == user's EOA, so `USDT.transfer(relayer, fee)` sends directly from user's balance without needing `approve`.

## Conflux eSpace Specifics

- **Chain ID:** 1030 (mainnet), 71 (testnet)
- **RPC:** `https://evm.confluxrpc.com` (mainnet), `https://evmtestnet.confluxrpc.com` (testnet)
- **Explorer:** `https://evm.confluxscan.io`
- **EIP-7702 supported:** Yes, since v3.0.0 hardfork (CIP-7702)
- **Type 4 transactions:** Supported
- **Gas differences from Ethereum:**
  - `SSTORE` zero-to-nonzero: **40,000 gas** (ETH: 20,000)
  - `PER_EMPTY_ACCOUNT_COST` for 7702: **50,000 gas** (ETH: 25,000)
  - **No gas refund** when updating existing delegation (ETH gives 12,500 refund)
  - Gas refund cap: max **1/4 of gas limit** (ETH refunds all unused gas)
  - Deploy cost per byte: **400 gas** (ETH: 200)
- **eSpace tx inclusion:** Only blocks at height multiples of 5 can include EVM txs, with 30M gas limit cap
- **Block time:** ~1.25s

## Stablecoin Addresses (Conflux eSpace Mainnet)

```
USDT:  0xfe97E85d13ABD9c1c33384E796F10B73905637cE
USDC:  0x6963EfED0aB40F6C3d7BdA44A05dcf1437C44372
USDT0: (OFT standard, LayerZero — check confluxhub.io for latest)
```

All are standard ERC-20 with 6 decimals (USDT/USDC) or 18 decimals (varies for bridged).

## Project Structure

```
├── CLAUDE.md
├── contracts/
│   └── SimpleSmartAccount.sol    # 7702 delegation contract
├── src/
│   ├── relayer.ts                # Relayer class — submits txs, pays CFX gas
│   ├── client.ts                 # Client-side signing helpers (7702 auth + intent)
│   ├── config.ts                 # Chain config, addresses, ABIs
│   └── index.ts                  # E2E example / entry point
├── test/
│   └── SimpleSmartAccount.t.sol  # Foundry tests
├── foundry.toml
├── package.json
└── tsconfig.json
```

## Contracts

### SimpleSmartAccount.sol

Single contract deployed once. All users delegate to it.

**Key functions:**
- `executeWithFee(calls, feeToken, feeAmount, feeRecipient, nonce, signature)` — execute batched calls + pay relayer in ERC20
- `execute(calls, nonce, signature)` — execute without fee (testing / self-sponsored)
- `getNonce(account)` — get replay protection nonce for an EOA

**Signature scheme:** Personal sign (`\x19Ethereum Signed Message:\n32` + structHash). The structHash includes a type hash, hashed calls, fee params, nonce, and chainId.

**No `approve` needed for fee payment** — the contract runs in the EOA's execution context under 7702 delegation, so `transfer()` sends from the user's own balance.

## Tech Stack

- **Solidity ^0.8.24** — contracts
- **Foundry** — compile, test, deploy contracts
- **viem** — TypeScript client for signing + relaying (has native 7702 / Type 4 support)
- **Node.js / TypeScript** — relayer backend

## Development Commands

```bash
# Contracts
forge build
forge test -vvv
forge script script/Deploy.s.sol --rpc-url https://evm.confluxrpc.com --broadcast

# TypeScript
npm install
npx tsx src/index.ts
```

## Key Implementation Notes

### viem 7702 Support
- Use `walletClient.signAuthorization({ contractAddress })` for user-side auth signing
- Use `walletClient.sendTransaction({ authorizationList, ... })` for relayer-side Type 4 tx
- After first tx, delegation persists — subsequent txs are regular calls to user's EOA (no authorizationList)

### EIP-7702 Storage Location (CRITICAL!)
**⚠️ IMPORTANT:** Under EIP-7702 delegation, storage lives in the EOA's address space, NOT the delegation contract's storage!

- When an EOA delegates to `SimpleSmartAccount`, its code pointer changes but storage stays at the EOA
- When `executeWithFee` runs, `address(this)` = user's EOA, and `nonces[account]++` writes to the EOA's storage
- **To read nonces**: Call the USER's EOA address, not SMART_ACCOUNT_ADDRESS
  ```typescript
  // ✅ Correct - reads from user's EOA storage
  await client.readContract({
    address: userAddress, // User's EOA
    abi: SIMPLE_SMART_ACCOUNT_ABI,
    functionName: 'getNonce',
    args: [userAddress],
  });

  // ❌ Wrong - reads from delegation contract's storage (always 0)
  await client.readContract({
    address: SMART_ACCOUNT_ADDRESS, // Wrong!
    functionName: 'getNonce',
    args: [userAddress],
  });
  ```
- Events are emitted from the user's EOA address, not SMART_ACCOUNT_ADDRESS
- Each user's nonce is isolated in their own EOA storage

### Nonce Handling
- The contract maintains its own nonce mapping (`nonces[address]`), separate from the chain nonce
- On first tx, contract nonce is 0 (query may fail before delegation is set — default to 0)
- After successful execution, nonce increments and is stored in the user's EOA storage (not SMART_ACCOUNT storage)
- Chain nonce is managed by viem automatically for the relayer

### Signature Verification
- User signs a structHash containing: type hash, hashed calls array, fee token, fee amount, fee recipient, nonce, chainId
- Contract recovers signer via `ecrecover` and checks `signer == address(this)` (the EOA)
- Call hashing: each call is `keccak256(abi.encode(target, value, keccak256(data)))`, then all hashes are concatenated and hashed

### Fee Calculation
- Relayer should estimate gas cost in CFX, convert to stablecoin equivalent, add margin
- Account for Conflux's higher gas costs (2x SSTORE, 2x deploy cost)
- Fee is pulled atomically at the end of execution — if user doesn't have enough tokens, entire tx reverts

### Security Considerations
- 7702 delegation is **persistent** until revoked — user's private key can still sign regular txs and override delegation
- Relayer cannot steal funds — it can only call `executeWithFee` which requires user's signature
- Replay protection via nonce + chainId binding
- User can revoke delegation by sending another 7702 tx delegating to address(0)

## Testing Strategy

Use Foundry's 7702 cheatcodes:
- `vm.signDelegation(implAddress, userPk)` — create authorization
- `vm.attachDelegation(authorization)` — attach to next tx
- Test: batch execution, fee payment, nonce replay, invalid sig rejection, insufficient fee balance revert

## Environment Variables

```
RELAYER_PRIVATE_KEY=0x...     # Relayer wallet (holds CFX for gas)
USER_PRIVATE_KEY=0x...        # For testing only
SMART_ACCOUNT_ADDRESS=0x...   # Deployed SimpleSmartAccount address
RPC_URL=https://evm.confluxrpc.com
CHAIN_ID=1030
```

## Do NOT

- Do not use ERC-4337 (no bundlers/EntryPoint on Conflux eSpace)
- Do not use Conflux Core Space sponsorship mechanism (that's `SponsorWhitelistControl`, Core Space only, not eSpace)
- Do not use `localStorage` or browser storage in any frontend artifacts
- Do not add unnecessary dependencies — keep it minimal (viem + foundry)
- Do not use `approve` for fee payment — `transfer` works directly under 7702 delegation context