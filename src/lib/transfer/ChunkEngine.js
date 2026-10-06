import { CHUNK_SIZE, encodeChunkPacket, } from './PacketProtocol';
import { BackpressureController } from './BackpressureController';
import { computeSHA256 } from '@/lib/hashing/hashUtils';
import { useTransferStore } from '@/stores/useTransferStore';
export class ChunkEngine {
    transferId;
    file;
    dataChannel;
    controller;
    callbacks;
    isPaused = false;
    isCancelled = false;
    pausePromise = null;
    resumeResolve = null;
    constructor(transferId, file, dataChannel, callbacks = {}) {
        this.transferId = transferId;
        this.file = file;
        this.dataChannel = dataChannel;
        this.callbacks = callbacks;
        this.controller = new BackpressureController(dataChannel);
    }
    /**
     * Start streaming file chunks progressively with zero RAM exhaustion
     */
    async start() {
        const totalBytes = this.file.size;
        const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
        try {
            // 1. Send file metadata header control message over DataChannel
            const metaMsg = {
                type: 'dropsphere-file-meta',
                transferId: this.transferId,
                name: this.file.name,
                size: totalBytes,
                mimeType: this.file.type || 'application/octet-stream',
                totalChunks,
                chunkSize: CHUNK_SIZE,
            };
            if (this.dataChannel.readyState !== 'open') {
                throw new Error('WebRTC DataChannel is not open');
            }
            this.dataChannel.send(JSON.stringify(metaMsg));
            let bytesTransferred = 0;
            let lastReportTime = Date.now();
            let lastReportBytes = 0;
            let currentSpeed = 0;
            // 2. Progressive chunk streaming loop
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                if (this.isCancelled) {
                    throw new Error('Transfer cancelled');
                }
                // Handle pause
                if (this.isPaused) {
                    await this.waitForResume();
                }
                const startByte = chunkIndex * CHUNK_SIZE;
                const endByte = Math.min(startByte + CHUNK_SIZE, totalBytes);
                const fileSlice = this.file.slice(startByte, endByte);
                // Read ONLY current 64KB slice into memory
                const sliceArrayBuffer = await fileSlice.arrayBuffer();
                // Encode 49-byte binary header with payload
                const packet = encodeChunkPacket(this.transferId, chunkIndex, totalChunks, sliceArrayBuffer);
                // Send through BackpressureController (pauses if buffer > 4MB)
                await this.controller.send(packet);
                bytesTransferred += (endByte - startByte);
                // Calculate speed & throttle telemetry report every ~150ms
                const now = Date.now();
                const elapsed = now - lastReportTime;
                if (elapsed >= 150 || chunkIndex === totalChunks - 1) {
                    const deltaBytes = bytesTransferred - lastReportBytes;
                    currentSpeed = elapsed > 0 ? (deltaBytes / (elapsed / 1000)) : 0;
                    lastReportTime = now;
                    lastReportBytes = bytesTransferred;
                    const progress = Math.min(100, Math.round((bytesTransferred / totalBytes) * 100));
                    this.callbacks.onProgress?.(this.transferId, bytesTransferred, currentSpeed, progress);
                }
            }
            // 3. Send transfer completion message
            if (this.dataChannel.readyState === 'open') {
                const completeMsg = {
                    type: 'dropsphere-file-complete',
                    transferId: this.transferId,
                };
                this.dataChannel.send(JSON.stringify(completeMsg));
                // 4. Compute SHA-256 checksum and transmit for integrity handshake
                useTransferStore.getState().setTransferStatus(this.transferId, 'verifying');
                const sha256 = await computeSHA256(this.file);
                if (this.dataChannel.readyState === 'open') {
                    const hashMsg = {
                        type: 'dropsphere-file-hash',
                        transferId: this.transferId,
                        sha256,
                    };
                    this.dataChannel.send(JSON.stringify(hashMsg));
                }
            }
            this.callbacks.onComplete?.(this.transferId);
        }
        catch (err) {
            if (this.isCancelled)
                return;
            const error = err instanceof Error ? err : new Error(String(err));
            this.callbacks.onError?.(this.transferId, error);
            throw error;
        }
    }
    pause() {
        if (this.isPaused)
            return;
        this.isPaused = true;
        this.pausePromise = new Promise((resolve) => {
            this.resumeResolve = resolve;
        });
    }
    resume() {
        if (!this.isPaused)
            return;
        this.isPaused = false;
        if (this.resumeResolve) {
            this.resumeResolve();
            this.resumeResolve = null;
            this.pausePromise = null;
        }
    }
    cancel() {
        this.isCancelled = true;
        this.controller.abort();
        this.resume();
        // Inform peer about cancellation
        try {
            if (this.dataChannel.readyState === 'open') {
                const cancelMsg = {
                    type: 'dropsphere-file-cancel',
                    transferId: this.transferId,
                };
                this.dataChannel.send(JSON.stringify(cancelMsg));
            }
        }
        catch { }
    }
    async waitForResume() {
        if (this.pausePromise) {
            await this.pausePromise;
        }
    }
}
