import { usePeerStore } from '@/stores/usePeerStore';
export const RTC_ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
};
export class WebRTCManager {
    peers = new Map();
    dataChannels = new Map();
    mediaSenders = new Map();
    pendingCandidates = new Map();
    pingTimers = new Map();
    negotiationTimers = new Map();
    signaling;
    events;
    isPoliteFn = () => true;
    makingOffer = new Map();
    currentBroadcastStream = null;
    remoteMediaStreams = new Map();
    constructor(signaling, events = {}) {
        this.signaling = signaling;
        this.events = events;
    }
    setEvents(events) {
        this.events = { ...this.events, ...events };
    }
    setSignaling(signaling) {
        this.signaling = signaling;
    }
    setIsPolite(fn) {
        this.isPoliteFn = fn;
    }
    /**
     * Initiate a WebRTC connection to a remote peer (caller/offerer)
     */
    async connect(targetPeerId, force = false) {
        if (typeof window === 'undefined')
            return;
        const existingPc = this.peers.get(targetPeerId);
        const existingDc = this.dataChannels.get(targetPeerId);
        // If already connected with an open data channel, do nothing
        if (!force && existingDc && existingDc.readyState === 'open' && existingPc && (existingPc.connectionState === 'connected' || existingPc.iceConnectionState === 'connected')) {
            console.log(`[WebRTC] Peer ${targetPeerId} already connected with open DataChannel.`);
            return;
        }
        // If already connecting, negotiating, or active, avoid clobbering
        if (!force && existingPc && existingPc.signalingState !== 'closed' && existingPc.connectionState !== 'failed' && existingPc.connectionState !== 'closed') {
            console.log(`[WebRTC] Peer ${targetPeerId} connection already in progress (pc: ${existingPc.connectionState}, ice: ${existingPc.iceConnectionState}, signaling: ${existingPc.signalingState}).`);
            return;
        }
        this.cleanupPeer(targetPeerId);
        try {
            this.makingOffer.set(targetPeerId, true);
            const pc = this.createPeerConnection(targetPeerId);
            this.peers.set(targetPeerId, pc);
            // Create data channel as offerer
            const dc = pc.createDataChannel('dropsphere-data', {
                ordered: true,
            });
            this.setupDataChannel(targetPeerId, dc);
            // If a broadcast stream is currently active, attach tracks directly to initial offer
            if (this.currentBroadcastStream) {
                const senders = [];
                for (const track of this.currentBroadcastStream.getTracks()) {
                    try {
                        const sender = pc.addTrack(track, this.currentBroadcastStream);
                        senders.push(sender);
                    }
                    catch { }
                }
                if (senders.length > 0) {
                    this.mediaSenders.set(targetPeerId, senders);
                }
            }
            this.events.onConnectionStateChange?.(targetPeerId, 'connecting');
            this.startNegotiationTimeout(targetPeerId);
            // Create and set local SDP offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log(`[WebRTC] Sending offer to peer ${targetPeerId}`);
            this.signaling.sendOffer(targetPeerId, {
                type: offer.type,
                sdp: offer.sdp,
            });
        }
        catch (err) {
            console.error(`[WebRTC] Error initiating connection to ${targetPeerId}:`, err);
            this.events.onConnectionStateChange?.(targetPeerId, 'failed');
            this.events.onError?.(targetPeerId, err);
            this.cleanupPeer(targetPeerId);
        }
        finally {
            this.makingOffer.set(targetPeerId, false);
        }
    }
    getCurrentBroadcastStream() {
        return this.currentBroadcastStream;
    }
    hasMediaStream(peerId) {
        const pc = this.peers.get(peerId);
        if (!pc)
            return false;
        const senders = pc.getSenders();
        return senders.some((s) => s.track && s.track.kind === 'video' && s.track.readyState === 'live');
    }
    /**
     * Handle incoming SDP offer from a remote peer (callee/answerer)
     * Implements W3C WebRTC Perfect Negotiation glare resolution.
     */
    async handleOffer(senderPeerId, offer) {
        if (typeof window === 'undefined')
            return;
        let pc = this.peers.get(senderPeerId);
        const isPolite = this.isPoliteFn(senderPeerId);
        const isMakingOffer = Boolean(this.makingOffer.get(senderPeerId));
        // Detect offer collision (glare: both sides sent an offer simultaneously)
        const isCollision = Boolean(pc && (isMakingOffer || pc.signalingState !== 'stable'));
        if (isCollision && !isPolite) {
            console.log(`[WebRTC] Glare collision: Impolite peer ignoring incoming offer from ${senderPeerId}`);
            return;
        }
        if (!pc || pc.signalingState === 'closed') {
            this.cleanupPeer(senderPeerId);
            pc = this.createPeerConnection(senderPeerId);
            this.peers.set(senderPeerId, pc);
            // Listen for data channel created by offerer
            pc.ondatachannel = (event) => {
                console.log(`[WebRTC] Data channel received from ${senderPeerId}: ${event.channel.label}`);
                this.setupDataChannel(senderPeerId, event.channel);
            };
        }
        try {
            this.events.onConnectionStateChange?.(senderPeerId, 'connecting');
            this.startNegotiationTimeout(senderPeerId);
            if (isCollision) {
                // Polite peer rolls back its own local offer first, THEN accepts incoming remote offer
                console.log(`[WebRTC] Glare collision: Polite peer rolling back local offer for ${senderPeerId}`);
                await pc.setLocalDescription({ type: 'rollback' });
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
            }
            else {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
            }
            // Flush any ICE candidates that arrived before or during the offer
            await this.flushPendingCandidates(senderPeerId, pc);
            // Create and set local SDP answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            // Successfully answered: clear negotiation timeout and ensure connected state
            this.clearNegotiationTimeout(senderPeerId);
            if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') {
                this.events.onConnectionStateChange?.(senderPeerId, 'connected');
            }
            console.log(`[WebRTC] Sending answer to peer ${senderPeerId}`);
            this.signaling.sendAnswer(senderPeerId, {
                type: answer.type,
                sdp: answer.sdp,
            });
        }
        catch (err) {
            console.error(`[WebRTC] Error handling offer from ${senderPeerId}:`, err);
            this.events.onError?.(senderPeerId, err);
        }
    }
    /**
     * Handle incoming SDP answer from the remote peer
     */
    async handleAnswer(senderPeerId, answer) {
        const pc = this.peers.get(senderPeerId);
        if (!pc) {
            console.warn(`[WebRTC] No peer connection found for answer from ${senderPeerId}`);
            return;
        }
        if (pc.signalingState !== 'have-local-offer') {
            console.warn(`[WebRTC] Ignoring answer in invalid signalingState: ${pc.signalingState} from ${senderPeerId}`);
            return;
        }
        try {
            console.log(`[WebRTC] Setting remote description from answer from ${senderPeerId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            await this.flushPendingCandidates(senderPeerId, pc);
            // Successfully processed answer: clear negotiation timeout and ensure connected state
            this.clearNegotiationTimeout(senderPeerId);
            if (pc.connectionState === 'connected' || pc.iceConnectionState === 'connected') {
                this.events.onConnectionStateChange?.(senderPeerId, 'connected');
            }
        }
        catch (err) {
            console.error(`[WebRTC] Error setting remote description for answer from ${senderPeerId}:`, err);
            this.events.onConnectionStateChange?.(senderPeerId, 'failed');
            this.events.onError?.(senderPeerId, err);
        }
    }
    /**
     * Handle incoming ICE candidate from the remote peer
     */
    async handleCandidate(senderPeerId, candidateInit) {
        if (!candidateInit || !candidateInit.candidate) {
            return;
        }
        const pc = this.peers.get(senderPeerId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
                console.log(`[WebRTC] Applying ICE candidate from ${senderPeerId}: ${candidateInit.candidate.substring(0, 40)}...`);
                await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            }
            catch (err) {
                console.warn(`[WebRTC] Error adding ICE candidate from ${senderPeerId}:`, err);
            }
        }
        else {
            // Queue candidate until remote description is set
            const queue = this.pendingCandidates.get(senderPeerId) || [];
            queue.push(candidateInit);
            this.pendingCandidates.set(senderPeerId, queue);
        }
        // If candidate has mDNS .local hostname, also inject direct LAN IP candidate
        if (candidateInit.candidate.includes('.local')) {
            const peers = usePeerStore.getState().peers;
            const targetPeer = peers.find((p) => p.id === senderPeerId);
            const lanIp = targetPeer?.ip || usePeerStore.getState().serverLanIp;
            if (lanIp && /^\d+\.\d+\.\d+\.\d+$/.test(lanIp) && lanIp !== '127.0.0.1') {
                const unmaskedStr = candidateInit.candidate.replace(/[a-zA-Z0-9-]+\.local/g, lanIp);
                if (unmaskedStr !== candidateInit.candidate) {
                    const unmaskedCandidate = {
                        ...candidateInit,
                        candidate: unmaskedStr,
                    };
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                        pc.addIceCandidate(new RTCIceCandidate(unmaskedCandidate)).catch(() => { });
                    }
                    else {
                        const queue = this.pendingCandidates.get(senderPeerId) || [];
                        queue.push(unmaskedCandidate);
                        this.pendingCandidates.set(senderPeerId, queue);
                    }
                }
            }
        }
    }
    /**
     * Send data over the established data channel to a peer
     */
    sendData(peerId, data) {
        const dc = this.dataChannels.get(peerId);
        if (!dc || dc.readyState !== 'open') {
            console.warn(`[WebRTC] Cannot send data: DataChannel for peer ${peerId} is not open`);
            return false;
        }
        try {
            if (typeof data === 'string') {
                dc.send(data);
            }
            else if (data instanceof ArrayBuffer) {
                dc.send(data);
            }
            else if (data instanceof Blob) {
                data.arrayBuffer().then((buf) => dc.send(buf));
            }
            return true;
        }
        catch (err) {
            console.error(`[WebRTC] Send data error to ${peerId}:`, err);
            return false;
        }
    }
    /**
     * Broadcast data string or buffer to ALL open DataChannels
     */
    broadcastData(data) {
        for (const peerId of Array.from(this.dataChannels.keys())) {
            this.sendData(peerId, data);
        }
    }
    /**
     * Disconnect a peer and clean up resources
     */
    disconnect(peerId) {
        this.cleanupPeer(peerId);
        this.events.onConnectionStateChange?.(peerId, 'idle');
    }
    /**
     * Destroy manager and clean up all connections
     */
    destroy() {
        for (const peerId of Array.from(this.peers.keys())) {
            this.cleanupPeer(peerId);
        }
        this.peers.clear();
        this.dataChannels.clear();
        this.pendingCandidates.clear();
        this.pingTimers.clear();
        this.makingOffer.clear();
    }
    getDataChannel(peerId) {
        return this.dataChannels.get(peerId);
    }
    getPeerConnection(peerId) {
        return this.peers.get(peerId);
    }
    getConnectedPeerIds() {
        const ids = new Set();
        for (const [id, dc] of this.dataChannels.entries()) {
            if (dc.readyState === 'open')
                ids.add(id);
        }
        for (const [id, pc] of this.peers.entries()) {
            if (pc.connectionState === 'connected' ||
                pc.iceConnectionState === 'connected' ||
                pc.iceConnectionState === 'completed' ||
                pc.signalingState !== 'closed') {
                ids.add(id);
            }
        }
        return Array.from(ids);
    }
    getAllDataChannels() {
        return new Map(this.dataChannels);
    }
    getRemoteStream(peerId) {
        return this.remoteMediaStreams.get(peerId);
    }
    /**
     * Add a MediaStream (e.g. screen share) to the peer connection and renegotiate
     */
    async addMediaStream(peerId, stream) {
        this.currentBroadcastStream = stream;
        let pc = this.peers.get(peerId);
        if (!pc || pc.signalingState === 'closed') {
            console.log(`[WebRTC] Creating peer connection with ${peerId} for media streaming...`);
            pc = this.createPeerConnection(peerId);
            this.peers.set(peerId, pc);
        }
        if (!this.dataChannels.has(peerId)) {
            try {
                const dc = pc.createDataChannel('dropsphere-data', { ordered: true });
                this.setupDataChannel(peerId, dc);
            }
            catch (err) {
                console.warn(`[WebRTC] Could not create fallback DataChannel on media stream pc:`, err);
            }
        }
        // Add or replace tracks cleanly
        const senders = [];
        const currentSenders = pc.getSenders();
        for (const track of stream.getTracks()) {
            const match = currentSenders.find((s) => s.track && s.track.kind === track.kind);
            if (match) {
                try {
                    await match.replaceTrack(track);
                    senders.push(match);
                }
                catch {
                    try {
                        const sender = pc.addTrack(track, stream);
                        senders.push(sender);
                    }
                    catch { }
                }
            }
            else {
                try {
                    const sender = pc.addTrack(track, stream);
                    senders.push(sender);
                }
                catch { }
            }
        }
        this.mediaSenders.set(peerId, senders);
        // If signalingState is not stable (e.g. prior negotiation in flight), wait briefly for stable
        if (pc.signalingState !== 'stable') {
            console.log(`[WebRTC] Awaiting stable signalingState before adding media tracks (currently ${pc.signalingState})`);
            await new Promise((resolve) => {
                let attempts = 0;
                const check = () => {
                    attempts++;
                    if (!pc || pc.signalingState === 'stable' || pc.signalingState === 'closed' || attempts > 20) {
                        resolve();
                    }
                    else {
                        setTimeout(check, 50);
                    }
                };
                setTimeout(check, 50);
            });
        }
        if (!pc || pc.signalingState === 'closed') {
            return;
        }
        this.makingOffer.set(peerId, true);
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            console.log(`[WebRTC] Sending media offer with tracks to ${peerId}`);
            this.signaling.sendOffer(peerId, {
                type: offer.type,
                sdp: offer.sdp,
            });
        }
        catch (err) {
            console.warn(`[WebRTC] Error creating or setting media offer for ${peerId}:`, err);
        }
        finally {
            this.makingOffer.set(peerId, false);
        }
    }
    /**
     * Remove MediaStream tracks and renegotiate
     */
    async removeMediaStream(peerId) {
        const pc = this.peers.get(peerId);
        const senders = this.mediaSenders.get(peerId) || [];
        if (pc) {
            for (const sender of senders) {
                try {
                    pc.removeTrack(sender);
                }
                catch (err) {
                    console.warn(`[WebRTC] Error removing track from ${peerId}:`, err);
                }
            }
        }
        this.mediaSenders.delete(peerId);
        // Notify receiver over DataChannel so viewer resets immediately
        this.sendData(peerId, JSON.stringify({ type: 'dropsphere-screen-stop' }));
        // Renegotiate if pc is still alive
        if (pc && pc.signalingState !== 'closed') {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                this.signaling.sendOffer(peerId, {
                    type: offer.type,
                    sdp: offer.sdp,
                });
            }
            catch (err) {
                console.warn(`[WebRTC] Error renegotiating after track removal:`, err);
            }
        }
    }
    /**
     * Broadcast a MediaStream (e.g. screen share) to ALL currently connected peers
     */
    async broadcastMediaStream(stream) {
        this.currentBroadcastStream = stream;
        const storePeerIds = usePeerStore.getState().peers.map((p) => p.id);
        const peerIds = Array.from(new Set([
            ...this.getConnectedPeerIds(),
            ...Array.from(this.peers.keys()),
            ...storePeerIds,
        ]));
        console.log(`[WebRTC] Broadcasting screen media stream to ${peerIds.length} peers:`, peerIds);
        for (const peerId of peerIds) {
            try {
                await this.addMediaStream(peerId, stream);
            }
            catch (err) {
                console.warn(`[WebRTC] Failed to attach media stream to peer ${peerId}:`, err);
            }
        }
    }
    /**
     * Remove MediaStream tracks and renegotiate with ALL peers
     */
    async removeMediaStreamFromAll() {
        this.currentBroadcastStream = null;
        const activePeers = Array.from(this.mediaSenders.keys());
        console.log(`[WebRTC] Removing screen media stream from ${activePeers.length} peers`);
        for (const peerId of activePeers) {
            try {
                await this.removeMediaStream(peerId);
            }
            catch (err) {
                console.warn(`[WebRTC] Failed to remove media stream from peer ${peerId}:`, err);
            }
        }
    }
    // --- Private Helpers ---
    createPeerConnection(peerId) {
        const pc = new RTCPeerConnection(RTC_ICE_SERVERS);
        // CRITICAL: Always listen for remote DataChannel creation
        pc.ondatachannel = (event) => {
            console.log(`[WebRTC] DataChannel '${event.channel.label}' received from peer ${peerId}`);
            this.setupDataChannel(peerId, event.channel);
        };
        // Handle remote media tracks (e.g. incoming screen share)
        pc.ontrack = (event) => {
            console.log(`[WebRTC] Remote track received from ${peerId}: kind=${event.track.kind}, id=${event.track.id}, readyState=${event.track.readyState}`);
            let stream = event.streams[0];
            if (!stream) {
                stream = this.remoteMediaStreams.get(peerId) || new MediaStream();
                if (!stream.getTracks().includes(event.track)) {
                    stream.addTrack(event.track);
                }
                this.remoteMediaStreams.set(peerId, stream);
            }
            else {
                this.remoteMediaStreams.set(peerId, stream);
            }
            try {
                this.events.onTrack?.(peerId, stream, event.track);
            }
            catch (err) {
                console.warn(`[WebRTC] Error triggering onTrack callback for ${peerId}:`, err);
            }
        };
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.sendIceCandidate(peerId, event.candidate.toJSON());
                // Also broadcast unmasked candidate if local LAN IP is known
                const lanIp = usePeerStore.getState().serverLanIp || usePeerStore.getState().localDevice.ip;
                if (lanIp && /^\d+\.\d+\.\d+\.\d+$/.test(lanIp) && lanIp !== '127.0.0.1') {
                    if (event.candidate.candidate.includes('.local')) {
                        const unmasked = event.candidate.candidate.replace(/[a-zA-Z0-9-]+\.local/g, lanIp);
                        this.signaling.sendIceCandidate(peerId, {
                            ...event.candidate.toJSON(),
                            candidate: unmasked,
                        });
                    }
                }
            }
        };
        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC] ICE state with ${peerId}: ${pc.iceConnectionState}`);
            this.events.onIceStateChange?.(peerId, pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                console.warn(`[WebRTC] ICE connection failed with ${peerId}, attempting ICE restart...`);
                this.events.onConnectionStateChange?.(peerId, 'failed');
                if (pc.signalingState === 'stable') {
                    try {
                        pc.restartIce();
                    }
                    catch { }
                }
            }
        };
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${peerId}: ${pc.connectionState}`);
            switch (pc.connectionState) {
                case 'connected':
                    this.clearNegotiationTimeout(peerId);
                    this.events.onConnectionStateChange?.(peerId, 'connected');
                    if (this.currentBroadcastStream) {
                        console.log(`[WebRTC] Attaching ongoing screen stream to newly connected peer ${peerId}`);
                        this.addMediaStream(peerId, this.currentBroadcastStream).catch((err) => {
                            console.warn(`[WebRTC] Could not auto-attach screen stream to new peer ${peerId}:`, err);
                        });
                    }
                    break;
                case 'connecting':
                    this.events.onConnectionStateChange?.(peerId, 'connecting');
                    break;
                case 'failed':
                    console.warn(`[WebRTC] Connection state failed with ${peerId}, attempting ICE recovery...`);
                    this.events.onConnectionStateChange?.(peerId, 'failed');
                    if (pc.signalingState === 'stable') {
                        try {
                            pc.restartIce();
                        }
                        catch { }
                    }
                    break;
                case 'closed':
                    this.events.onConnectionStateChange?.(peerId, 'idle');
                    this.cleanupPeer(peerId);
                    break;
                case 'disconnected':
                    console.warn(`[WebRTC] Connection state temporarily disconnected with ${peerId}, awaiting recovery...`);
                    break;
            }
        };
        return pc;
    }
    setupDataChannel(peerId, dc) {
        dc.binaryType = 'arraybuffer';
        dc.bufferedAmountLowThreshold = 1024 * 1024; // 1 MB backpressure threshold
        // Save reference immediately so getDataChannel finds it right away
        this.dataChannels.set(peerId, dc);
        const onOpenHandler = () => {
            console.log(`[WebRTC] DataChannel '${dc.label}' successfully OPENED with peer ${peerId}`);
            this.clearNegotiationTimeout(peerId);
            this.dataChannels.set(peerId, dc);
            this.events.onDataChannelOpen?.(peerId);
            this.events.onConnectionStateChange?.(peerId, 'connected');
            // Start periodic ping/pong for RTT latency measurement
            this.startPingPong(peerId, dc);
        };
        if (dc.readyState === 'open') {
            onOpenHandler();
        }
        else {
            dc.onopen = onOpenHandler;
        }
        dc.onclose = () => {
            console.log(`[WebRTC] DataChannel closed with peer ${peerId}`);
            this.stopPingPong(peerId);
            this.dataChannels.delete(peerId);
            this.events.onDataChannelClose?.(peerId);
        };
        dc.onerror = (event) => {
            console.error(`[WebRTC] DataChannel error with ${peerId}:`, event);
            this.events.onError?.(peerId, new Error('DataChannel error'));
        };
        dc.onmessage = (event) => {
            const data = event.data;
            // Handle ping/pong protocol messages
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'dropsphere-ping') {
                        // Reply with pong immediately
                        dc.send(JSON.stringify({ type: 'dropsphere-pong', timestamp: parsed.timestamp }));
                        return;
                    }
                    if (parsed.type === 'dropsphere-pong') {
                        // Calculate round-trip time (RTT)
                        const rtt = Math.max(1, Date.now() - parsed.timestamp);
                        this.events.onPingLatency?.(peerId, rtt);
                        return;
                    }
                }
                catch {
                    // Not a JSON heartbeat message, pass to application handlers
                }
            }
            this.events.onDataChannelMessage?.(peerId, data);
        };
    }
    startPingPong(peerId, dc) {
        this.stopPingPong(peerId);
        // Initial ping immediately
        try {
            if (dc.readyState === 'open') {
                dc.send(JSON.stringify({ type: 'dropsphere-ping', timestamp: Date.now() }));
            }
        }
        catch { }
        // Recurring ping every 2.5 seconds
        const timer = setInterval(() => {
            if (dc.readyState === 'open') {
                try {
                    dc.send(JSON.stringify({ type: 'dropsphere-ping', timestamp: Date.now() }));
                }
                catch (err) {
                    console.warn(`[WebRTC] Failed to send ping to ${peerId}:`, err);
                }
            }
            else {
                this.stopPingPong(peerId);
            }
        }, 2500);
        this.pingTimers.set(peerId, timer);
    }
    stopPingPong(peerId) {
        const timer = this.pingTimers.get(peerId);
        if (timer) {
            clearInterval(timer);
            this.pingTimers.delete(peerId);
        }
    }
    startNegotiationTimeout(peerId) {
        this.clearNegotiationTimeout(peerId);
        const timer = setTimeout(() => {
            const dc = this.dataChannels.get(peerId);
            if (!dc || dc.readyState !== 'open') {
                console.warn(`[WebRTC] Connection negotiation timed out (15s) with peer ${peerId}`);
                this.events.onConnectionStateChange?.(peerId, 'failed');
                this.cleanupPeer(peerId);
            }
        }, 15000);
        this.negotiationTimers.set(peerId, timer);
    }
    clearNegotiationTimeout(peerId) {
        const timer = this.negotiationTimers.get(peerId);
        if (timer) {
            clearTimeout(timer);
            this.negotiationTimers.delete(peerId);
        }
    }
    async flushPendingCandidates(peerId, pc) {
        const candidates = this.pendingCandidates.get(peerId) || [];
        this.pendingCandidates.delete(peerId);
        for (const candidate of candidates) {
            if (!candidate || !candidate.candidate)
                continue;
            try {
                console.log(`[WebRTC] Flushing queued candidate for ${peerId}`);
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            }
            catch (err) {
                console.warn(`[WebRTC] Failed to flush queued candidate for ${peerId}:`, err);
            }
        }
    }
    cleanupPeer(peerId) {
        this.clearNegotiationTimeout(peerId);
        this.stopPingPong(peerId);
        this.makingOffer.delete(peerId);
        const dc = this.dataChannels.get(peerId);
        if (dc) {
            try {
                dc.close();
            }
            catch { }
            this.dataChannels.delete(peerId);
        }
        const pc = this.peers.get(peerId);
        if (pc) {
            try {
                pc.close();
            }
            catch { }
            this.peers.delete(peerId);
        }
        this.pendingCandidates.delete(peerId);
        this.mediaSenders.delete(peerId);
    }
}
