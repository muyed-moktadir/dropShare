import { decodeChunkPacket, } from './PacketProtocol';
import { useTransferStore } from '@/stores/useTransferStore';
import { computeSHA256 } from '@/lib/hashing/hashUtils';
export class ReceiverEngine {
    activeTransfers = new Map();
    /**
     * Handle incoming raw string messages (control protocol & SHA-256 verification)
     */
    handleControlMessage(data, peerId, peerName, dataChannel) {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'dropsphere-file-meta') {
                const meta = msg;
                this.startIncomingTransfer(meta, peerId, peerName);
                return true;
            }
            if (msg.type === 'dropsphere-file-complete') {
                const complete = msg;
                const incoming = this.activeTransfers.get(complete.transferId);
                if (incoming) {
                    incoming.isAllChunksReceived = true;
                    this.checkAndFinalize(complete.transferId, dataChannel);
                }
                return true;
            }
            if (msg.type === 'dropsphere-file-hash') {
                const hashMsg = msg;
                const incoming = this.activeTransfers.get(hashMsg.transferId);
                if (incoming) {
                    incoming.senderHash = hashMsg.sha256;
                    this.checkAndFinalize(hashMsg.transferId, dataChannel);
                }
                return true;
            }
            // Sender side handling receiver's verification handshake
            if (msg.type === 'dropsphere-hash-verified') {
                const verifiedMsg = msg;
                useTransferStore.getState().setTransferVerified(verifiedMsg.transferId, verifiedMsg.sha256);
                return true;
            }
            // Sender side handling receiver's hash corruption flag
            if (msg.type === 'dropsphere-hash-failed') {
                const failedMsg = msg;
                useTransferStore.getState().setTransferStatus(failedMsg.transferId, 'failed', failedMsg.reason || 'Receiver detected SHA-256 checksum mismatch');
                return true;
            }
            if (msg.type === 'dropsphere-file-cancel') {
                const cancel = msg;
                this.cancelIncomingTransfer(cancel.transferId);
                return true;
            }
        }
        catch {
            // Not a JSON message handled by ReceiverEngine
        }
        return false;
    }
    /**
     * Handle incoming binary ArrayBuffer chunks
     */
    handleBinaryChunk(buffer, dataChannel) {
        const packet = decodeChunkPacket(buffer);
        if (!packet) {
            return false;
        }
        const { transferId, chunkIndex, totalChunks, payload } = packet;
        const incoming = this.activeTransfers.get(transferId);
        if (!incoming) {
            return false;
        }
        // Save chunk
        if (!incoming.chunks[chunkIndex]) {
            incoming.chunks[chunkIndex] = payload;
            incoming.receivedChunks++;
            incoming.bytesReceived += payload.byteLength;
        }
        // Throttled speed and progress update
        const now = Date.now();
        const elapsed = now - incoming.lastReportTime;
        if (elapsed >= 150 || incoming.receivedChunks === totalChunks) {
            const deltaBytes = incoming.bytesReceived - incoming.lastReportBytes;
            const speed = elapsed > 0 ? deltaBytes / (elapsed / 1000) : 0;
            incoming.lastReportTime = now;
            incoming.lastReportBytes = incoming.bytesReceived;
            useTransferStore.getState().updateTransferProgress(transferId, incoming.bytesReceived, speed);
        }
        // If all chunks received, mark chunk arrival complete and check verification
        if (incoming.receivedChunks >= totalChunks) {
            incoming.isAllChunksReceived = true;
            this.checkAndFinalize(transferId, dataChannel);
        }
        return true;
    }
    startIncomingTransfer(meta, peerId, peerName) {
        const incoming = {
            meta,
            peerId,
            peerName,
            chunks: new Array(meta.totalChunks).fill(null),
            receivedChunks: 0,
            bytesReceived: 0,
            lastReportTime: Date.now(),
            lastReportBytes: 0,
            startedAt: Date.now(),
            isAllChunksReceived: false,
            isVerifying: false,
        };
        this.activeTransfers.set(meta.transferId, incoming);
        // Register incoming transfer row in store
        useTransferStore.getState().addTransferWithId({
            id: meta.transferId,
            name: meta.name,
            size: meta.size,
            type: meta.mimeType,
            progress: 0,
            bytesTransferred: 0,
            speed: 0,
            eta: 0,
            status: 'transferring',
            direction: 'receive',
            peerId,
            peerName,
        });
    }
    /**
     * Reassembles chunks and runs Web Crypto SHA-256 verification
     */
    async checkAndFinalize(transferId, dataChannel) {
        const incoming = this.activeTransfers.get(transferId);
        if (!incoming)
            return;
        // All chunks must be received
        if (!incoming.isAllChunksReceived)
            return;
        // Assemble blob and calculate local hash once
        if (!incoming.assembledBlob || !incoming.localHash) {
            if (incoming.isVerifying)
                return;
            incoming.isVerifying = true;
            useTransferStore.getState().setTransferStatus(transferId, 'verifying');
            try {
                const validChunks = [];
                for (const chunk of incoming.chunks) {
                    if (chunk)
                        validChunks.push(chunk);
                }
                incoming.assembledBlob = new Blob(validChunks, { type: incoming.meta.mimeType });
                incoming.localHash = await computeSHA256(incoming.assembledBlob);
            }
            catch (err) {
                console.error('[ReceiverEngine] Error finalizing transfer chunks:', err);
                useTransferStore.getState().setTransferStatus(transferId, 'failed', 'Error assembling file chunks');
                this.activeTransfers.delete(transferId);
                return;
            }
            finally {
                incoming.isVerifying = false;
            }
        }
        const { assembledBlob, localHash } = incoming;
        // If sender hash is already present, verify match
        if (incoming.senderHash) {
            if (incoming.senderHash.toLowerCase() === localHash.toLowerCase()) {
                console.log(`[DropSphere SHA-256] ✓ Verification SUCCESS for ${incoming.meta.name}: ${localHash}`);
                useTransferStore.getState().setTransferVerified(transferId, localHash);
                if (dataChannel && dataChannel.readyState === 'open') {
                    const verifiedMsg = {
                        type: 'dropsphere-hash-verified',
                        transferId,
                        sha256: localHash,
                    };
                    dataChannel.send(JSON.stringify(verifiedMsg));
                }
                this.triggerDownload(assembledBlob, incoming.meta.name);
                this.activeTransfers.delete(transferId);
            }
            else {
                console.error(`[DropSphere SHA-256] ❌ Checksum MISMATCH! Expected ${incoming.senderHash}, got ${localHash}`);
                useTransferStore.getState().setTransferStatus(transferId, 'failed', 'SHA-256 hash mismatch: Data corrupted in transit');
                if (dataChannel && dataChannel.readyState === 'open') {
                    const failedMsg = {
                        type: 'dropsphere-hash-failed',
                        transferId,
                        reason: 'SHA-256 checksum mismatch (corrupted)',
                    };
                    dataChannel.send(JSON.stringify(failedMsg));
                }
                this.activeTransfers.delete(transferId);
            }
        }
        else {
            // Sender hash hasn't arrived yet. Set a 1.2s timeout: if sender hash doesn't arrive, finalize with local hash
            setTimeout(() => {
                const item = this.activeTransfers.get(transferId);
                if (item && item.assembledBlob && item.localHash) {
                    console.log(`[DropSphere SHA-256] Finalizing with local hash for ${item.meta.name}`);
                    useTransferStore.getState().setTransferVerified(transferId, item.localHash);
                    this.triggerDownload(item.assembledBlob, item.meta.name);
                    this.activeTransfers.delete(transferId);
                }
            }, 1200);
        }
    }
    cancelIncomingTransfer(transferId) {
        this.activeTransfers.delete(transferId);
        useTransferStore.getState().setTransferStatus(transferId, 'cancelled');
    }
    triggerDownload(blob, filename) {
        if (typeof window === 'undefined')
            return;
        try {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 1000);
        }
        catch (err) {
            console.error('[ReceiverEngine] Failed to auto-download:', err);
        }
    }
    destroy() {
        this.activeTransfers.clear();
    }
}
export const receiverEngine = new ReceiverEngine();
