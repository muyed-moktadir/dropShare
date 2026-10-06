import { create } from 'zustand';
export const useScreenShareStore = create((set, get) => ({
    isBroadcasting: false,
    localStream: null,
    remoteStream: null,
    remotePeerId: null,
    remotePeerName: null,
    isTheaterMode: false,
    isMuted: false,
    resolution: '1920x1080',
    fps: 60,
    captureAudio: true,
    activePresenter: null,
    pendingRequest: null,
    requestStatus: 'idle',
    setBroadcasting: (isBroadcasting, stream = null) => {
        // If stopping broadcast, clean up local tracks
        if (!isBroadcasting && get().localStream) {
            get().localStream?.getTracks().forEach((track) => track.stop());
        }
        set({
            isBroadcasting,
            localStream: stream,
        });
    },
    setRemoteStream: (stream, peerId = null, peerName = null) => {
        const current = get();
        if (current.remoteStream === stream &&
            current.remotePeerId === peerId &&
            current.remotePeerName === peerName) {
            return;
        }
        set({
            remoteStream: stream,
            remotePeerId: peerId,
            remotePeerName: peerName,
        });
    },
    setTheaterMode: (isTheaterMode) => set({ isTheaterMode }),
    setMuted: (isMuted) => set({ isMuted }),
    setCaptureAudio: (captureAudio) => set({ captureAudio }),
    setStreamStats: (stats) => set((state) => ({
        resolution: stats.resolution ?? state.resolution,
        fps: stats.fps ?? state.fps,
    })),
    setActivePresenter: (activePresenter) => set({ activePresenter }),
    setPendingRequest: (pendingRequest) => set({ pendingRequest }),
    setRequestStatus: (requestStatus) => set({ requestStatus }),
    stopAll: () => {
        const { localStream } = get();
        localStream?.getTracks().forEach((t) => t.stop());
        set({
            isBroadcasting: false,
            localStream: null,
            remoteStream: null,
            remotePeerId: null,
            remotePeerName: null,
            activePresenter: null,
            pendingRequest: null,
            requestStatus: 'idle',
        });
    },
}));
