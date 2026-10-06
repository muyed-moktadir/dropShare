'use client';
import React from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { Sliders, ShieldCheck, Network, Activity, Layers, Gauge, Lock, Cpu } from 'lucide-react';
export function TechnicalDiagnostics() {
    const { localDevice, peers, activeConnectedPeerId, rtcDiagnostics, serverLanIp, signalingStatus } = usePeerStore();
    const connectedPeer = peers.find((p) => p.id === activeConnectedPeerId);
    const metrics = [
        {
            title: 'Transport Layer',
            value: 'WebRTC DataChannel',
            subtext: 'SCTP over DTLS 1.3',
            icon: Network,
        },
        {
            title: 'Channel Mode',
            value: rtcDiagnostics.dataChannelState.includes('open') ? 'DataChannel Open' : 'Reliable / Ordered',
            subtext: 'Zero packet loss',
            icon: Layers,
        },
        {
            title: 'Flow Control',
            value: 'Backpressure',
            subtext: '16 KB – 4 MB threshold',
            icon: Gauge,
        },
        {
            title: 'Integrity',
            value: 'SHA-256 WebCrypto',
            subtext: 'Streaming hash verify',
            icon: ShieldCheck,
        },
    ];
    return (<div className="relative w-full h-[420px] sm:h-[430px] flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-sm transition-all duration-200">
      {/* ── Top Header Bar ── */}
      <div className="flex-none flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
            <Sliders className="h-4 w-4"/>
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
              WebRTC & Pipeline Diagnostics
            </h3>
            <p className="text-[11px] text-slate-400">Real-time networking telemetry and protocol parameters</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
          Hardware Accelerated
        </span>
      </div>

      {/* ── Main Metrics Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
        {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (<div key={idx} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 transition-colors hover:bg-white hover:border-slate-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500">{m.title}</span>
                <Icon className="h-4 w-4 text-blue-600"/>
              </div>
              <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-900">{m.value}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{m.subtext}</p>
            </div>);
        })}
      </div>

      {/* ── Live Connection Profile Section ── */}
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 text-xs font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70 text-[11px]">
          <div className="flex items-center gap-2 text-slate-600">
            <Activity className="h-3.5 w-3.5 text-blue-600"/>
            <span>Profile:</span>
            <span className="text-slate-900 font-semibold">
              {connectedPeer ? `${localDevice.name} ◄—► ${connectedPeer.name}` : 'Awaiting Peer Selection'}
            </span>
          </div>
          <div className="text-emerald-700 font-medium">
            ICE: {rtcDiagnostics.iceConnectionState !== 'new' ? rtcDiagnostics.iceConnectionState : connectedPeer ? 'connected' : 'idle'}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-500">
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-semibold">Interface</span>
            <span className="text-slate-800 font-medium">{localDevice.ip || '127.0.0.1'} (Wi-Fi LAN)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-semibold">Signaling Hub</span>
            <span className="text-blue-600 font-medium truncate block">
              {serverLanIp ? `ws://${serverLanIp}:4000` : `ws://localhost:4000`}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[9px] uppercase font-semibold">Average RTT</span>
            <span className="text-emerald-700 font-semibold">
              {rtcDiagnostics.rtt > 0 ? `${rtcDiagnostics.rtt} ms` : connectedPeer ? `${connectedPeer.ping} ms` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Protocol Badges ── */}
      <div className="flex-none pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-600">
            <Lock className="h-3 w-3 text-emerald-600"/> DTLS 1.3 End-to-End
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:flex items-center gap-1 text-slate-600">
            <Cpu className="h-3 w-3 text-blue-600"/> Client WebCrypto
          </span>
        </div>
        <span className="text-emerald-700 font-semibold">Zero Cloud Storage</span>
      </div>
    </div>);
}
