'use client';
import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePeerStore } from '@/stores/usePeerStore';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { Crown, User, ChevronDown, Copy, Check, ShieldCheck, X, } from 'lucide-react';
export function SessionCapsule() {
    const { isHost, roomId, peers, hostPeerId, serverLanIp } = usePeerStore();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const popoverRef = useRef(null);
    const hostPeer = peers.find((p) => p.id === hostPeerId);
    const roomLabel = roomId ? roomId.replace('lan-', '').toUpperCase() : 'MAIN';
    // Compute join URL
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
            setTimeout(() => setCopied(false), 2000);
        }
    };
    // Generate QR on popover open
    useEffect(() => {
        if (!isOpen)
            return;
        const url = getInviteUrl();
        QRCode.toDataURL(url, {
            width: 240,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
        })
            .then((dataUrl) => setQrDataUrl(dataUrl))
            .catch((err) => console.error(err));
    }, [isOpen, roomId, serverLanIp]);
    // Click outside to close popover
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);
    return (<div className="relative" ref={popoverRef}>
      {/* ── Apple Studio Dynamic Island Capsule Trigger ── */}
      <button onClick={() => setIsOpen((prev) => !prev)} className={`group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer border shadow-2xs ${isOpen
            ? 'bg-blue-50 border-blue-300 text-blue-900'
            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'}`}>
        {/* Presence pulse dot */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
        </span>

        {/* Role & Room Status */}
        {isHost ? (<div className="flex items-center gap-1.5 font-semibold">
            <Crown className="h-3 w-3 text-amber-500"/>
            <span className="text-amber-800 font-bold">Host</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-blue-700">Room: {roomLabel}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 font-mono">
              {peers.length} {peers.length === 1 ? 'Peer' : 'Peers'}
            </span>
          </div>) : (<div className="flex items-center gap-1.5 font-semibold">
            <User className="h-3 w-3 text-blue-600"/>
            <span className="text-blue-800 font-bold">Guest</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600 truncate max-w-[130px] sm:max-w-none">
              Host: {hostPeer?.name || 'My Windows PC'}
            </span>
          </div>)}

        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-700' : 'group-hover:text-slate-600'}`}/>
      </button>

      {/* ── Apple-Style Studio Popover (Pure White) ── */}
      {isOpen && (<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 p-5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-lg border ${isHost ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-blue-200 bg-blue-50 text-blue-600'}`}>
                {isHost ? <Crown className="h-3.5 w-3.5"/> : <User className="h-3.5 w-3.5"/>}
              </span>
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  {isHost ? 'Active Room Session (You are Host)' : 'Guest Session Active'}
                </h4>
                <p className="text-[10px] font-mono text-slate-500">
                  Room: {roomId || 'cluster-main'}
                </p>
              </div>
            </div>

            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-all cursor-pointer">
              <X className="h-4 w-4"/>
            </button>
          </div>

          {/* QR Code Section (High Contrast Black on White) */}
          <div className="my-4 flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200 p-4">
            {qrDataUrl ? (<img src={qrDataUrl} alt="DropSphere QR" className="h-48 w-48 rounded-lg shadow-xs border border-slate-200 bg-white p-1"/>) : (<div className="h-48 w-48 rounded-lg bg-slate-200 animate-pulse"/>)}
            <p className="mt-2.5 text-[11px] text-slate-600 text-center font-mono">
              Scan with phone camera to auto-join as Guest
            </p>
          </div>

          {/* Action Button: Copy Invite Link */}
          <button onClick={handleCopyLink} className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-semibold transition-all cursor-pointer border shadow-xs ${copied
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white shadow-blue-500/20'}`}>
            {copied ? (<>
                <Check className="h-4 w-4 text-emerald-600"/>
                <span>Invite Link Copied to Clipboard!</span>
              </>) : (<>
                <Copy className="h-4 w-4 text-white"/>
                <span>Copy Guest Invite Link</span>
              </>)}
          </button>

          {/* Privacy & Protocol Footer */}
          <div className="mt-3.5 flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2.5 border-t border-slate-100">
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <ShieldCheck className="h-3.5 w-3.5"/> P2P Direct Encrypted
            </span>
            <span>Zero Cloud Storage</span>
          </div>
        </div>)}
    </div>);
}
