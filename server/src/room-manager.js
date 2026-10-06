import { WebSocket } from 'ws';
export class RoomManager {
    // peerId -> RoomPeer
    peers = new Map();
    // roomId -> Set of peerIds
    rooms = new Map();
    // ws -> peerId for quick reverse lookup on disconnect
    socketToPeer = new Map();
    // roomId -> hostPeerId
    roomHosts = new Map();
    getFallbackLanIp;
    constructor(getFallbackLanIp) {
        this.getFallbackLanIp = getFallbackLanIp;
    }
    /**
     * Normalize incoming IP to group local network peers together.
     * Standardizes IPv6 loopback, Docker, and LAN subnets.
     */
    normalizeIp(rawIp) {
        if (!rawIp)
            return '127.0.0.1';
        let ip = rawIp.replace(/^.*:/, ''); // strip IPv6 prefix if present
        if (ip === '1' || ip === 'localhost')
            ip = '127.0.0.1';
        return ip;
    }
    /**
     * Derive a default room ID based on client's IP subnet if none is explicitly provided.
     */
    getSubnetRoomId(ip) {
        let targetIp = ip;
        if (targetIp.startsWith('127.') && this.getFallbackLanIp) {
            const fallback = this.getFallbackLanIp();
            if (fallback && !fallback.startsWith('127.')) {
                targetIp = fallback;
            }
        }
        const parts = targetIp.split('.');
        if (parts.length === 4) {
            // Group by /24 subnet (e.g. 192.168.1.xxx)
            return `lan-${parts[0]}.${parts[1]}.${parts[2]}.0`;
        }
        return `cluster-${targetIp}`;
    }
    /**
     * Adds or updates a peer in a room.
     */
    joinRoom(ws, rawIp, deviceData, explicitRoomId, requestedRole) {
        const cleanIp = this.normalizeIp(rawIp);
        const roomId = (explicitRoomId && explicitRoomId.trim().length > 0)
            ? explicitRoomId.trim().toLowerCase()
            : this.getSubnetRoomId(cleanIp);
        // If socket already was in a room, leave first
        const existingPeerId = this.socketToPeer.get(ws);
        if (existingPeerId) {
            this.leaveRoom(existingPeerId);
        }
        // Determine host authority
        let currentHostId = this.roomHosts.get(roomId);
        let isHost = false;
        if (requestedRole === 'guest') {
            isHost = false;
            if (!currentHostId) {
                currentHostId = '';
            }
        }
        else if (!currentHostId || !this.peers.has(currentHostId)) {
            // First arriving peer is the Host
            isHost = true;
            currentHostId = deviceData.id;
            this.roomHosts.set(roomId, currentHostId);
        }
        else {
            isHost = (currentHostId === deviceData.id);
        }
        const effectiveIp = (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') && this.getFallbackLanIp
            ? this.getFallbackLanIp()
            : cleanIp;
        const peerDevice = {
            id: deviceData.id,
            name: deviceData.name,
            type: deviceData.type,
            os: deviceData.os,
            ip: effectiveIp,
            ping: 5,
            status: 'idle',
            lastSeen: Date.now(),
            isLocal: false,
            role: isHost ? 'host' : 'guest',
            isHost,
        };
        const roomPeer = {
            ws,
            device: peerDevice,
            roomId,
            ip: cleanIp,
            joinedAt: Date.now(),
        };
        // Store mappings
        this.peers.set(deviceData.id, roomPeer);
        this.socketToPeer.set(ws, deviceData.id);
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set());
        }
        this.rooms.get(roomId).add(deviceData.id);
        // Get all OTHER peers in this room
        const otherPeers = [];
        for (const id of this.rooms.get(roomId)) {
            if (id !== deviceData.id) {
                const other = this.peers.get(id);
                if (other) {
                    otherPeers.push(other.device);
                }
            }
        }
        return {
            roomId,
            roomPeers: otherPeers,
            peer: peerDevice,
            isHost,
            hostPeerId: currentHostId || (isHost ? deviceData.id : ''),
        };
    }
    /**
     * Removes peer by ID and cleans up empty rooms or migrates host.
     */
    leaveRoom(peerId) {
        const peer = this.peers.get(peerId);
        if (!peer)
            return {};
        const { roomId, ws, device } = peer;
        this.peers.delete(peerId);
        this.socketToPeer.delete(ws);
        let newHostPeerId = undefined;
        const roomSet = this.rooms.get(roomId);
        if (roomSet) {
            roomSet.delete(peerId);
            if (roomSet.size === 0) {
                this.rooms.delete(roomId);
                this.roomHosts.delete(roomId);
            }
            else if (this.roomHosts.get(roomId) === peerId) {
                // Host left! Promote next senior peer in room to Host
                const nextHostId = roomSet.values().next().value;
                if (nextHostId) {
                    const nextPeer = this.peers.get(nextHostId);
                    if (nextPeer) {
                        nextPeer.device.isHost = true;
                        nextPeer.device.role = 'host';
                        this.roomHosts.set(roomId, nextHostId);
                        newHostPeerId = nextHostId;
                    }
                }
            }
        }
        return { roomId, peer: device, newHostPeerId };
    }
    /**
     * Lookup peer by WebSocket instance.
     */
    getPeerBySocket(ws) {
        const peerId = this.socketToPeer.get(ws);
        return peerId ? this.peers.get(peerId) : undefined;
    }
    /**
     * Lookup peer by ID.
     */
    getPeer(peerId) {
        return this.peers.get(peerId);
    }
    /**
     * Retrieve all sockets in a room except the specified peer ID.
     */
    getOtherSocketsInRoom(roomId, excludePeerId) {
        const roomSet = this.rooms.get(roomId);
        if (!roomSet)
            return [];
        const sockets = [];
        for (const peerId of roomSet) {
            if (peerId !== excludePeerId) {
                const peer = this.peers.get(peerId);
                if (peer && peer.ws.readyState === WebSocket.OPEN) {
                    sockets.push(peer.ws);
                }
            }
        }
        return sockets;
    }
    /**
     * Statistics for monitoring & diagnostics.
     */
    getStats() {
        return {
            totalRooms: this.rooms.size,
            totalPeers: this.peers.size,
            rooms: Array.from(this.rooms.entries()).map(([roomId, peerIds]) => ({
                roomId,
                peerCount: peerIds.size,
            })),
        };
    }
}
