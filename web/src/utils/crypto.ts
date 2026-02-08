/**
 * Cryptographic utilities for encrypting/decrypting private keys
 * Uses AES-GCM for authenticated encryption
 */

/**
 * Encrypt a private key using AES-GCM
 * @param privateKey - The private key (hex string with or without 0x prefix)
 * @param encryptionKey - CryptoKey derived from passkey
 * @returns Base64-encoded encrypted data (IV + ciphertext)
 */
export async function encryptPrivateKey(
  privateKey: string,
  encryptionKey: CryptoKey
): Promise<string> {
  // Remove 0x prefix if present
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;

  // Convert hex string to bytes
  const keyBytes = hexToBytes(cleanKey);

  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    encryptionKey,
    keyBytes as BufferSource
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Return as base64
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a private key using AES-GCM
 * @param encryptedData - Base64-encoded encrypted data (IV + ciphertext)
 * @param encryptionKey - CryptoKey derived from passkey
 * @returns Decrypted private key (hex string with 0x prefix)
 */
export async function decryptPrivateKey(
  encryptedData: string,
  encryptionKey: CryptoKey
): Promise<string> {
  // Decode base64
  const combined = base64ToArrayBuffer(encryptedData);
  const data = new Uint8Array(combined);

  // Extract IV and ciphertext
  const iv = data.slice(0, 12);
  const ciphertext = data.slice(12);

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      encryptionKey,
      ciphertext as BufferSource
    );

    // Convert bytes to hex string
    const hex = bytesToHex(new Uint8Array(decrypted));
    return `0x${hex}`;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt private key. Incorrect passkey or corrupted data.');
  }
}

/**
 * Generate a new Ethereum private key
 * @returns Private key (hex string with 0x prefix)
 */
export function generatePrivateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${bytesToHex(bytes)}`;
}

/**
 * Derive Ethereum address from private key
 * Note: This is a simplified version. For production, use viem's privateKeyToAddress
 * @param privateKey - Private key (hex string with or without 0x prefix)
 * @returns Ethereum address
 */
export function privateKeyToAddress(privateKey: string): string {
  // This is a placeholder - in the actual implementation, we'll use viem
  // For now, just return a dummy address
  return '0x0000000000000000000000000000000000000000';
}

/**
 * Utility: Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Utility: Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Utility: Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
