/**
 * DropSphere Cryptographic Integrity Engine
 * Native Web Crypto API (SubtleCrypto) SHA-256 implementation
 */
export async function computeSHA256(data) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
    }
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const digestBuffer = await crypto.subtle.digest('SHA-256', buffer);
    // Fast hex formatting
    const hashArray = Array.from(new Uint8Array(digestBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
