export class SignalingClient {
    ws = null;
    url;
    status = 'disconnected';
    events = {};
    reconnectTimer = null;
    reconnectAttempts = 0;
    maxReconnectDelay = 10000;
    lastJoinPayload = null;
    isDestroyed = false;
    constructor(serverUrl) {
        if (serverUrl) {
            this.url = serverUrl;
        }
        else if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
            this.url = process.env.NEXT_PUBLIC_SIGNALING_URL;
        }
        else if (typeof window !== 'undefined') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // If opened via QR scan, the hostname in URL is already the LAN IP of the server
            // (QRPairingModal encodes the server LAN IP as the page hostname)
            const host = window.location.hostname || 'localhost';
            const port = process.env.NEXT_PUBLIC_SIGNALING_PORT || '4000';
            this.url = `${protocol}//${host}:${port}`;
        }
        else {
            this.url = 'ws://localhost:4000';
        }
    }
    setEvents(events) {
        this.events = { ...this.events, ...events };
    }
    getStatus() {
        return this.status;
    }
    setStatus(newStatus) {
        this.status = newStatus;
        this.events.onStatusChange?.(newStatus);
    }
    connect() {
        if (typeof window === 'undefined' || this.isDestroyed)
            return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }
        this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
        try {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => {
                this.reconnectAttempts = 0;
                this.setStatus('connected');
                // Re-join previous room if reconnecting
                if (this.lastJoinPayload) {
                    this.send({
                        type: 'join',
                        device: this.lastJoinPayload.device,
                        roomId: this.lastJoinPayload.roomId,
                        role: this.lastJoinPayload.role,
                    });
                }
            };
            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleMessage(msg);
                }
                catch (e) {
                    console.error('[DropSphere Signaling] Failed to parse message:', e);
                }
            };
            this.ws.onclose = () => {
                if (this.isDestroyed)
                    return;
                this.setStatus('disconnected');
                this.scheduleReconnect();
            };
            this.ws.onerror = (e) => {
                console.warn('[DropSphere Signaling] Socket error:', e);
                this.events.onError?.('Signaling server connection error');
            };
        }
        catch {
            this.setStatus('disconnected');
            this.scheduleReconnect();
        }
    }
    scheduleReconnect() {
        if (this.isDestroyed || this.reconnectTimer)
            return;
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }
    handleMessage(msg) {
        switch (msg.type) {
            case 'joined':
                this.events.onJoined?.(msg);
                break;
            case 'peer-joined':
                this.events.onPeerJoined?.(msg.peer);
                break;
            case 'peer-left':
                this.events.onPeerLeft?.(msg.peerId);
                break;
            case 'host-changed':
                this.events.onHostChanged?.(msg.hostPeerId);
                break;
            case 'signal-offer':
                this.events.onOffer?.(msg.senderPeerId, msg.offer);
                break;
            case 'signal-answer':
                this.events.onAnswer?.(msg.senderPeerId, msg.answer);
                break;
            case 'signal-ice':
                this.events.onIceCandidate?.(msg.senderPeerId, msg.candidate);
                break;
            case 'error':
                this.events.onError?.(msg.message);
                break;
        }
    }
    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }
    join(device, roomId, role) {
        this.lastJoinPayload = { device, roomId, role };
        this.send({
            type: 'join',
            device,
            roomId,
            role,
        });
    }
    sendOffer(targetPeerId, offer) {
        this.send({
            type: 'signal-offer',
            targetPeerId,
            offer,
        });
    }
    sendAnswer(targetPeerId, answer) {
        this.send({
            type: 'signal-answer',
            targetPeerId,
            answer,
        });
    }
    sendIceCandidate(targetPeerId, candidate) {
        this.send({
            type: 'signal-ice',
            targetPeerId,
            candidate,
        });
    }
    disconnect() {
        this.isDestroyed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.setStatus('disconnected');
    }
}
