/**
 * WebAuthn utility for passkey registration and authentication
 * Uses browser's native WebAuthn API for secure biometric/hardware key authentication
 */

export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
}

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function'
  );
}

/**
 * Register a new passkey credential
 * @param username - User identifier (e.g., wallet address or email)
 * @returns Credential ID that can be used for authentication
 */
export async function registerPasskey(username: string): Promise<string> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  // Generate a challenge (in production, this should come from your backend)
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: 'Conflux Gas Sponsorship',
      id: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
    },
    user: {
      id: new TextEncoder().encode(username),
      name: username,
      displayName: username,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Prefer platform authenticators (Touch ID, Face ID, Windows Hello)
      userVerification: 'required',
      residentKey: 'required',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create credential');
    }

    // Return the credential ID as base64
    const credentialId = arrayBufferToBase64(credential.rawId);
    return credentialId;
  } catch (error) {
    console.error('Passkey registration failed:', error);
    throw new Error('Failed to register passkey. Please try again.');
  }
}

/**
 * Authenticate using an existing passkey
 * @param credentialId - The credential ID from registration (optional, will auto-discover if not provided)
 * @returns true if authentication successful
 */
export async function authenticatePasskey(credentialId?: string): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const publicKeyOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    userVerification: 'required',
    rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  };

  // If credentialId is provided, use it. Otherwise, let the authenticator auto-discover
  if (credentialId) {
    publicKeyOptions.allowCredentials = [
      {
        type: 'public-key',
        id: base64ToArrayBuffer(credentialId),
      },
    ];
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });

    return assertion !== null;
  } catch (error) {
    console.error('Passkey authentication failed:', error);
    return false;
  }
}

/**
 * Derive an encryption key from the passkey credential
 * This uses the credential ID as a seed for deriving a consistent encryption key
 * @param credentialId - The credential ID from registration
 * @returns CryptoKey for AES-GCM encryption
 */
export async function deriveEncryptionKey(credentialId: string): Promise<CryptoKey> {
  // Use PBKDF2 to derive a key from the credential ID
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(credentialId),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive a 256-bit AES-GCM key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('conflux-espace-salt'), // Static salt (in production, use per-user salt)
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
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
