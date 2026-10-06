'use client';
import React, { useState } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useUIStore } from '@/stores/useUIStore';
import { Crown, User, Users, Copy, Check, QrCode, CheckSquare, Square, } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/clipboard';
export function HostControlBar() {
    const { isHost, roomId, peers, hostPeerId, targetRecipientMode, selectedRecipientIds, setTargetRecipientMode, toggleSelectRecipient, selectAllRecipients, clearSelectedRecipients, serverLanIp, } = usePeerStore();
    const { setQRModalOpen } = useUIStore();
    const [copied, setCopied] = useState(false);
    // Derive invite URL
    const getInviteUrl = () => {
        if (typeof window === 'undefined')
            return '';
        let host = window.location.hostname || 'localhost';
        if ((host === 'localhost' || host === '127.0.0.1') && serverLanIp) {
            host = serverLanIp;
        }
        const port = window.location.port ? `:${window.location.port}` : '';
        const protocol = window.location.protocol;
        const roomCode = encodeURIComponent(roomId || 'main');
        return `${protocol}//${host}${port}/#join=${roomCode}`;
    };
    const handleCopyLink = async () => {
        const url = getInviteUrl();
        const success = await copyToClipboard(url);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2200);
        }
    };
    const hostPeer = peers.find((p) => p.id === hostPeerId);
    return (<div className="w-full rounded-2xl glass-panel p-4 sm:p-5 border border-white/[0.12] shadow-xl">
      {isHost ? (
        /* ══════════════════════════════════════════════════════════════
           👑 HOST DASHBOARD CONTROLS
           ══════════════════════════════════════════════════════════════ */
        <div className="space-y-4">
          {/* Top row: Role Badge, Room Code, and Invite Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-1 text-xs font-bold text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                <Crown className="h-3.5 w-3.5 text-amber-400"/>
                <span>Room Host</span>
              </span>

              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
                <span className="text-slate-500">Room:</span>
                <span className="font-semibold text-cyan-300 bg-white/[0.05] px-2 py-0.5 rounded-md border border-white/10">
                  {roomId || 'lan-cluster'}
                </span>
              </div>
            </div>

            {/* Quick Actions: Copy Link & Show QR */}
            <div className="flex items-center gap-2">
              <button onClick={handleCopyLink} className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer">
                {copied ? (<>
                    <Check className="h-3.5 w-3.5 text-[#10b981]"/>
                    <span className="text-[#10b981]">Link Copied!</span>
                  </>) : (<>
                    <Copy className="h-3.5 w-3.5 text-cyan-400"/>
                    <span>Copy Invite Link</span>
                  </>)}
              </button>

              <button onClick={() => setQRModalOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/20 to-violet-500/20 hover:from-cyan-500/30 hover:to-violet-500/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:text-white transition-all shadow-[0_0_12px_rgba(0,245,255,0.2)] cursor-pointer">
                <QrCode className="h-3.5 w-3.5 text-[#00f5ff]"/>
                <span>Show QR</span>
              </button>
            </div>
          </div>

          {/* Bottom row: Recipient Targeting Mode (Broadcast vs Selective) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Send Target:</span>
              <div className="inline-flex rounded-xl border border-white/15 bg-black/40 p-1">
                <button onClick={() => setTargetRecipientMode('all')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${targetRecipientMode === 'all'
                ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-white border border-cyan-400/40 shadow-[0_0_10px_rgba(0,245,255,0.3)]'
                : 'text-slate-400 hover:text-white'}`}>
                  <Users className="h-3.5 w-3.5 text-[#00f5ff]"/>
                  <span>Broadcast to All ({peers.length})</span>
                </button>

                <button onClick={() => setTargetRecipientMode('selected')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${targetRecipientMode === 'selected'
                ? 'bg-gradient-to-r from-cyan-500/30 to-violet-500/30 text-white border border-cyan-400/40 shadow-[0_0_10px_rgba(0,245,255,0.3)]'
                : 'text-slate-400 hover:text-white'}`}>
                  <CheckSquare className="h-3.5 w-3.5 text-violet-400"/>
                  <span>Selective Mode ({selectedRecipientIds.length})</span>
                </button>
              </div>
            </div>

            {/* In selective mode: quick Select All / Clear Selection */}
            {targetRecipientMode === 'selected' && peers.length > 0 && (<div className="flex items-center gap-2">
                <button onClick={selectAllRecipients} className="text-[11px] text-cyan-300 hover:text-cyan-200 underline cursor-pointer">
                  Select All
                </button>
                <span className="text-slate-600">•</span>
                <button onClick={clearSelectedRecipients} className="text-[11px] text-slate-400 hover:text-slate-300 underline cursor-pointer">
                  Clear Selection
                </button>
              </div>)}
          </div>

          {/* If in selective mode: list peers with checkable badges */}
          {targetRecipientMode === 'selected' && (<div className="mt-2 flex flex-wrap gap-2 pt-2 border-t border-white/[0.06]">
              {peers.length === 0 ? (<span className="text-xs text-slate-500 italic">No guests in room yet to select.</span>) : (peers.map((peer) => {
                    const isChecked = selectedRecipientIds.includes(peer.id);
                    return (<button key={peer.id} onClick={() => toggleSelectRecipient(peer.id)} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer ${isChecked
                            ? 'border-cyan-400/50 bg-cyan-500/20 text-white shadow-[0_0_10px_rgba(0,245,255,0.25)]'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:bg-white/[0.08]'}`}>
                      {isChecked ? (<CheckSquare className="h-3.5 w-3.5 text-[#00f5ff]"/>) : (<Square className="h-3.5 w-3.5 text-slate-500"/>)}
                      <span>{peer.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({peer.ip || 'LAN'})</span>
                    </button>);
                }))}
            </div>)}
        </div>) : (
        /* ══════════════════════════════════════════════════════════════
           👤 CLEAN GUEST VIEW (ZERO-CONFUSION)
           ══════════════════════════════════════════════════════════════ */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-200 shadow-[0_0_10px_rgba(0,245,255,0.2)]">
              <User className="h-3.5 w-3.5 text-[#00f5ff]"/>
              <span>Room Guest</span>
            </span>

            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white">
                Connected to Host: <span className="text-cyan-300 font-bold">{hostPeer?.name || 'Room Host'}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Room: {roomId || 'Active'} • Ready for high-speed P2P transfer
              </span>
            </div>
          </div>

          {/* Guest quick action: copy invite link to forward to another friend */}
          <div className="flex items-center gap-2">
            <button onClick={handleCopyLink} className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer">
              {copied ? (<>
                  <Check className="h-3.5 w-3.5 text-[#10b981]"/>
                  <span className="text-[#10b981]">Copied</span>
                </>) : (<>
                  <Copy className="h-3.5 w-3.5 text-cyan-400"/>
                  <span>Share Room Link</span>
                </>)}
            </button>
          </div>
        </div>)}
    </div>);
}
