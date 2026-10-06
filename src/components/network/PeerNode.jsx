'use client';
import React from 'react';
import { Laptop, Smartphone, Monitor, Wifi, CheckCircle2, ArrowRightLeft, Loader2, Tv } from 'lucide-react';
import { useUIStore } from '@/stores/useUIStore';
export function PeerNode({ peer, isSelected, isConnected, onSelect, onConnect }) {
    const getDeviceIcon = () => {
        switch (peer.type) {
            case 'laptop':
                return <Laptop className="h-5 w-5 text-[#00f5ff]"/>;
            case 'mobile':
                return <Smartphone className="h-5 w-5 text-[#a855f7]"/>;
            default:
                return <Monitor className="h-5 w-5 text-[#10b981]"/>;
        }
    };
    const getOSBadge = () => {
        switch (peer.os) {
            case 'macos':
                return 'macOS';
            case 'ios':
                return 'iOS';
            case 'linux':
                return 'Linux';
            case 'windows':
                return 'Windows';
            default:
                return 'Peer OS';
        }
    };
    return (<div onClick={onSelect} className={`group relative cursor-pointer rounded-2xl p-4 transition-all duration-300 ${isSelected || isConnected
            ? 'glass-panel-elevated ring-2 ring-cyan-400/50 shadow-[0_0_30px_rgba(0,245,255,0.22)] scale-[1.02]'
            : 'glass-panel hover:border-white/25 hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:scale-[1.01]'}`}>
      {/* Top row: Device icon, Name, and Status indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] border border-white/15 group-hover:border-cyan-400/40 transition-all shadow-inner">
            {getDeviceIcon()}
            {isConnected && (<span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#10b981] text-[#060913] ring-2 ring-[#060913] shadow-[0_0_6px_#10b981]">
                <CheckCircle2 className="h-3 w-3 text-white"/>
              </span>)}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              {peer.name}
              {isConnected && (<span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.3)]">
                  Active P2P
                </span>)}
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400 font-mono">{getOSBadge()}</span>
              <span className="text-[10px] text-white/20">•</span>
              <span className="text-[11px] font-mono text-slate-400">{peer.ip || 'Local Subnet'}</span>
            </div>
          </div>
        </div>

        {/* Ping / Signal Indicator */}
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-mono text-emerald-400 shadow-sm">
          <Wifi className="h-3 w-3"/>
          <span>{peer.ping}ms</span>
        </div>
      </div>

      {/* Action footer */}
      <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.08] pt-3">
        <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
          {isConnected ? (<span className="text-[#00f5ff] flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3"/> Ready for transfer
            </span>) : peer.status === 'connecting' ? (<span className="text-amber-400 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin"/> Negotiating SDP...
            </span>) : peer.status === 'failed' ? (<span className="text-rose-400 flex items-center gap-1">
              Connection timeout / failed
            </span>) : ('Discovered on LAN')}
        </span>

        {isConnected ? (<div className="flex items-center gap-1.5">
            <button onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }} className="rounded-xl bg-cyan-500/20 border border-cyan-400/40 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:text-white hover:bg-cyan-500/30 transition-all shadow-[0_0_12px_rgba(0,245,255,0.2)]">
              Send Files
            </button>
            <button onClick={(e) => {
                e.stopPropagation();
                useUIStore.getState().setActiveTab('screenshare');
            }} title="Cast Screen to Peer" className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.06] px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:border-cyan-400/40 hover:bg-white/[0.1] transition-all">
              <Tv className="h-3 w-3 text-cyan-400"/>
              <span>Cast</span>
            </button>
          </div>) : (<button onClick={(e) => {
                e.stopPropagation();
                onConnect();
            }} disabled={peer.status === 'connecting'} className={`rounded-xl border px-3 py-1 text-xs font-semibold transition-all ${peer.status === 'failed'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
                : 'bg-white/[0.06] border-white/15 text-white hover:border-cyan-400/50 hover:bg-cyan-500/15 hover:text-cyan-200 shadow-sm'}`}>
            {peer.status === 'connecting'
                ? 'Connecting...'
                : peer.status === 'failed'
                    ? 'Retry'
                    : 'Connect'}
          </button>)}
      </div>
    </div>);
}
