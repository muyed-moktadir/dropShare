import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useTransferStore = create()(persist((set) => ({
    // Clean queue starting empty, awaiting live P2P file transfers
    transfers: [],
    addTransfer: (item) => {
        const id = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newTransfer = {
            ...item,
            id,
            startedAt: Date.now(),
        };
        set((state) => ({ transfers: [newTransfer, ...state.transfers] }));
        return id;
    },
    addTransferWithId: (item) => {
        const newTransfer = {
            ...item,
            startedAt: Date.now(),
        };
        set((state) => {
            // Avoid duplicate row
            const exists = state.transfers.some((t) => t.id === item.id);
            if (exists) {
                return {
                    transfers: state.transfers.map((t) => (t.id === item.id ? { ...t, ...newTransfer } : t)),
                };
            }
            return { transfers: [newTransfer, ...state.transfers] };
        });
    },
    updateTransferProgress: (id, bytesTransferred, speed) => set((state) => ({
        transfers: state.transfers.map((tx) => {
            if (tx.id !== id)
                return tx;
            const progress = Math.min(100, Math.round((bytesTransferred / tx.size) * 100));
            const remainingBytes = Math.max(0, tx.size - bytesTransferred);
            const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;
            return {
                ...tx,
                bytesTransferred,
                progress,
                speed,
                eta,
                status: progress >= 100 ? (tx.status === 'completed' ? 'completed' : 'verifying') : tx.status,
            };
        }),
    })),
    setTransferStatus: (id, status, error) => set((state) => ({
        transfers: state.transfers.map((tx) => tx.id === id ? { ...tx, status, ...(error ? { error } : {}) } : tx),
    })),
    setTransferVerified: (id, sha256) => set((state) => ({
        transfers: state.transfers.map((tx) => tx.id === id
            ? {
                ...tx,
                sha256,
                sha256Verified: true,
                status: 'completed',
                completedAt: Date.now(),
            }
            : tx),
    })),
    removeTransfer: (id) => set((state) => ({
        transfers: state.transfers.filter((tx) => tx.id !== id),
    })),
    clearCompleted: () => set((state) => ({
        transfers: state.transfers.filter((tx) => tx.status !== 'completed'),
    })),
}), {
    name: 'dropsphere_transfer_history',
}));
