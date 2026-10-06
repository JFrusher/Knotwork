/**
 * Sealing what a guest link publishes.
 *
 * AES-GCM under a random key that exists in two places: the link, after the
 * `#` (which browsers never send to a server), and the wedding's own row on
 * the account, so any member can republish as seats change. What the public
 * read serves is ciphertext only.
 *
 * WebCrypto throughout: no dependency, and the primitives are the platform's.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface Sealed {
  /** Base64 ciphertext, with the GCM tag appended by WebCrypto. */
  ciphertext: string;
  /** Base64 nonce. Fresh for every seal — never reused under one key. */
  iv: string;
}

/**
 * Encrypt a snapshot.
 *
 * A fresh 96-bit nonce every time. Reusing one under the same key is the single
 * catastrophic mistake available with GCM: it leaks the XOR of two plaintexts
 * and destroys the authentication guarantee. Generated here rather than passed
 * in so no caller can supply a stale one.
 */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { ciphertext: toBase64(new Uint8Array(ciphertext)), iv: toBase64(iv) };
}

/**
 * Decrypt a snapshot.
 *
 * Throws on a wrong key or tampered bytes — GCM authenticates, so a modified
 * ciphertext fails rather than decrypting to rubbish. The caller treats that as a
 * link copied only in part, which is what it almost always is.
 */
export async function unseal(key: CryptoKey, sealed: Sealed): Promise<unknown> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(sealed.iv) },
    key,
    fromBase64(sealed.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext));
}

/** A fresh key for a guest link, encoded to travel in the URL fragment. */
export async function newShareKey(): Promise<{ key: CryptoKey; encoded: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await importShareKey(toBase64Url(raw));
  return { key, encoded: toBase64Url(raw) };
}

export async function importShareKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64Url(encoded), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// encoding --------------------------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** URL-safe, and unpadded, so it survives a path segment and a fragment intact. */
function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return fromBase64(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}
