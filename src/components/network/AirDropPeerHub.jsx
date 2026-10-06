'use client';
import React from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { Smartphone, Laptop, Monitor, Tablet, Radio, Users, Check, Crown, Wifi, Zap, } from 'lucide-react';
export function AirDropPeerHub() {
    const { isHost, peers, targetRecipientMode, selectedRecipientIds, setTargetRecipientMode, toggleSelectRecipient, selectPeer, hostPeerId, } = usePeerStore();
    const getDeviceIcon = (type, os) => {
        switch (type) {
            case 'mobile':
                return <Smartphone className="h-6 w-6 text-blue-600"/>;
            case 'tablet':
                return <Tablet className="h-6 w-6 text-blue-600"/>;
            case 'laptop':
                return <Laptop className="h-6 w-6 text-blue-600"/>;
            default:
                return <Monitor className="h-6 w-6 text-blue-600"/>;
        }
    };
    const hostPeer = peers.find((p) => p.id === hostPeerId);
    return (<div className="w-full rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
      {isHost ? (
        /* ══════════════════════════════════════════════════════════════
           👑 HOST VIEW: APPLE AIRDROP DEVICE CARDS
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {/* Top Bar: Title & Broadcast / Selective Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-xs"/>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Nearby AirDrop Devices ({peers.length})
              </h3>
            </div>

            {/* Target mode iOS-style segmented pill */}
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs">
              <button onClick={() => setTargetRecipientMode('all')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer ${targetRecipientMode === 'all'
                ? 'bg-white text-blue-600 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'}`}>
                <Users className="h-3.5 w-3.5 text-blue-600"/>
                <span>Broadcast All ({peers.length})</span>
              </button>

              <button onClick={() => setTargetRecipientMode('selected')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all cursor-pointer ${targetRecipientMode === 'selected'
                ? 'bg-white text-blue-600 border border-slate-200 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'}`}>
                <Check className="h-3.5 w-3.5 text-blue-600"/>
                <span>Selective ({selectedRecipientIds.length})</span>
              </button>
            </div>
          </div>

          {/* Peer Device Cards */}
          {peers.length === 0 ? (
            /* Elegant Serene Waiting State */
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-600 mb-3 shadow-2xs">
                <Radio className="h-6 w-6 animate-pulse"/>
              </div>
              <h4 className="text-sm font-bold text-slate-800">Searching for Nearby Devices</h4>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                Open DropSphere on another phone, Mac, or PC on this Wi-Fi network, or tap the Session Capsule above to share your invite link.
              </p>
            </div>) : (
            /* Tactile AirDrop Device Cards (White Studio) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {peers.map((peer) => {
                    const isSelected = selectedRecipientIds.includes(peer.id);
                    const isConnected = peer.status === 'connected';
                    return (<div key={peer.id} onClick={() => {
                            if (targetRecipientMode === 'selected') {
                                toggleSelectRecipient(peer.id);
                            }
                            else {
                                selectPeer(peer.id);
                            }
                        }} className={`group relative flex items-center gap-3.5 rounded-2xl p-4 border transition-all duration-150 cursor-pointer ${isSelected && targetRecipientMode === 'selected'
                            ? 'bg-blue-50/80 border-blue-400 shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-xs'}`}>
                    {/* Device Icon Avatar with Apple-like Glass Backdrop */}
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-2xs">
                      {getDeviceIcon(peer.type, peer.os)}
                      {/* Connection indicator */}
                      <span className={`absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-white ${isConnected ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`}/>
                    </div>

                    {/* Device Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {peer.name}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-500">
                        <span>{peer.os.toUpperCase()}</span>
                        <span>•</span>
                        <span className="text-emerald-600 flex items-center gap-0.5 font-medium">
                          <Wifi className="h-2.5 w-2.5"/>
                          {peer.ping ? `${peer.ping}ms` : 'LAN'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill or Checkbox */}
                    {targetRecipientMode === 'selected' ? (<div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${isSelected
                                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                                : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]"/>}
                      </div>) : (<span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-700">
                        Ready
                      </span>)}
                  </div>);
                })}
            </div>)}
        </div>) : (
        /* ══════════════════════════════════════════════════════════════
           👤 GUEST VIEW: FOCUSED HOST CONNECTION HUB (Fresh White)
           ══════════════════════════════════════════════════════════════ */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 shadow-2xs">
              <Laptop className="h-7 w-7 text-blue-600"/>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"/>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <Crown className="h-2.5 w-2.5 text-amber-600"/> Host
                </span>
                <h4 className="text-sm font-bold text-slate-900">
                  {hostPeer?.name || 'Room Host (My Windows PC)'}
                </h4>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 font-mono flex items-center gap-2">
                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                  <Zap className="h-3 w-3"/> P2P Direct Active
                </span>
                <span>•</span>
                <span>64KB Slices Ready</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-right font-mono text-[11px] text-slate-500">
            <div className="text-slate-800 font-semibold">Auto-Receiver Mode</div>
            <div className="text-[10px] text-emerald-600 font-medium">Listening for incoming transfers</div>
          </div>
        </div>)}
    </div>);
}
