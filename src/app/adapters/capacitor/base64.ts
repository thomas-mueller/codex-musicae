/** Base64 for the plugin bridge, one chunk at a time (never the whole file as one string). */

const BINARY_SLICE = 0x8000;

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BINARY_SLICE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BINARY_SLICE));
  }
  return btoa(binary);
}

/** Decodes `base64` into `target` starting at `offset`; returns the number of bytes written. */
export function decodeBase64Into(base64: string, target: Uint8Array, offset: number): number {
  const binary = atob(base64);
  for (let i = 0; i < binary.length; i++) {
    target[offset + i] = binary.charCodeAt(i);
  }
  return binary.length;
}
