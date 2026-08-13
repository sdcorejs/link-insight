export interface EncryptedToken {
  readonly ciphertext: string;
  readonly iv: string;
  readonly keyVersion: 1;
}

const TOKEN_ADDITIONAL_DATA = new TextEncoder().encode(
  'sdcorejs-link-insight:atlassian-refresh-token:v1',
);

export async function encryptToken(plaintext: string, encodedKey: string): Promise<EncryptedToken> {
  const key = await importAesKey(encodedKey, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(TOKEN_ADDITIONAL_DATA),
      tagLength: 128,
    },
    key,
    toArrayBuffer(new TextEncoder().encode(plaintext)),
  );
  return {
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
    keyVersion: 1,
  };
}

export async function decryptToken(encrypted: EncryptedToken, encodedKey: string): Promise<string> {
  if (encrypted.keyVersion !== 1) {
    throw new TypeError('Unsupported token encryption key version.');
  }
  const key = await importAesKey(encodedKey, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(decodeBase64(encrypted.iv)),
      additionalData: toArrayBuffer(TOKEN_ADDITIONAL_DATA),
      tagLength: 128,
    },
    key,
    toArrayBuffer(decodeBase64(encrypted.ciphertext)),
  );
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(plaintext);
}

export async function hashOpaqueToken(value: string, encodedKey: string): Promise<string> {
  const material = decodeBase64(encodedKey);
  if (material.byteLength < 32) {
    throw new TypeError('SESSION_HMAC_KEY must decode to at least 32 bytes.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(material),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    toArrayBuffer(new TextEncoder().encode(value)),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    toArrayBuffer(new TextEncoder().encode(verifier)),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

export function createOpaqueToken(byteLength = 32): string {
  if (!Number.isInteger(byteLength) || byteLength < 24 || byteLength > 64) {
    throw new TypeError('Opaque tokens must contain between 24 and 64 random bytes.');
  }
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function importAesKey(
  encodedKey: string,
  usages: Array<'encrypt' | 'decrypt'>,
): Promise<CryptoKey> {
  const material = decodeBase64(encodedKey);
  if (material.byteLength !== 32) {
    throw new TypeError('TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  }
  return crypto.subtle.importKey('raw', toArrayBuffer(material), 'AES-GCM', false, usages);
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) {
    binary += String.fromCodePoint(byte);
  }
  return btoa(binary);
}

function encodeBase64Url(value: Uint8Array): string {
  return encodeBase64(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new TypeError('Encoded key material is not valid base64.');
  }
  return Uint8Array.from(binary, (character) => character.codePointAt(0)!);
}
