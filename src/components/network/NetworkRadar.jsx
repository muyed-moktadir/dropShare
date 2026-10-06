'use client';
import React from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useUIStore } from '@/stores/useUIStore';
import { PeerNode } from './PeerNode';
import { Laptop, Radio, QrCode, Cpu } from 'lucide-react';
export function NetworkRadar() {
    const { localDevice, peers, selectedPeerId, activeConnectedPeerId, selectPeer, connectToPeer } = usePeerStore();
    const { setQRModalOpen } = useUIStore();
    const connectedPeer = peers.find((p) => p.id === activeConnectedPeerId);
    return (<div className="relative w-full rounded-3xl glass-panel p-6 sm:p-8 overflow-hidden shadow-2xl">
      {/* ── Internal Ambient Glow (GPU-Accelerated Radial Gradient) ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[380px] w-[380px] rounded-full pointer-events-none" style={{
            background: 'radial-gradient(circle, rgba(0, 245, 255, 0.08) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%)',
        }}/>

      {/* Radar scanning circle visualizer container */}
      <div className="relative mx-auto flex h-[380px] sm:h-[440px] w-full max-w-2xl items-center justify-center">
        {/* Concentric radar rings with luminous frosted lines */}
        <div className="absolute h-[140px] w-[140px] rounded-full border border-white/[0.12] bg-white/[0.02] shadow-[inset_0_0_20px_rgba(0,245,255,0.05)]"/>
        <div className="absolute h-[260px] w-[260px] rounded-full border border-white/[0.1] bg-white/[0.01]"/>
        <div className="absolute h-[380px] w-[380px] rounded-full border border-dashed border-cyan-400/25"/>
        
        {/* Expanding pulse ripple */}
        <div className="absolute h-[240px] w-[240px] rounded-full border border-cyan-400/30 animate-pulse-ripple pointer-events-none"/>

        {/* 360-degree radar scanner sweep (Aurora Conic Sweep) */}
        <div className="absolute h-[380px] w-[380px] rounded-full overflow-hidden pointer-events-none opacity-40">
          <div className="h-full w-full animate-radar-sweep" style={{
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(0, 245, 255, 0.3) 0deg, rgba(139, 92, 246, 0.15) 45deg, transparent 90deg, transparent 360deg)',
        }}/>
        </div>

        {/* Crosshair telemetry lines */}
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.15] to-transparent pointer-events-none"/>
        <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/[0.15] to-transparent pointer-events-none"/>

        {/* Dynamic active SVG connection beam if a peer is connected */}
        {connectedPeer && (<svg className="absolute inset-0 h-full w-full pointer-events-none">
            <line x1="50%" y1="50%" x2="78%" y2="28%" stroke="#00f5ff" strokeWidth="2.5" className="animate-stream-packets opacity-90 drop-shadow-[0_0_8px_rgba(0,245,255,0.8)]"/>
            <circle cx="50%" cy="50%" r="5" fill="#00f5ff" className="drop-shadow-[0_0_10px_#00f5ff]"/>
            <circle cx="78%" cy="28%" r="4" fill="#00f5ff" className="drop-shadow-[0_0_10px_#00f5ff]"/>
          </svg>)}

        {/* Center Node (Local Device / Self) */}
        <div className="relative z-20 flex flex-col items-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-fuchsia-500/20 border-2 border-white/30 shadow-[0_0_40px_rgba(0,245,255,0.35),inset_0_1px_2px_rgba(255,255,255,0.3)] transition-transform duration-300 hover:scale-105">
            <Laptop className="h-9 w-9 text-white drop-shadow-[0_0_10px_rgba(0,245,255,0.8)]"/>
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.9)] ring-2 ring-[#060913]">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"/>
            </span>
          </div>

          {/* Local Device Label */}
          <div className="mt-3 flex flex-col items-center">
            <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-1 text-xs font-semibold text-white shadow-lg">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]"/>
              {localDevice.name} (This Device)
            </div>
            <span className="mt-1 font-mono text-[11px] text-slate-400">
              {localDevice.ip} • P2P Signal Active
            </span>
          </div>
        </div>

        {/* Floating Quick Action Badge */}
        <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300 font-mono shadow-md">
          <Radio className="h-3.5 w-3.5 text-[#00f5ff] animate-pulse"/>
          <span>Subnet Scanner Active</span>
        </div>

        {/* Pair via QR Code button */}
        <button onClick={() => setQRModalOpen(true)} className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/15 to-violet-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:text-white hover:border-cyan-300/50 hover:from-cyan-500/25 hover:to-violet-500/25 transition-all shadow-[0_0_15px_rgba(0,245,255,0.18)] cursor-pointer">
          <QrCode className="h-3.5 w-3.5 text-[#00f5ff]"/>
          <span>Pair via QR Code</span>
        </button>
      </div>

      {/* Discovered Nearby Peer Cards Section */}
      <div className="mt-8 border-t border-white/[0.1] pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#00f5ff]"/>
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Nearby Devices Detected ({peers.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Click any peer to establish WebRTC connection
          </span>
        </div>

        {peers.length === 0 ? (<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-violet-500/20 text-[#00f5ff] mb-3 border border-cyan-400/30 shadow-[0_0_20px_rgba(0,245,255,0.2)]">
              <Radio className="h-6 w-6 animate-pulse"/>
            </div>
            <h4 className="text-sm font-semibold text-white">Scanning Subnet for Nearby Devices...</h4>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              No other devices detected on this network yet. Open DropSphere on another phone or computer on the same Wi-Fi, or scan the QR code to pair.
            </p>
            <button onClick={() => setQRModalOpen(true)} className="mt-4 flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)] cursor-pointer">
              <QrCode className="h-3.5 w-3.5"/>
              <span>Pair Mobile via QR Code</span>
            </button>
          </div>) : (<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {peers.map((peer) => (<PeerNode key={peer.id} peer={peer} isSelected={selectedPeerId === peer.id} isConnected={activeConnectedPeerId === peer.id} onSelect={() => selectPeer(peer.id)} onConnect={() => connectToPeer(peer.id)}/>))}
          </div>)}
      </div>
    </div>);
}
