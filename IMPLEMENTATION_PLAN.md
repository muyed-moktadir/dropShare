# DropSphere — Master Implementation Plan & Architecture Blueprint

> **Private. Direct. Fast.**  
> A browser-native P2P file and screen-sharing platform built with WebRTC, binary chunk streaming, backpressure flow control, and SHA-256 integrity verification.

---

## 1. System Architecture Diagram

```mermaid
graph TD
    subgraph Signaling_Plane ["Control Plane (Node.js WebSocket Server)"]
        SS[Signaling Hub: Room Management / SDP / ICE Relay / QR Sessions]
    end

    subgraph Client_A ["Peer A (Sender - e.g. Desktop)"]
        UI_A["Network OS UI (Next.js + Tailwind)"]
        STORE_A["Zustand Stores (Peer, Connection, Transfer)"]
        CHUNK_A["Chunking Engine (Blob.slice 64KB ArrayBuffer)"]
        BP_A["Backpressure Controller (bufferedAmountLowThreshold)"]
        HASH_A["Streaming SHA-256 (Web Crypto API)"]
        RTC_A["WebRTC Manager (RTCPeerConnection + RTCDataChannel)"]
        SCREEN_A["Screen Sharing Engine (getDisplayMedia)"]
    end

    subgraph Client_B ["Peer B (Receiver - e.g. Mobile/Laptop)"]
        UI_B["Mobile / Desktop Responsive UI"]
        STORE_B["Zustand Stores"]
        RTC_B["WebRTC Manager (RTCPeerConnection + RTCDataChannel)"]
        REASSEMBLY_B["Chunk Reassembly Engine (Memory ArrayBuffer Buffer)"]
        HASH_B["SHA-256 Integrity Verifier (SubtleCrypto)"]
        SCREEN_B["Low-Latency Video Renderer"]
    end

    %% Signaling
    UI_A <-->|1. Room Join / SDP Offer / ICE Candidates| SS
    SS <-->|2. Presence Broadcast / SDP Answer / ICE Candidates| UI_B

    %% Direct P2P
    RTC_A <===>|3. Direct Encrypted DTLS Connection (Local Wi-Fi LAN)| RTC_B
    CHUNK_A -->|4. 64KB Slices| BP_A
    BP_A -->|5. Throttled Chunk Stream| RTC_A
    RTC_A ===>|6. High-Speed LAN DataChannel 50-100+ MB/s| RTC_B
    RTC_B -->|7. Binary Chunks| REASSEMBLY_B
    REASSEMBLY_B -->|8. Assembled Blob Checksum| HASH_B
    HASH_B -->|9. Verification Match -> Trigger Download| UI_B
    SCREEN_A -.->|10. 60 FPS MediaStream Track| SCREEN_B
```

---

## 2. Core Technical Architecture & Decisions

### 2.1 File Streaming & Zero-RAM-Exhaustion Chunking
* **The Problem:** Reading a 2GB–5GB file completely into memory will instantly crash mobile/desktop browser tabs.
* **The Solution:** 
  * Never load the full file.
  * Use `Blob.prototype.slice(start, end)` + progressive reading as `ArrayBuffer` in **64 KB chunks**.
  * Chunks are packed with a binary header: `[TransferID (UUID 16B) | ChunkIndex (4B) | TotalChunks (4B) | Payload]`.
  * Receiver accumulates slices in memory or chunks cache and reconstructs the single `Blob` only upon final completion, triggering instant browser download.

### 2.2 Backpressure & Flow Control Engine
* **The Problem:** A high-speed sender CPU can push data faster than the receiver's network buffer can consume, resulting in packet loss, UI lockup, or abrupt socket crashes.
* **The Solution:**
  * Configure `dataChannel.bufferedAmountLowThreshold = 1 * 1024 * 1024` (1MB buffer floor).
  * Sender monitors `dataChannel.bufferedAmount`. If `> 4MB`, chunk emission immediately **pauses**.
  * Sender listens to `dataChannel.onbufferedamountlow` to automatically **resume** chunk reading.
  * Real UI telemetry updates throttled via `requestAnimationFrame` to avoid React re-render lag.

### 2.3 Cryptographic Integrity Verification (SHA-256)
* Sender computes SHA-256 checksum using the browser-native Web Crypto API (`crypto.subtle.digest`).
* Receiver calculates the local checksum of the reconstructed binary blob.
* Receiver sends a typed `HASH_VERIFIED` or `HASH_FAILED` message over the DataChannel.
* If hashes match, UI shows `✓ Verified`. If corrupt, UI flags an integrity error and provides a retry mechanism.

### 2.4 Browser-Realistic Peer Discovery (Best-Effort + QR Fallback)
* **The Browser Reality:** Browsers run in a sandboxed JavaScript runtime without raw UDP socket permissions. They cannot do raw mDNS/ARP multicast broadcasts like native AirDrop or LocalSend. Furthermore, WebRTC mDNS obfuscates private LAN IPs into random `.local` UUIDs.
* **Our Dual-Layer Solution:**
  1. **Layer 1 (Best-Effort Auto-Discovery):** The signaling server clusters devices sharing the same public IP address (NAT) into the same virtual room.
  2. **Layer 2 (Bulletproof QR / Session Code Fallback):** For corporate networks, VPN users, or AP-isolated routers, the desktop displays a dynamic QR code and 6-character room code. The phone scans it and connects instantly.

### 2.5 Screen Sharing Engine
* Integrates `navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, cursor: "always" } })`.
* Dedicated WebRTC video track added to the existing `RTCPeerConnection`.
* Minimal latency stream rendered on the receiver with full-screen and theater modes.

---

## 3. UI/UX Design System ("Network Operating System")

* **Aesthetic Philosophy:** Dark-first, minimalist, cybernetic networking tool (inspired by Linear, Raycast, and network telemetry software).
* **Color Palette:**
  * Background: `#070A0F` (Cosmic Obsidian)
  * Surface Layer: `#0D1118` | Elevated Surface: `#121923`
  * Network Accent (Cyan): `#26CCFF` (Active beams, nodes, transfers)
  * Success: `#35D07F` (Verified checksums)
  * Warning: `#F5B942` (Backpressure active / throttled)
  * Error: `#FF5C5C` (Transfer dropped or hash mismatch)
  * Text Primary: `#F5F7FA` | Text Secondary: `#8B95A5`
* **Typography:**
  * UI Text & Headings: **Inter** / **Geist Sans**
  * Technical Diagnostics, IPs, Speeds, Hashes, Byte counts: **JetBrains Mono**
* **Workspaces & Components:**
  * **Network Radar Canvas:** Pulse radar showing local device in center with discovered peer nodes in dynamic orbit.
  * **Reactive Dropzone:** Screen-wide drag-and-drop zone that physically responds to files hovering over the browser.
  * **High-Density Transfer Queue:** Real-time speed gauges (MB/s), ETA, pause/resume, cancel buttons, and checksum status.
  * **Technical Transparency Drawer:** Live `bufferedAmount` chart, DTLS status, ICE candidates, round-trip latency (RTT).
  * **Command Palette:** `Cmd+K` / `Ctrl+K` for instant keyboard-driven navigation.

---

## 4. State Management Architecture (Zustand)

* `peerStore`: Local device identity (Name, OS, Device Type, UUID) and discovered remote peers with ping latencies.
* `connectionStore`: WebSocket signaling status, WebRTC peer connection states (`connecting`, `connected`, `failed`), DTLS state.
* `transferStore`: Queue of files (sending & receiving), byte progress, transfer speeds, buffer backpressure flags, checksum states.
* `screenShareStore`: Local screen track, remote video stream, full-screen controls.
* `uiStore`: Active view (`transfer` | `screenshare` | `diagnostics` | `activity` | `settings`), command palette modal, toasts.

---

## 5. Project Directory Structure

```
d:/react/DropSphere/
├── IMPLEMENTATION_PLAN.md            # This master architecture blueprint
├── PROJECT_IDEAS.md                  # Original concept and problem statement
├── docs/                             # Deep documentation for portfolio & interviews
│   ├── architecture.md
│   ├── protocol.md
│   ├── file-transfer.md
│   ├── webrtc.md
│   └── browser-limitations.md
├── server/                           # Standalone Node.js WebSocket signaling server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # WebSocket signaling hub
│       ├── room-manager.ts           # IP clustering & QR session rooms
│       └── types.ts                  # Shared protocol definitions
├── src/                              # Next.js frontend application
│   ├── app/
│   │   ├── layout.tsx                # Root layout with fonts & theme
│   │   ├── page.tsx                  # Main "Network OS" interactive workspace
│   │   └── globals.css               # Design system tokens and custom CSS
│   ├── components/
│   │   ├── ui/                       # Base primitives (Button, Dialog, Tooltip, Badge)
│   │   ├── network/                  # NetworkRadar, PeerNode, ConnectionBeams
│   │   ├── transfer/                 # TransferDropzone, TransferQueue, TransferRow, SpeedGauge
│   │   ├── screen-share/             # ScreenShareViewer, StreamControls
│   │   ├── diagnostics/              # DiagnosticsPanel, BufferChart, LatencyCard
│   │   ├── landing/                  # Landing view & "Under the Hood" showcase
│   │   └── command-palette/          # Cmd+K quick action palette
│   ├── lib/
│   │   ├── webrtc/                   # WebRTCManager, RTCPeerConnection wrapper
│   │   ├── transfer/                 # ChunkEngine, BackpressureController, Reassembler
│   │   ├── hashing/                  # Web Crypto SHA-256 helpers
│   │   └── protocol/                 # Typed message schemas (FILE_OFFER, CHUNK, COMPLETE)
│   ├── stores/                       # Zustand store modules
│   ├── hooks/                        # Custom React hooks (useWebRTC, useBackpressure)
│   └── types/                        # Global TypeScript interfaces
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. Phase-by-Phase Execution Roadmap

* **Phase 1: Project Setup & Design System Tokens**  
  Initialize Next.js (App Router), TypeScript, Tailwind CSS, Lucide icons, fonts, and dark "Network OS" color variables.
* **Phase 2: Architectural Landing Page & Engineering Showcase**  
  Build interactive preview, architecture diagrams, and "Under the Hood" portfolio explanations.
* **Phase 3: Core App Shell & Network Radar UI**  
  Build header telemetry, central circular radar space, orbiting peer nodes, and `Cmd+K` command palette.
* **Phase 4: Node.js WebSocket Signaling Server (`server/`)**  
  Implement room management, best-effort IP clustering, QR session bootstrap, and SDP/ICE candidate relay.
* **Phase 5: Client-Side WebRTC Manager**  
  `RTCPeerConnection` factory, `RTCDataChannel` wrapper, connection state recovery, and ping/pong latency measurement.
* **Phase 6: Binary File Chunking Engine (MVP)**  
  Progressive `Blob.slice()` 64KB reader, ArrayBuffer transport, receiver chunk assembly, and automatic download trigger.
* **Phase 7: Backpressure & Flow Control Engine**  
  `bufferedAmountLowThreshold` handling, queue throttling, and smooth 60 FPS UI telemetry via `requestAnimationFrame`.
* **Phase 8: SHA-256 Web Crypto Integrity Verification**  
  Sender/receiver streaming hash computation, verification handshake, and corruption alert/retry logic.
* **Phase 9: High-Density Transfer Queue & Activity Log**  
  Multi-file transfer queue, pause/resume, cancel actions, and IndexedDB session history.
* **Phase 10: Screen Sharing Engine**  
  `getDisplayMedia()` video capture, WebRTC video track negotiation, and low-latency receiver viewer.
* **Phase 11: Deep Technical Diagnostics Panel**  
  Real-time buffer monitor graph, throughput gauge, ICE candidate inspector, and DTLS security details.
* **Phase 12: Mobile Optimization & QR Pairing Flow**  
  Mobile touch bottom sheets, dynamic QR generation on desktop, and phone camera QR reader.
* **Phase 13: Stress Testing & Browser Limit Validation**  
  Large file test (multi-GB), network disconnection handling, and documented platform limitations.
* **Phase 14: Accessibility, Keyboard UX & Polish**  
  WCAG 2.1 AA compliance, keyboard navigation (`Cmd+K`, `Escape`, `Enter`), and reduced-motion support.
* **Phase 15: Deployment Configuration & Full Documentation**  
  Vercel (Client) + Render (Signaling) deployment scripts and full `docs/*` technical guides.
