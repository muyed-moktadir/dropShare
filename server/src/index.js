import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import os from 'node:os';
import { RoomManager } from './room-manager.js';
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';
export function getLocalLanIp() {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                candidates.push(iface.address);
            }
        }
    }
    // Prefer 192.168.x.x (home/office WiFi), then 10.x.x.x, then anything else
    const preferred = candidates.find((ip) => ip.startsWith('192.168.'));
    if (preferred)
        return preferred;
    const alt = candidates.find((ip) => ip.startsWith('10.'));
    if (alt)
        return alt;
    return candidates[0] || '127.0.0.1';
}
const roomManager = new RoomManager(getLocalLanIp);
// Create HTTP server for health checks and status endpoint
const server = createServer((req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (req.url === '/lan-ip') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ lanIp: getLocalLanIp() }));
        return;
    }
    if (req.url === '/health' || req.url === '/status' || req.url === '/') {
        const stats = roomManager.getStats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            service: 'DropSphere Signaling Hub',
            status: 'online',
            version: '1.0.0',
            protocol: 'WebRTC P2P Direct',
            lanIp: getLocalLanIp(),
            uptime: Math.floor(process.uptime()),
            activeRooms: stats.totalRooms,
            activePeers: stats.totalPeers,
            rooms: stats.rooms,
            timestamp: new Date().toISOString(),
        }, null, 2));
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
});
// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });
/**
 * Send typed message to client safely
 */
function sendJson(ws, msg) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}
wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    // Extract client IP address
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    ws.on('message', (rawData) => {
        try {
            const msg = JSON.parse(rawData.toString());
            switch (msg.type) {
                case 'join': {
                    const { roomId, roomPeers, peer, isHost, hostPeerId } = roomManager.joinRoom(ws, clientIp, msg.device, msg.roomId, msg.role);
                    console.log(`\x1b[36m[SIGNALING]\x1b[0m Peer joined: \x1b[32m${peer.name}\x1b[0m (${peer.id}) in Room: \x1b[33m${roomId}\x1b[0m [Role: ${peer.role}, Host: ${isHost}]`);
                    // 1. Reply to joining peer with their confirmed room, role, and existing peers
                    sendJson(ws, {
                        type: 'joined',
                        peerId: peer.id,
                        roomId,
                        peers: roomPeers,
                        serverLanIp: getLocalLanIp(),
                        isHost,
                        role: peer.role || (isHost ? 'host' : 'guest'),
                        hostPeerId,
                    });
                    // 2. Notify other peers in this room that a new peer arrived
                    const otherSockets = roomManager.getOtherSocketsInRoom(roomId, peer.id);
                    for (const socket of otherSockets) {
                        sendJson(socket, {
                            type: 'peer-joined',
                            peer,
                        });
                    }
                    break;
                }
                case 'signal-offer': {
                    const sender = roomManager.getPeerBySocket(ws);
                    if (!sender) {
                        sendJson(ws, { type: 'error', message: 'Sender not registered in any room' });
                        return;
                    }
                    const target = roomManager.getPeer(msg.targetPeerId);
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        console.log(`\x1b[36m[SIGNALING]\x1b[0m Relay SDP Offer: \x1b[32m${sender.device.name}\x1b[0m -> \x1b[35m${target.device.name}\x1b[0m`);
                        sendJson(target.ws, {
                            type: 'signal-offer',
                            senderPeerId: sender.device.id,
                            offer: msg.offer,
                        });
                    }
                    else {
                        sendJson(ws, {
                            type: 'error',
                            message: `Target peer ${msg.targetPeerId} unavailable or disconnected`,
                        });
                    }
                    break;
                }
                case 'signal-answer': {
                    const sender = roomManager.getPeerBySocket(ws);
                    if (!sender) {
                        sendJson(ws, { type: 'error', message: 'Sender not registered in any room' });
                        return;
                    }
                    const target = roomManager.getPeer(msg.targetPeerId);
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        console.log(`\x1b[36m[SIGNALING]\x1b[0m Relay SDP Answer: \x1b[32m${sender.device.name}\x1b[0m -> \x1b[35m${target.device.name}\x1b[0m`);
                        sendJson(target.ws, {
                            type: 'signal-answer',
                            senderPeerId: sender.device.id,
                            answer: msg.answer,
                        });
                    }
                    else {
                        sendJson(ws, {
                            type: 'error',
                            message: `Target peer ${msg.targetPeerId} unavailable or disconnected`,
                        });
                    }
                    break;
                }
                case 'signal-ice': {
                    const sender = roomManager.getPeerBySocket(ws);
                    if (!sender)
                        return;
                    const target = roomManager.getPeer(msg.targetPeerId);
                    if (target && target.ws.readyState === WebSocket.OPEN) {
                        sendJson(target.ws, {
                            type: 'signal-ice',
                            senderPeerId: sender.device.id,
                            candidate: msg.candidate,
                        });
                    }
                    break;
                }
                case 'ping': {
                    sendJson(ws, {
                        type: 'pong',
                        timestamp: msg.timestamp,
                        serverTime: Date.now(),
                    });
                    break;
                }
                case 'leave': {
                    const sender = roomManager.getPeerBySocket(ws);
                    if (sender) {
                        const { roomId, peer, newHostPeerId } = roomManager.leaveRoom(sender.device.id);
                        if (roomId && peer) {
                            console.log(`\x1b[36m[SIGNALING]\x1b[0m Peer left: \x1b[31m${peer.name}\x1b[0m (${peer.id}) from Room: \x1b[33m${roomId}\x1b[0m`);
                            const otherSockets = roomManager.getOtherSocketsInRoom(roomId, peer.id);
                            for (const socket of otherSockets) {
                                sendJson(socket, {
                                    type: 'peer-left',
                                    peerId: peer.id,
                                });
                                if (newHostPeerId) {
                                    sendJson(socket, {
                                        type: 'host-changed',
                                        hostPeerId: newHostPeerId,
                                    });
                                }
                            }
                        }
                    }
                    break;
                }
                default:
                    console.warn('[SIGNALING] Unknown message received:', msg);
            }
        }
        catch (err) {
            console.error('[SIGNALING] Error parsing message:', err);
            sendJson(ws, { type: 'error', message: 'Invalid JSON payload' });
        }
    });
    ws.on('close', () => {
        const sender = roomManager.getPeerBySocket(ws);
        if (sender) {
            const { roomId, peer, newHostPeerId } = roomManager.leaveRoom(sender.device.id);
            if (roomId && peer) {
                console.log(`\x1b[36m[SIGNALING]\x1b[0m Socket disconnected: \x1b[31m${peer.name}\x1b[0m (${peer.id}) from Room: \x1b[33m${roomId}\x1b[0m`);
                const otherSockets = roomManager.getOtherSocketsInRoom(roomId, peer.id);
                for (const socket of otherSockets) {
                    sendJson(socket, {
                        type: 'peer-left',
                        peerId: peer.id,
                    });
                    if (newHostPeerId) {
                        sendJson(socket, {
                            type: 'host-changed',
                            hostPeerId: newHostPeerId,
                        });
                    }
                }
            }
        }
    });
    ws.on('error', (err) => {
        console.error('[SIGNALING] WebSocket connection error:', err);
    });
});
// Periodic heartbeat sweep every 30 seconds to terminate dead connections
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
        const extWs = client;
        if (extWs.isAlive === false) {
            extWs.terminate();
            return;
        }
        extWs.isAlive = false;
        extWs.ping();
    });
}, 30000);
wss.on('close', () => {
    clearInterval(heartbeatInterval);
});
// Start listening
server.listen(PORT, HOST, () => {
    console.log(`\n======================================================`);
    console.log(`📡 DropSphere WebRTC Signaling Hub`);
    console.log(`   Status:       \x1b[32mONLINE\x1b[0m`);
    console.log(`   WebSocket:    \x1b[36mws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}\x1b[0m`);
    console.log(`   Health API:   \x1b[36mhttp://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/health\x1b[0m`);
    console.log(`======================================================\n`);
});
// Handle graceful termination
process.on('SIGINT', () => {
    console.log('\n[SIGNALING] Shutting down signaling hub gracefully...');
    wss.close();
    server.close(() => {
        process.exit(0);
    });
});
process.on('SIGTERM', () => {
    wss.close();
    server.close(() => {
        process.exit(0);
    });
});
