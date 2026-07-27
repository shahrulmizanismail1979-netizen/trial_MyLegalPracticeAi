/**
 * Storage key path-traversal guard.
 *
 * Research object-storage keys are relative paths appended directly to the
 * bucket prefix. An attacker who controls a key could escape the storage
 * root by inserting `..` segments. These helpers validate every key before
 * it is passed to the storage adapter.
 */

/** Maximum total byte-length of a storage key. */
const MAX_KEY_LENGTH = 1024;

/**
 * Validate a research storage key for path-traversal safety.
 *
 * Throws a `TypeError` if:
 * - The key is empty or not a string.
 * - The key contains a `..` path segment (directory traversal).
 * - The key begins with `/` (absolute path).
 * - Any segment contains a NUL byte.
 * - The key exceeds {@link MAX_KEY_LENGTH} characters.
 */
export function validateStorageKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("Storage key must be a non-empty string");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new TypeError(
      `Storage key exceeds maximum length (${MAX_KEY_LENGTH}): length=${key.length}`,
    );
  }
  // Reject absolute paths — the adapter always prefixes its own root
  if (key.startsWith("/")) {
    throw new TypeError(
      `Storage key must not start with '/': ${JSON.stringify(key)}`,
    );
  }
  // Split on forward-slash (the only path separator we recognise) and inspect
  // each segment individually
  for (const segment of key.split("/")) {
    if (segment === "..") {
      throw new TypeError(
        `Storage key must not contain '..' segments: ${JSON.stringify(key)}`,
      );
    }
    if (segment.includes("\0")) {
      throw new TypeError(
        `Storage key must not contain NUL bytes: ${JSON.stringify(key)}`,
      );
    }
  }
}

/**
 * Return `true` if the key is safe according to {@link validateStorageKey};
 * `false` otherwise. Useful in boolean guards without try/catch.
 */
export function isStorageKeySafe(key: string): boolean {
  try {
    validateStorageKey(key);
    return true;
  } catch {
    return false;
  }
}
