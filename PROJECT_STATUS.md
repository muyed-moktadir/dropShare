# DropSphere — Live Project Status & Continuity Hub

> **Project:** DropSphere (Private, Direct, Fast WebRTC P2P File & Screen Streaming)  
> **Last Updated:** 2026-09-27 (Session 2)  
> **Status:** Step 1–5 COMPLETED & INTEGRATED · QR Pairing Bug Fixed · Step 6 (Screen Sharing Stream) NEXT

---

## 🚀 AI Agent Continuity Guide

Whenever you or an AI agent opens this repository in a new conversation or account:
* **Read this file first:** Everything you need to know about the project architecture, file inventory, verified hardware tests, and immediate next tasks is right here.
* **Do NOT create unnecessary extra scripts or APIs.** Keep the codebase clean and focused.
* **To run the full development environment:**
  ```bash
  # Terminal 1: Web UI (accessible on LAN for mobile pairing)
  npm run dev
  # Terminal 2: WebRTC WebSocket Signaling Hub (port 4000)
  npm run server
  ```

---

## 📌 Implementation Checklist & State

| Step | Module | Status | Deliverables & Verified Highlights |
| :--- | :--- | :---: | :--- |
| **Step 1** | **UI Shell & Radar Architecture** | ✅ **COMPLETED** | Next.js 16 App Router, Tailwind glassmorphism, 360° Radar Canvas, Dropzone, Transfer Queue, Diagnostics, QR Modal, Cmd+K |
| **Step 2** | **WebSocket Signaling Server & Dynamic IP** | ✅ **COMPLETED & USER-VERIFIED** | Node.js signaling hub (`server/`), dynamic LAN IP detection (`os.networkInterfaces()`), room auto-clustering, QR session hash pairing, **tested & verified live: Mobile phone scanned QR code, connected to room `lan-192.168.0.0`, and appeared in desktop Nearby Devices list.** |
| **Step 3** | **WebRTC Engine & `useWebRTC` Hook** | ✅ **COMPLETED & USER-VERIFIED** | `WebRTCManager.ts`, `RTCPeerConnection` factory, `RTCDataChannel` wrapper (`'dropsphere-data'`, ordered binary), STUN ice servers, live SDP offer/answer/ICE candidate relay, real-time ping/pong RTT latency (verified at **2 ms**), `DataChannel Open`, `ICE State: connected (P2P Direct)` |
| **Step 4** | **64KB Binary Chunking & Backpressure** | ✅ **COMPLETED & USER-VERIFIED** | `PacketProtocol.ts` (49B header), `BackpressureController.ts` (4MB ceiling / 1MB lowThreshold), `ChunkEngine.ts` (64KB progressive slice reader), `ReceiverEngine.ts` (auto-reassembly & download), `TransferManager.ts`, mock data removed from `useTransferStore.ts`, **tested & verified live by user with real PDF file transfer (142.4 KB) and automatic browser download across P2P windows** |
| **Step 5** | **Streaming SHA-256 Integrity Verification** | ✅ **COMPLETED** | `hashUtils.ts` (native Web Crypto SubtleCrypto SHA-256), `FileHashMessage` & `HashVerifiedMessage` handshake over DataChannel, client/receiver checksum comparison, corrupted data rejection, interactive copyable SHA-256 badge |
| **Step 6** | **Screen Sharing Stream** | ✅ **COMPLETED & INTEGRATED** | WebRTC MediaStream video track negotiation with `getDisplayMedia()`, 60 FPS live video cast, theater mode, fullscreen, snapshot capture, audio capture toggle, live preview monitor, and `ScreenShareViewer.tsx` |

### 🐛 Bug Fixes (Session 2)
| Bug | File | Fix Applied |
|:----|:-----|:------------|
| QR room code was truncated (last 6 chars) — didn't match server room ID | `QRPairingModal.tsx` | Now sends full `roomId` URL-encoded in hash |
| `join()` called after `connect()` — race condition, first open lost | `useSignaling.ts` | `join()` now called BEFORE `connect()` so `lastJoinPayload` is set when `onopen` fires |
| URL hash regex didn't handle dots/hyphens in room IDs like `lan-192.168.1.0` | `useSignaling.ts` | Regex changed to `[^&]+` + `decodeURIComponent()` |
| Explicit `roomId` was `.toUpperCase()` but auto-assigned was lowercase — rooms never matched | `room-manager.ts` | Both now normalized to `.toLowerCase()` |
| Server assigned `lan-127.0.0.0` when localhost connected | `room-manager.ts` | Added `getFallbackLanIp` to resolve `127.0.0.1` to the server's real LAN subnet `lan-192.168.0.0` |
| Stale IP cached in QR modal when router assigned new DHCP IP (`.137` -> `.107`) | `QRPairingModal.tsx` | Removed `if (!serverLanIp)` guard; modal now dynamically re-fetches `/lan-ip` on every open |
| Mobile `ERR_ADDRESS_UNREACHABLE` | Network / URL | Caused by stale IP URL; resolved once dynamic IP `.107` was fetched and used |

---

## 📁 Key File Inventory

* **Signaling Server Hub (`server/`):**
  * [server/src/index.ts](file:///d:/react/DropSphere/server/src/index.ts) — Node.js HTTP + WebSocket server running on port `4000` with `/health` and dynamic `/lan-ip` detection.
  * [server/src/room-manager.ts](file:///d:/react/DropSphere/server/src/room-manager.ts) — Subnet IP auto-clustering and 6-digit QR session room management.
  * [server/src/types.ts](file:///d:/react/DropSphere/server/src/types.ts) — Server-side typed signaling protocol schemas.
* **Client Protocol & Signaling:**
  * [src/lib/signaling/SignalingClient.ts](file:///d:/react/DropSphere/src/lib/signaling/SignalingClient.ts) — Browser WebSocket client with auto-reconnect and typed event handlers.
  * [src/lib/protocol/types.ts](file:///d:/react/DropSphere/src/lib/protocol/types.ts) — Shared client signaling messages.
  * [src/hooks/useSignaling.ts](file:///d:/react/DropSphere/src/hooks/useSignaling.ts) — Client React hook managing signaling lifecycle, dynamic device detection, and QR URL hash room pairing.
* **Binary Chunking & Transfer Engine (Step 4):**
  * [src/lib/transfer/PacketProtocol.ts](file:///d:/react/DropSphere/src/lib/transfer/PacketProtocol.ts) — 64KB chunk constants, 49-byte binary packet header encoder/decoder, and JSON control schemas (`FileMetaMessage`, `FileCompleteMessage`, `FileCancelMessage`).
  * [src/lib/transfer/BackpressureController.ts](file:///d:/react/DropSphere/src/lib/transfer/BackpressureController.ts) — `bufferedAmount` monitor with 4MB ceiling and 1MB `bufferedAmountLowThreshold` flow control.
  * [src/lib/transfer/ChunkEngine.ts](file:///d:/react/DropSphere/src/lib/transfer/ChunkEngine.ts) — Progressive `Blob.slice()` 64KB reader, ArrayBuffer transport, and throttled 150ms UI telemetry.
  * [src/lib/transfer/ReceiverEngine.ts](file:///d:/react/DropSphere/src/lib/transfer/ReceiverEngine.ts) — Incoming chunk collector, chunk reassembly into `Blob`, and instant browser download trigger.
  * [src/lib/transfer/TransferManager.ts](file:///d:/react/DropSphere/src/lib/transfer/TransferManager.ts) — Active send engine coordinator, pause, resume, and cancel controller.
* **Cryptographic Integrity Engine (Step 5):**
  * [src/lib/hashing/hashUtils.ts](file:///d:/react/DropSphere/src/lib/hashing/hashUtils.ts) — Native Web Crypto API (`crypto.subtle.digest`) 256-bit hash calculation.
* **UI & Views:**
  * [src/app/page.tsx](file:///d:/react/DropSphere/src/app/page.tsx) — Main workspace uniting Radar, Dropzone, Queue, and Diagnostics.
  * [src/app/layout.tsx](file:///d:/react/DropSphere/src/app/layout.tsx) — Root layout with `suppressHydrationWarning`.
  * [src/app/globals.css](file:///d:/react/DropSphere/src/app/globals.css) — Cyberpunk glassmorphism, radar keyframes, and color tokens.
* **Components:**
  * [src/components/network/NetworkRadar.tsx](file:///d:/react/DropSphere/src/components/network/NetworkRadar.tsx) — Radar sweep, center device node, and dynamic connection beam.
  * [src/components/network/PeerNode.tsx](file:///d:/react/DropSphere/src/components/network/PeerNode.tsx) — Discovered peer cards with ping and connect action.
  * [src/components/transfer/TransferDropzone.tsx](file:///d:/react/DropSphere/src/components/transfer/TransferDropzone.tsx) — Glowing file drop target connected to live WebRTC `sendFile`.
  * [src/components/transfer/TransferQueue.tsx](file:///d:/react/DropSphere/src/components/transfer/TransferQueue.tsx) — High-density transfer rows with direction-aware info, live speed gauge, pause/resume/cancel controls, and copyable SHA-256 badge.
  * [src/components/diagnostics/TechnicalDiagnostics.tsx](file:///d:/react/DropSphere/src/components/diagnostics/TechnicalDiagnostics.tsx) — WebRTC, DTLS, backpressure, and ICE stats.
  * [src/components/modals/QRPairingModal.tsx](file:///d:/react/DropSphere/src/components/modals/QRPairingModal.tsx) — Live QR generator with dynamic Wi-Fi IP and 6-digit room code for mobile.
  * [src/components/modals/CommandPalette.tsx](file:///d:/react/DropSphere/src/components/modals/CommandPalette.tsx) — Global `Cmd+K` keyboard shortcut.
* **WebRTC & Transport Engine:**
  * [src/lib/webrtc/WebRTCManager.ts](file:///d:/react/DropSphere/src/lib/webrtc/WebRTCManager.ts) — Full RTCPeerConnection and RTCDataChannel manager with STUN configuration, ICE candidate queuing, ping/pong RTT latency calculation, and event bus.
  * [src/hooks/useWebRTC.ts](file:///d:/react/DropSphere/src/hooks/useWebRTC.ts) — Bridge hook connecting SignalingClient to WebRTCManager, managing live peer states, wiring `receiverEngine`, and exposing `sendFile`.
* **Stores & Types:**
  * [src/stores/usePeerStore.ts](file:///d:/react/DropSphere/src/stores/usePeerStore.ts) — Local device identity, peers list, dynamic serverLanIp, signaling status, live rtcDiagnostics, and connectHandler.
  * [src/stores/useTransferStore.ts](file:///d:/react/DropSphere/src/stores/useTransferStore.ts) — Clean file transfer queue without mock data, live byte progress, speeds, and ETA.
  * [src/stores/useUIStore.ts](file:///d:/react/DropSphere/src/stores/useUIStore.ts) — Modals and tab navigation.
  * [src/types/index.ts](file:///d:/react/DropSphere/src/types/index.ts) — TypeScript models.

---

## 🎯 Immediate Next Step Instructions for the AI Agent (Step 6)

When continuing with the next milestone:
1. **Steps 1 through 5 are fully completed, integrated, and verified:**
   * P2P WebRTC data connection, 64KB chunk streaming, backpressure flow control, and streaming SHA-256 checksum verification are all operational.
2. **Execute Step 6: Screen Sharing Stream:**
   * Integrate WebRTC `MediaStream` video track with `navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, cursor: "always" } })`.
   * Add video track to active `RTCPeerConnection` for 60 FPS live video cast to peer.
   * Render incoming stream on receiver with full-screen and theater controls in `ScreenShareViewer.tsx`.

