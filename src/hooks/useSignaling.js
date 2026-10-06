'use client';
import { useEffect, useRef } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { SignalingClient } from '@/lib/signaling/SignalingClient';
// Detect client device characteristics from browser environment
function detectDeviceInfo() {
    if (typeof window === 'undefined') {
        return { type: 'desktop', os: 'windows', defaultName: 'DropSphere Node' };
    }
    const ua = navigator.userAgent.toLowerCase();
    let os = 'unknown';
    let type = 'desktop';
    if (/iphone/.test(ua)) {
        os = 'ios';
        type = 'mobile';
    }
    else if (/ipad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        os = 'ios';
        type = 'tablet';
    }
    else if (/android/.test(ua)) {
        os = 'android';
        type = /tablet|sm-t/.test(ua) ? 'tablet' : 'mobile';
    }
    else if (/macintosh|mac os x/.test(ua)) {
        os = 'macos';
        type = 'laptop';
    }
    else if (/windows/.test(ua)) {
        os = 'windows';
        type = 'desktop';
    }
    else if (/linux/.test(ua)) {
        os = 'linux';
        type = 'desktop';
    }
    const osLabel = os === 'macos' ? 'Mac' : os === 'windows' ? 'Windows PC' : os === 'ios' ? 'iPhone' : os === 'android' ? 'Android' : 'Linux';
    const defaultName = `My ${osLabel}`;
    return { type, os, defaultName };
}
// Generate or retrieve persistent session ID
function getSessionDeviceId() {
    if (typeof window === 'undefined')
        return 'node-' + Math.random().toString(36).slice(2, 8);
    let stored = sessionStorage.getItem('dropsphere_node_id');
    if (!stored) {
        stored = 'node-' + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem('dropsphere_node_id', stored);
    }
    return stored;
}
// Global client reference
let globalClient = null;
export function getSignalingClient() {
    if (!globalClient && typeof window !== 'undefined') {
        globalClient = new SignalingClient();
    }
    return globalClient;
}
export function useSignaling() {
    const { localDevice, signalingStatus, roomId, setLocalDevice, setSignalingStatus, setRoomId, setServerLanIp, setPeers, addPeer, removePeer, setIsHost, setRole, setHostPeerId, } = usePeerStore();
    const clientRef = useRef(null);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        // Detect device characteristics and initialize local device
        const detected = detectDeviceInfo();
        const sessionId = getSessionDeviceId();
        // Fetch dynamic LAN IP from signaling server
        const host = window.location.hostname || 'localhost';
        fetch(`http://${host}:4000/lan-ip`)
            .then((r) => r.json())
            .then((data) => {
            if (data.lanIp && data.lanIp !== '127.0.0.1') {
                setServerLanIp(data.lanIp);
            }
        })
            .catch(() => { });
        setLocalDevice({
            id: sessionId,
            name: localDevice.name === 'My Workspace' ? detected.defaultName : localDevice.name,
            type: detected.type,
            os: detected.os,
        });
        if (!globalClient) {
            globalClient = new SignalingClient();
        }
        const client = globalClient;
        clientRef.current = client;
        client.setEvents({
            onStatusChange: (status) => {
                setSignalingStatus(status);
            },
            onJoined: ({ roomId: assignedRoom, peers, serverLanIp, isHost, role, hostPeerId }) => {
                setRoomId(assignedRoom);
                if (isHost !== undefined) {
                    setIsHost(Boolean(isHost), hostPeerId);
                }
                if (role) {
                    setRole(role);
                }
                if (hostPeerId) {
                    setHostPeerId(hostPeerId);
                }
                if (serverLanIp && serverLanIp !== '127.0.0.1') {
                    setServerLanIp(serverLanIp);
                }
                if (peers && peers.length > 0) {
                    setPeers(peers);
                }
            },
            onPeerJoined: (peer) => {
                addPeer(peer);
            },
            onPeerLeft: (peerId) => {
                removePeer(peerId);
            },
            onHostChanged: (newHostId) => {
                setHostPeerId(newHostId);
                if (newHostId === sessionId) {
                    setIsHost(true, newHostId);
                }
                else {
                    setIsHost(false, newHostId);
                }
            },
            onError: (err) => {
                console.warn('[useSignaling] Signaling error:', err);
            },
        });
        // Extract explicit room code & role from URL hash BEFORE connecting
        // Supports #join=vault-1234 or #room=vault-1234&role=guest
        let urlRoom = undefined;
        let requestedRole = undefined;
        if (typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash;
            const joinMatch = hash.match(/join=([^&]+)/i);
            const roomMatch = hash.match(/room=([^&]+)/i);
            const roleMatch = hash.match(/role=([^&]+)/i);
            if (joinMatch && joinMatch[1]) {
                urlRoom = decodeURIComponent(joinMatch[1]);
                requestedRole = 'guest'; // Anyone clicking a #join= link is definitively a guest!
            }
            else if (roomMatch && roomMatch[1]) {
                urlRoom = decodeURIComponent(roomMatch[1]);
            }
            if (roleMatch && roleMatch[1]) {
                const r = roleMatch[1].toLowerCase();
                if (r === 'guest' || r === 'host') {
                    requestedRole = r;
                }
            }
        }
        if (requestedRole) {
            setRole(requestedRole);
            setIsHost(requestedRole === 'host');
        }
        // Pre-set join payload BEFORE connect() so onopen auto-sends join in the correct room and role
        client.join({
            id: sessionId,
            name: localDevice.name === 'My Workspace' ? detected.defaultName : localDevice.name,
            type: detected.type,
            os: detected.os,
        }, urlRoom, requestedRole);
        // Connect to signaling server (will auto-join using lastJoinPayload on socket open)
        client.connect();
        return () => {
            // Don't kill global client on hot-reload, but leave room if unmounted
        };
    }, []);
    const getClient = () => clientRef.current;
    return {
        getClient,
        signalingStatus,
        roomId,
    };
}
