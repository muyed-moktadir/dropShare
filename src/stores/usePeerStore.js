import { create } from 'zustand';
export const usePeerStore = create((set, get) => ({
    localDevice: {
        id: 'local-node-9421',
        name: 'My Workspace',
        type: 'desktop',
        os: 'windows',
        ip: '',
        ping: 0,
        status: 'connected',
        lastSeen: Date.now(),
        isLocal: true,
    },
    peers: [],
    selectedPeerId: null,
    activeConnectedPeerId: null,
    signalingStatus: 'disconnected',
    roomId: null,
    serverLanIp: null,
    rtcDiagnostics: {
        iceConnectionState: 'new',
        dataChannelState: 'idle',
        rtt: 0,
        dtlsState: 'DTLS 1.3 Active',
    },
    isHost: false,
    role: 'guest',
    hostPeerId: null,
    targetRecipientMode: 'all',
    selectedRecipientIds: [],
    setIsHost: (isHost, hostPeerId) => set((state) => ({
        isHost,
        role: isHost ? 'host' : 'guest',
        hostPeerId: hostPeerId !== undefined ? hostPeerId : state.hostPeerId,
        localDevice: {
            ...state.localDevice,
            isHost,
            role: isHost ? 'host' : 'guest',
        },
    })),
    setRole: (role) => set((state) => ({
        role,
        isHost: role === 'host',
        localDevice: {
            ...state.localDevice,
            role,
            isHost: role === 'host',
        },
    })),
    setHostPeerId: (hostPeerId) => set({ hostPeerId }),
    setTargetRecipientMode: (mode) => set({ targetRecipientMode: mode }),
    toggleSelectRecipient: (peerId) => set((state) => {
        const exists = state.selectedRecipientIds.includes(peerId);
        return {
            selectedRecipientIds: exists
                ? state.selectedRecipientIds.filter((id) => id !== peerId)
                : [...state.selectedRecipientIds, peerId],
        };
    }),
    selectAllRecipients: () => set((state) => ({
        selectedRecipientIds: state.peers.map((p) => p.id),
    })),
    clearSelectedRecipients: () => set({ selectedRecipientIds: [] }),
    connectHandler: null,
    setLocalDevice: (device) => set((state) => ({
        localDevice: { ...state.localDevice, ...device },
    })),
    setLocalDeviceName: (name) => set((state) => ({
        localDevice: { ...state.localDevice, name },
    })),
    setSignalingStatus: (status) => set({ signalingStatus: status }),
    setRoomId: (roomId) => set({ roomId }),
    setServerLanIp: (serverLanIp) => set((state) => ({
        serverLanIp,
        localDevice: serverLanIp ? { ...state.localDevice, ip: serverLanIp } : state.localDevice,
    })),
    setPeers: (peers) => set({ peers }),
    addPeer: (peer) => set((state) => {
        const exists = state.peers.some((p) => p.id === peer.id);
        if (exists) {
            return {
                peers: state.peers.map((p) => (p.id === peer.id ? { ...p, ...peer } : p)),
            };
        }
        return { peers: [...state.peers, peer] };
    }),
    removePeer: (id) => set((state) => ({
        peers: state.peers.filter((p) => p.id !== id),
        selectedPeerId: state.selectedPeerId === id ? null : state.selectedPeerId,
        activeConnectedPeerId: state.activeConnectedPeerId === id ? null : state.activeConnectedPeerId,
    })),
    selectPeer: (id) => set({ selectedPeerId: id }),
    setActiveConnectedPeerId: (id) => set({ activeConnectedPeerId: id }),
    setConnectHandler: (handler) => set({ connectHandler: handler }),
    setRtcDiagnostics: (diag) => set((state) => ({
        rtcDiagnostics: { ...state.rtcDiagnostics, ...diag },
    })),
    connectToPeer: (id) => {
        set((state) => ({
            peers: state.peers.map((p) => p.id === id ? { ...p, status: 'connecting' } : p),
        }));
        const handler = get().connectHandler;
        if (handler) {
            handler(id);
        }
        else {
            // Fallback transition for preview if no WebRTC handler active
            setTimeout(() => {
                set((state) => ({
                    activeConnectedPeerId: id,
                    selectedPeerId: id,
                    peers: state.peers.map((p) => p.id === id ? { ...p, status: 'connected' } : p),
                }));
            }, 900);
        }
    },
    disconnectPeer: (id) => set((state) => ({
        activeConnectedPeerId: state.activeConnectedPeerId === id ? null : state.activeConnectedPeerId,
        peers: state.peers.map((p) => p.id === id ? { ...p, status: 'idle' } : p),
    })),
    updatePeerStatus: (id, status, ping) => set((state) => ({
        peers: state.peers.map((p) => p.id === id ? { ...p, status, ...(ping !== undefined ? { ping } : {}) } : p),
    })),
}));
