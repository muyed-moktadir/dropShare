import { ChunkEngine } from './ChunkEngine';
import { useTransferStore } from '@/stores/useTransferStore';
export class TransferManager {
    activeSendEngines = new Map();
    /**
     * Initiates sending a file across an active RTCDataChannel
     */
    async sendFile(file, peerId, peerName, dataChannel) {
        if (dataChannel.readyState !== 'open') {
            throw new Error(`DataChannel to ${peerName} is not open (current state: ${dataChannel.readyState})`);
        }
        // 1. Create unique transfer record in store
        const transferId = useTransferStore.getState().addTransfer({
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            progress: 0,
            bytesTransferred: 0,
            speed: 0,
            eta: 0,
            status: 'transferring',
            direction: 'send',
            peerId,
            peerName,
        });
        // 2. Initialize ChunkEngine
        const engine = new ChunkEngine(transferId, file, dataChannel, {
            onProgress: (id, bytesTransferred, speed, progress) => {
                useTransferStore.getState().updateTransferProgress(id, bytesTransferred, speed);
            },
            onComplete: (id) => {
                useTransferStore.getState().setTransferStatus(id, 'completed');
                this.activeSendEngines.delete(id);
            },
            onError: (id, error) => {
                console.error(`[TransferManager] Error transferring ${id}:`, error);
                useTransferStore.getState().setTransferStatus(id, 'failed', error.message);
                this.activeSendEngines.delete(id);
            },
        });
        this.activeSendEngines.set(transferId, engine);
        // 3. Start progressive 64KB chunk streaming (async, non-blocking)
        engine.start().catch((err) => {
            console.warn(`[TransferManager] ChunkEngine finished with status:`, err);
        });
        return transferId;
    }
    /**
     * Broadcasts or selectively sends a file to multiple peers simultaneously
     */
    async sendToTargets(file, targets) {
        const validTargets = targets.filter((t) => t.dataChannel.readyState === 'open');
        if (validTargets.length === 0) {
            throw new Error('No open P2P DataChannels available for sending.');
        }
        const promises = validTargets.map((target) => this.sendFile(file, target.peerId, target.peerName, target.dataChannel));
        return Promise.all(promises);
    }
    pause(transferId) {
        const engine = this.activeSendEngines.get(transferId);
        if (engine) {
            engine.pause();
            useTransferStore.getState().setTransferStatus(transferId, 'paused');
        }
    }
    resume(transferId) {
        const engine = this.activeSendEngines.get(transferId);
        if (engine) {
            engine.resume();
            useTransferStore.getState().setTransferStatus(transferId, 'transferring');
        }
    }
    cancel(transferId) {
        const engine = this.activeSendEngines.get(transferId);
        if (engine) {
            engine.cancel();
            this.activeSendEngines.delete(transferId);
        }
        useTransferStore.getState().setTransferStatus(transferId, 'cancelled');
    }
    hasActiveTransfers() {
        return this.activeSendEngines.size > 0;
    }
}
export const transferManager = new TransferManager();
