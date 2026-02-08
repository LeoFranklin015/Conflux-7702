/**
 * Secure localStorage wrapper for encrypted wallet storage
 */

const STORAGE_KEYS = {
  ENCRYPTED_PRIVATE_KEY: 'conflux_encrypted_pk',
  WALLET_ADDRESS: 'conflux_wallet_address',
  PASSKEY_CREDENTIAL_ID: 'conflux_passkey_id',
  AUTHORIZATION_SIGNATURE: 'conflux_auth_sig',
  ENS_NAME: 'conflux_ens_name',
} as const;

export interface WalletStorage {
  encryptedPrivateKey: string;
  walletAddress: string;
  passkeyCredentialId: string;
}

/**
 * Check if a wallet is already stored
 */
export function hasStoredWallet(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY) !== null &&
    localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS) !== null &&
    localStorage.getItem(STORAGE_KEYS.PASSKEY_CREDENTIAL_ID) !== null
  );
}

/**
 * Store encrypted wallet data
 */
export function storeWallet(data: WalletStorage): void {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available');
  }

  localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY, data.encryptedPrivateKey);
  localStorage.setItem(STORAGE_KEYS.WALLET_ADDRESS, data.walletAddress);
  localStorage.setItem(STORAGE_KEYS.PASSKEY_CREDENTIAL_ID, data.passkeyCredentialId);
}

/**
 * Get stored wallet data
 */
export function getStoredWallet(): WalletStorage | null {
  if (typeof window === 'undefined') return null;

  const encryptedPrivateKey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
  const walletAddress = localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
  const passkeyCredentialId = localStorage.getItem(STORAGE_KEYS.PASSKEY_CREDENTIAL_ID);

  if (!encryptedPrivateKey || !walletAddress || !passkeyCredentialId) {
    return null;
  }

  return {
    encryptedPrivateKey,
    walletAddress,
    passkeyCredentialId,
  };
}

/**
 * Get passkey credential ID
 */
export function getPasskeyCredentialId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.PASSKEY_CREDENTIAL_ID);
}

/**
 * Get wallet address
 */
export function getWalletAddress(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.WALLET_ADDRESS);
}

/**
 * Store EIP-7702 authorization signature
 */
export function storeAuthorizationSignature(signature: string): void {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available');
  }
  localStorage.setItem(STORAGE_KEYS.AUTHORIZATION_SIGNATURE, signature);
}

/**
 * Get stored authorization signature
 */
export function getAuthorizationSignature(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTHORIZATION_SIGNATURE);
}

/**
 * Store ENS subname
 */
export function storeENSName(name: string): void {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available');
  }
  localStorage.setItem(STORAGE_KEYS.ENS_NAME, name);
}

/**
 * Get stored ENS subname
 */
export function getENSName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ENS_NAME);
}

/**
 * Clear all wallet data (logout)
 */
export function clearWallet(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_PRIVATE_KEY);
  localStorage.removeItem(STORAGE_KEYS.WALLET_ADDRESS);
  localStorage.removeItem(STORAGE_KEYS.PASSKEY_CREDENTIAL_ID);
  localStorage.removeItem(STORAGE_KEYS.AUTHORIZATION_SIGNATURE);
  localStorage.removeItem(STORAGE_KEYS.ENS_NAME);
}

/**
 * Export wallet data (for backup)
 */
export function exportWalletData(): string {
  const wallet = getStoredWallet();
  if (!wallet) {
    throw new Error('No wallet data to export');
  }

  return JSON.stringify(wallet, null, 2);
}

/**
 * Import wallet data (from backup)
 */
export function importWalletData(data: string): void {
  try {
    const wallet = JSON.parse(data) as WalletStorage;

    if (!wallet.encryptedPrivateKey || !wallet.walletAddress || !wallet.passkeyCredentialId) {
      throw new Error('Invalid wallet data format');
    }

    storeWallet(wallet);
  } catch (error) {
    console.error('Import failed:', error);
    throw new Error('Failed to import wallet data. Invalid format.');
  }
}
