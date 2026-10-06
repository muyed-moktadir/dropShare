export const CHUNK_SIZE = 64 * 1024; // 64 KB (65,536 bytes)
export const HEADER_SIZE = 49; // 1 + 36 + 4 + 4 + 4
export const MAGIC_BYTE = 0x44; // 'D' for DropSphere binary packet
/**
 * Packs 64KB ArrayBuffer payload with a 49-byte binary header
 * Layout:
 * [0..0]   : Magic Byte (0x44)
 * [1..36]  : Transfer ID (36 ASCII characters)
 * [37..40] : Chunk Index (Uint32 Big-Endian)
 * [41..44] : Total Chunks (Uint32 Big-Endian)
 * [45..48] : Payload Byte Length (Uint32 Big-Endian)
 * [49..N]  : Binary Payload
 */
export function encodeChunkPacket(transferId, chunkIndex, totalChunks, payload) {
    const payloadBytes = payload.byteLength;
    const packetBuffer = new ArrayBuffer(HEADER_SIZE + payloadBytes);
    const view = new DataView(packetBuffer);
    const uint8 = new Uint8Array(packetBuffer);
    // 1. Magic byte
    view.setUint8(0, MAGIC_BYTE);
    // 2. Transfer ID (pad or truncate to 36 chars)
    const idStr = transferId.padEnd(36, ' ').slice(0, 36);
    for (let i = 0; i < 36; i++) {
        uint8[1 + i] = idStr.charCodeAt(i);
    }
    // 3. Chunk Index
    view.setUint32(37, chunkIndex, false);
    // 4. Total Chunks
    view.setUint32(41, totalChunks, false);
    // 5. Payload Length
    view.setUint32(45, payloadBytes, false);
    // 6. Payload Data
    uint8.set(new Uint8Array(payload), HEADER_SIZE);
    return packetBuffer;
}
/**
 * Decodes incoming packet ArrayBuffer into metadata and payload
 */
export function decodeChunkPacket(buffer) {
    if (buffer.byteLength < HEADER_SIZE) {
        return null;
    }
    const view = new DataView(buffer);
    const magic = view.getUint8(0);
    if (magic !== MAGIC_BYTE) {
        return null;
    }
    const uint8 = new Uint8Array(buffer);
    let transferId = '';
    for (let i = 0; i < 36; i++) {
        transferId += String.fromCharCode(uint8[1 + i]);
    }
    transferId = transferId.trim();
    const chunkIndex = view.getUint32(37, false);
    const totalChunks = view.getUint32(41, false);
    const payloadLength = view.getUint32(45, false);
    if (buffer.byteLength < HEADER_SIZE + payloadLength) {
        return null;
    }
    const payload = buffer.slice(HEADER_SIZE, HEADER_SIZE + payloadLength);
    return {
        transferId,
        chunkIndex,
        totalChunks,
        payload,
    };
}
