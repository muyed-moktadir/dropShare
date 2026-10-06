'use client';
import { useEffect, useRef, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager';
import { getSignalingClient } from '@/hooks/useSignaling';
import { usePeerStore } from '@/stores/usePeerStore';
import { useScreenShareStore } from '@/stores/useScreenShareStore';
import { useUIStore } from '@/stores/useUIStore';
import { receiverEngine } from '@/lib/transfer/ReceiverEngine';
import { transferManager } from '@/lib/transfer/TransferManager';
let globalWebRTCManager = null;
export function getWebRTCManager() {
    return globalWebRTCManager;
}
export function useWebRTC() {
    const { peers, isHost, localDevice, activeConnectedPeerId, setActiveConnectedPeerId, updatePeerStatus, setConnectHandler, setRtcDiagnostics, } = usePeerStore();
    const managerRef = useRef(null);
    // Initialize WebRTCManager
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const signalingClient = getSignalingClient();
        // Create manager with bridge to signaling client
        if (!globalWebRTCManager) {
            globalWebRTCManager = new WebRTCManager({
                sendOffer: (targetPeerId, offer) => {
                    const client = getSignalingClient();
                    client?.sendOffer(targetPeerId, offer);
                },
                sendAnswer: (targetPeerId, answer) => {
                    const client = getSignalingClient();
                    client?.sendAnswer(targetPeerId, answer);
                },
                sendIceCandidate: (targetPeerId, candidate) => {
                    const client = getSignalingClient();
                    client?.sendIceCandidate(targetPeerId, candidate);
                },
            });
        }
        const manager = globalWebRTCManager;
        managerRef.current = manager;
        // Set polite peer role (guests are polite, host is authoritative)
        manager.setIsPolite(() => !usePeerStore.getState().isHost);
        // Attach WebRTC lifecycle events
        manager.setEvents({
            onConnectionStateChange: (peerId, status) => {
                console.log(`[useWebRTC] Peer ${peerId} status changed to ${status}`);
                updatePeerStatus(peerId, status);
                if (status === 'connected') {
                    setActiveConnectedPeerId(peerId);
                }
                else if (status === 'failed' || status === 'idle') {
                    if (activeConnectedPeerId === peerId) {
                        setActiveConnectedPeerId(null);
                    }
                }
            },
            onIceStateChange: (peerId, iceState) => {
                setRtcDiagnostics({
                    iceConnectionState: iceState,
                });
            },
            onDataChannelOpen: (peerId) => {
                console.log(`[useWebRTC] Data channel established with peer ${peerId}`);
                setActiveConnectedPeerId(peerId);
                updatePeerStatus(peerId, 'connected');
                setRtcDiagnostics({
                    dataChannelState: 'open (reliable / ordered)',
                    iceConnectionState: 'connected (P2P Direct)',
                });
            },
            onDataChannelClose: (peerId) => {
                console.log(`[useWebRTC] Data channel closed with peer ${peerId}`);
                if (activeConnectedPeerId === peerId) {
                    setActiveConnectedPeerId(null);
                }
                setRtcDiagnostics({
                    dataChannelState: 'closed',
                });
            },
            onDataChannelMessage: (peerId, data) => {
                const peers = usePeerStore.getState().peers;
                const peer = peers.find((p) => p.id === peerId);
                const peerName = peer?.name || 'Remote Peer';
                const dc = managerRef.current?.getDataChannel(peerId);
                if (typeof data === 'string') {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.type === 'DROPSPHERE_SCREEN_START') {
                            console.log(`[useWebRTC] Screen broadcast started by ${parsed.presenterName} (${parsed.presenterId})`);
                            useScreenShareStore.getState().setActivePresenter({
                                peerId: parsed.presenterId,
                                peerName: parsed.presenterName,
                                isHost: parsed.isHost,
                            });
                            useUIStore.getState().setActiveTab('screenshare');
                            // If stream already arrived, attach it immediately!
                            const stream = managerRef.current?.getRemoteStream(parsed.presenterId);
                            if (stream && stream.getTracks().length > 0) {
                                useScreenShareStore.getState().setRemoteStream(stream, parsed.presenterId, parsed.presenterName);
                            }
                            return;
                        }
                        if (parsed.type === 'DROPSPHERE_SCREEN_POLL') {
                            console.log(`[useWebRTC] Screen broadcast poll from ${parsed.requesterName || peerName} (${parsed.requesterId || peerId})`);
                            const isBroadcasting = useScreenShareStore.getState().isBroadcasting;
                            const broadcastStream = managerRef.current?.getCurrentBroadcastStream() || useScreenShareStore.getState().localStream;
                            if (isBroadcasting && broadcastStream) {
                                console.log(`[useWebRTC] Responding to screen poll for ${peerId} - attaching live broadcast stream`);
                                const localDev = usePeerStore.getState().localDevice;
                                const isHost = usePeerStore.getState().isHost;
                                // 1. Reply with start announcement directly to requester
                                const reply = JSON.stringify({
                                    type: 'DROPSPHERE_SCREEN_START',
                                    presenterId: localDev.id,
                                    presenterName: localDev.name,
                                    isHost,
                                });
                                managerRef.current?.sendData(peerId, reply);
                                // 2. Only renegotiate if media stream is not already flowing
                                const alreadySending = managerRef.current?.hasMediaStream(peerId);
                                if (!alreadySending) {
                                    console.log(`[useWebRTC] Attaching live broadcast stream for polling peer ${peerId}`);
                                    managerRef.current?.addMediaStream(peerId, broadcastStream).catch((err) => {
                                        console.warn(`[useWebRTC] Failed to add media stream for polling peer ${peerId}:`, err);
                                    });
                                }
                            }
                            return;
                        }
                        if (parsed.type === 'DROPSPHERE_SCREEN_STOP' || parsed.type === 'dropsphere-screen-stop') {
                            console.log(`[useWebRTC] Screen broadcast stopped by ${parsed.presenterId}`);
                            useScreenShareStore.getState().setRemoteStream(null);
                            useScreenShareStore.getState().setActivePresenter(null);
                            if (parsed.force && useScreenShareStore.getState().isBroadcasting) {
                                // Host requested force stop
                                stopScreenShare();
                            }
                            return;
                        }
                        if (parsed.type === 'DROPSPHERE_SCREEN_REQUEST') {
                            const isBroadcasting = useScreenShareStore.getState().isBroadcasting;
                            const isHost = usePeerStore.getState().isHost;
                            // Active presenter or room host handles presentation handoff requests
                            if (isBroadcasting || isHost) {
                                console.log(`[useWebRTC] Screen share handoff request from ${parsed.requesterName} (${parsed.requesterId})`);
                                useScreenShareStore.getState().setPendingRequest({
                                    requesterId: parsed.requesterId,
                                    requesterName: parsed.requesterName,
                                });
                            }
                            return;
                        }
                        if (parsed.type === 'DROPSPHERE_SCREEN_RESPONSE') {
                            console.log(`[useWebRTC] Screen share response received: approved=${parsed.approved}`);
                            if (parsed.approved) {
                                useScreenShareStore.getState().setRequestStatus('approved');
                                // Automatically prompt screen capture when approved
                                setTimeout(() => {
                                    startScreenShare().catch((err) => {
                                        console.warn('Failed to start approved screen share:', err);
                                    });
                                }, 300);
                            }
                            else {
                                useScreenShareStore.getState().setRequestStatus('denied');
                                setTimeout(() => {
                                    useScreenShareStore.getState().setRequestStatus('idle');
                                }, 4000);
                            }
                            return;
                        }
                    }
                    catch { }
                    receiverEngine.handleControlMessage(data, peerId, peerName, dc);
                }
                else if (data instanceof ArrayBuffer) {
                    receiverEngine.handleBinaryChunk(data, dc);
                }
            },
            onTrack: (peerId, stream, track) => {
                console.log(`[useWebRTC] Remote media track (${track.kind}) received from peer ${peerId}, muted=${track.muted}`);
                const peers = usePeerStore.getState().peers;
                const peer = peers.find((p) => p.id === peerId);
                const peerName = peer?.name || 'Remote Peer';
                // Preserve stream reference and ensure all tracks are aggregated
                const existingRemoteStream = useScreenShareStore.getState().remoteStream;
                let incomingStream;
                if (stream && stream.getTracks().length > 0) {
                    incomingStream = stream;
                }
                else if (existingRemoteStream && existingRemoteStream.active) {
                    incomingStream = existingRemoteStream;
                    if (!incomingStream.getTracks().some((t) => t.id === track.id)) {
                        incomingStream.addTrack(track);
                    }
                }
                else {
                    incomingStream = new MediaStream([track]);
                }
                console.log(`[useWebRTC] Attaching live remote stream (${incomingStream.getTracks().length} tracks) for peer ${peerId}`);
                useScreenShareStore.getState().setRemoteStream(incomingStream, peerId, peerName);
                useScreenShareStore.getState().setActivePresenter({
                    peerId,
                    peerName,
                    isHost: peer?.isHost,
                });
                useUIStore.getState().setActiveTab('screenshare');
                track.onunmute = () => {
                    console.log(`[useWebRTC] Remote track (${track.kind}) unmuted and receiving frames from peer ${peerId}`);
                    useScreenShareStore.getState().setRemoteStream(incomingStream, peerId, peerName);
                };
                track.onended = () => {
                    console.log(`[useWebRTC] Remote track ended for ${peerId}`);
                    const activeTracks = incomingStream.getTracks().filter((t) => t.readyState === 'live');
                    if (activeTracks.length === 0) {
                        useScreenShareStore.getState().setRemoteStream(null);
                        useScreenShareStore.getState().setActivePresenter(null);
                    }
                };
            },
            onPingLatency: (peerId, rttMs) => {
                updatePeerStatus(peerId, 'connected', rttMs);
                setRtcDiagnostics({
                    rtt: rttMs,
                });
            },
            onError: (peerId, error) => {
                console.warn(`[useWebRTC] Error with peer ${peerId}:`, error);
                updatePeerStatus(peerId, 'failed');
            },
        });
        // Wire SignalingClient incoming SDP & ICE messages to WebRTCManager
        if (signalingClient) {
            signalingClient.setEvents({
                onOffer: (senderPeerId, offer) => {
                    console.log(`[useWebRTC] Received offer from ${senderPeerId}`);
                    manager.handleOffer(senderPeerId, offer);
                },
                onAnswer: (senderPeerId, answer) => {
                    console.log(`[useWebRTC] Received answer from ${senderPeerId}`);
                    manager.handleAnswer(senderPeerId, answer);
                },
                onIceCandidate: (senderPeerId, candidate) => {
                    manager.handleCandidate(senderPeerId, candidate);
                },
            });
        }
        // Register connect handler in store so clicking "Connect" in UI triggers WebRTC negotiation
        setConnectHandler((peerId) => {
            console.log(`[useWebRTC] Initiating WebRTC connection to peer ${peerId}`);
            manager.connect(peerId);
        });
        return () => { };
    }, [
        activeConnectedPeerId,
        setActiveConnectedPeerId,
        updatePeerStatus,
        setConnectHandler,
        setRtcDiagnostics,
    ]);
    // ── AUTO-CONNECT EFFECT: Seamlessly handshake as soon as peers join ──
    useEffect(() => {
        const manager = managerRef.current;
        if (!manager || peers.length === 0)
            return;
        peers.forEach((peer) => {
            const dc = manager.getDataChannel(peer.id);
            const pc = manager.getPeerConnection(peer.id);
            const isConnected = dc?.readyState === 'open' && pc?.connectionState === 'connected';
            const isConnecting = pc && (pc.connectionState === 'connecting' || pc.signalingState === 'have-local-offer');
            if (!isConnected && !isConnecting) {
                // Host initiates to all guests; if both are guests, smaller ID initiates
                const shouldInitiate = isHost || (!peer.isHost && localDevice.id < peer.id);
                if (shouldInitiate) {
                    console.log(`[useWebRTC] Auto-connecting to discovered peer ${peer.id} (${peer.name})`);
                    manager.connect(peer.id).catch((err) => {
                        console.warn(`[useWebRTC] Auto-connect to ${peer.id} failed:`, err);
                    });
                }
            }
        });
    }, [peers, isHost, localDevice.id]);
    const connect = useCallback((peerId) => {
        managerRef.current?.connect(peerId);
    }, []);
    const disconnect = useCallback((peerId) => {
        managerRef.current?.disconnect(peerId);
    }, []);
    const sendData = useCallback((peerId, data) => {
        return managerRef.current?.sendData(peerId, data) ?? false;
    }, []);
    // Helper to ensure a specific peer's DataChannel is open (connecting on-the-fly if needed!)
    const ensureDataChannel = useCallback(async (targetId) => {
        const manager = managerRef.current;
        if (!manager) {
            throw new Error('WebRTC Manager is not initialized.');
        }
        let dc = manager.getDataChannel(targetId);
        if (dc && dc.readyState === 'open') {
            return dc;
        }
        console.log(`[useWebRTC] Ensuring DataChannel with peer ${targetId}...`);
        manager.connect(targetId).catch(() => { });
        // Wait up to 12 seconds for the data channel to open
        const success = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 12000);
            const checkInterval = setInterval(() => {
                const currentDc = manager.getDataChannel(targetId);
                const pc = manager.getPeerConnection(targetId);
                if (currentDc && currentDc.readyState === 'open') {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    resolve(true);
                }
                else if (pc && pc.connectionState === 'failed') {
                    console.warn(`[useWebRTC] Connection failed during ensureDataChannel. Re-attempting...`);
                    manager.connect(targetId, true).catch(() => { });
                }
            }, 100);
        });
        dc = manager.getDataChannel(targetId);
        if (!success || !dc || dc.readyState !== 'open') {
            throw new Error('P2P connection handshake timed out. Please check network connectivity.');
        }
        return dc;
    }, []);
    const sendFile = useCallback(async (file, overridePeerId) => {
        const peerStore = usePeerStore.getState();
        const manager = managerRef.current;
        if (!manager) {
            throw new Error('WebRTC Engine is not initialized.');
        }
        // Acquire WakeLock to prevent screen dimming on mobile/laptop during transfer
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
            try {
                await navigator.wakeLock.request('screen');
            }
            catch { }
        }
        const { targetRecipientMode, selectedRecipientIds, activeConnectedPeerId, peers, isHost, hostPeerId } = peerStore;
        if (peers.length === 0 && !overridePeerId) {
            throw new Error('No peer is currently in the room. Please invite or pair a device first.');
        }
        let targetIds = [];
        if (overridePeerId) {
            // Direct drag-and-drop onto a specific device
            targetIds = [overridePeerId];
        }
        else if (!isHost) {
            // Guest sends to Host or first available peer
            const fallback = hostPeerId || (peers[0] ? peers[0].id : null);
            targetIds = activeConnectedPeerId ? [activeConnectedPeerId] : fallback ? [fallback] : [];
        }
        else if (targetRecipientMode === 'selected' && selectedRecipientIds.length > 0) {
            // Host selective mode: send only to checked recipients
            targetIds = selectedRecipientIds;
        }
        else {
            // Host broadcast mode: send to all peers
            targetIds = peers.map((p) => p.id);
        }
        if (targetIds.length === 0) {
            throw new Error('No target device selected for transfer.');
        }
        // Connect on-the-fly and collect open DataChannels
        const targets = await Promise.all(targetIds.map(async (id) => {
            const p = peers.find((peer) => peer.id === id);
            const dc = await ensureDataChannel(id);
            return {
                peerId: id,
                peerName: p?.name || 'Remote Device',
                dataChannel: dc,
            };
        }));
        if (targets.length === 1) {
            return await transferManager.sendFile(file, targets[0].peerId, targets[0].peerName, targets[0].dataChannel);
        }
        else {
            const ids = await transferManager.sendToTargets(file, targets);
            return ids[0];
        }
    }, [ensureDataChannel]);
    const startScreenShare = useCallback(async () => {
        const peerStore = usePeerStore.getState();
        const manager = managerRef.current;
        if (!manager) {
            throw new Error('WebRTC connection engine is not initialized.');
        }
        if (!navigator?.mediaDevices?.getDisplayMedia) {
            const isMobile = /iphone|ipad|android/i.test(navigator?.userAgent || '');
            if (isMobile) {
                throw new Error('Screen broadcasting from mobile browsers is not supported by iOS/Android web standards. You can view remote screen streams from desktop peers.');
            }
            throw new Error('Screen broadcasting requires a Secure Context (HTTPS or localhost). Access via https:// or localhost:3000 to broadcast your screen.');
        }
        // 1. Immediately prompt for screen capture while transient user gesture is fresh!
        const captureAudio = useScreenShareStore.getState().captureAudio;
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: 60, max: 60 },
            },
            audio: captureAudio,
        });
        try {
            // 2. Attach media tracks and renegotiate with ALL connected peers in the room
            await manager.broadcastMediaStream(stream);
            const localDev = peerStore.localDevice;
            const isHost = peerStore.isHost;
            // 3. Broadcast presenter announcement to all peers with redundant heartbeat
            const announcement = JSON.stringify({
                type: 'DROPSPHERE_SCREEN_START',
                presenterId: localDev.id,
                presenterName: localDev.name,
                isHost,
            });
            manager.broadcastData(announcement);
            setTimeout(() => manager.broadcastData(announcement), 400);
            setTimeout(() => manager.broadcastData(announcement), 1200);
            useScreenShareStore.getState().setActivePresenter({
                peerId: localDev.id,
                peerName: localDev.name,
                isHost,
            });
            useScreenShareStore.getState().setBroadcasting(true, stream);
            useUIStore.getState().setActiveTab('screenshare');
            // Handle user clicking native browser "Stop sharing" button
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = async () => {
                    console.log('[useWebRTC] Local screen stream ended via native browser banner');
                    await stopScreenShare();
                };
            }
        }
        catch (err) {
            // If WebRTC negotiation fails, stop the captured tracks
            stream.getTracks().forEach((track) => track.stop());
            throw err;
        }
    }, []);
    const stopScreenShare = useCallback(async () => {
        const manager = managerRef.current;
        if (manager) {
            try {
                await manager.removeMediaStreamFromAll();
                manager.broadcastData(JSON.stringify({
                    type: 'DROPSPHERE_SCREEN_STOP',
                    presenterId: usePeerStore.getState().localDevice.id,
                }));
            }
            catch (err) {
                console.warn('Error removing media stream tracks:', err);
            }
        }
        useScreenShareStore.getState().stopAll();
    }, []);
    const requestScreenShare = useCallback(() => {
        const manager = managerRef.current;
        const localDev = usePeerStore.getState().localDevice;
        const activePresenter = useScreenShareStore.getState().activePresenter;
        if (!manager)
            return;
        console.log(`[useWebRTC] Sending presentation handoff request to room...`);
        useScreenShareStore.getState().setRequestStatus('requesting');
        manager.broadcastData(JSON.stringify({
            type: 'DROPSPHERE_SCREEN_REQUEST',
            requesterId: localDev.id,
            requesterName: localDev.name,
            targetPeerId: activePresenter?.peerId,
        }));
    }, []);
    const approveScreenShare = useCallback(async (requesterId) => {
        const manager = managerRef.current;
        if (!manager)
            return;
        console.log(`[useWebRTC] Approving presentation handoff for requester: ${requesterId}`);
        // Gracefully stop our own stream first
        await stopScreenShare();
        // Notify requester that they are approved
        manager.sendData(requesterId, JSON.stringify({
            type: 'DROPSPHERE_SCREEN_RESPONSE',
            approved: true,
        }));
        useScreenShareStore.getState().setPendingRequest(null);
    }, [stopScreenShare]);
    const declineScreenShare = useCallback((requesterId) => {
        const manager = managerRef.current;
        if (!manager)
            return;
        console.log(`[useWebRTC] Declining presentation handoff for requester: ${requesterId}`);
        manager.sendData(requesterId, JSON.stringify({
            type: 'DROPSPHERE_SCREEN_RESPONSE',
            approved: false,
        }));
        useScreenShareStore.getState().setPendingRequest(null);
    }, []);
    const hostReclaimStage = useCallback(async () => {
        const manager = managerRef.current;
        if (!manager)
            return;
        console.log(`[useWebRTC] Host reclaiming presentation stage...`);
        manager.broadcastData(JSON.stringify({
            type: 'DROPSPHERE_SCREEN_STOP',
            force: true,
        }));
        useScreenShareStore.getState().setRemoteStream(null);
        useScreenShareStore.getState().setActivePresenter(null);
    }, []);
    const syncScreenBroadcast = useCallback(() => {
        const manager = managerRef.current;
        if (!manager)
            return;
        const localDev = usePeerStore.getState().localDevice;
        const pollMsg = JSON.stringify({
            type: 'DROPSPHERE_SCREEN_POLL',
            requesterId: localDev.id,
            requesterName: localDev.name,
        });
        console.log('[useWebRTC] Broadcasting DROPSPHERE_SCREEN_POLL to room peers...');
        manager.broadcastData(pollMsg);
    }, []);
    return {
        connect,
        disconnect,
        sendData,
        sendFile,
        startScreenShare,
        stopScreenShare,
        requestScreenShare,
        approveScreenShare,
        declineScreenShare,
        hostReclaimStage,
        syncScreenBroadcast,
    };
}
