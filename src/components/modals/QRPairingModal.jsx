'use client';
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useUIStore } from '@/stores/useUIStore';
import { usePeerStore } from '@/stores/usePeerStore';
import { X, Smartphone, Copy, Check, ShieldCheck } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/clipboard';
export function QRPairingModal() {
    const { isQRModalOpen, setQRModalOpen } = useUIStore();
    const { roomId, serverLanIp, setServerLanIp } = usePeerStore();
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const roomCode = roomId || 'DROPSPHERE';
    // Derive target host: if desktop accessed via localhost, use dynamic LAN IP so mobile can reach it
    let host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    if ((host === 'localhost' || host === '127.0.0.1') && serverLanIp) {
        host = serverLanIp;
    }
    const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const encodedRoom = encodeURIComponent(roomCode);
    const sessionUrl = `${protocol}//${host}${port}/#join=${encodedRoom}`;
    useEffect(() => {
        if (!isQRModalOpen)
            return;
        const currentHost = window.location.hostname || 'localhost';
        fetch(`http://${currentHost}:4000/lan-ip`)
            .then((r) => r.json())
            .then((data) => {
            if (data.lanIp && data.lanIp !== '127.0.0.1') {
                setServerLanIp(data.lanIp);
            }
        })
            .catch(() => { });
        QRCode.toDataURL(sessionUrl, {
            width: 280,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff',
            },
        })
            .then((dataUrl) => setQrDataUrl(dataUrl))
            .catch((err) => console.error(err));
    }, [isQRModalOpen, sessionUrl, setServerLanIp]);
    if (!isQRModalOpen)
        return null;
    const handleCopy = async () => {
        const success = await copyToClipboard(sessionUrl);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };
    return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200/80">
        {/* Close button */}
        <button onClick={() => setQRModalOpen(false)} className="absolute top-4 right-4 rounded-xl p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer">
          <X className="h-4 w-4"/>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
            <Smartphone className="h-5 w-5"/>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Instant Device Pairing</h3>
            <p className="text-xs text-slate-500">Scan with iPhone Camera or Android Chrome</p>
          </div>
        </div>

        {/* QR Code Container */}
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6">
          {qrDataUrl ? (<div className="bg-white p-2 rounded-xl shadow-xs border border-slate-200">
              <img src={qrDataUrl} alt="DropSphere QR Session" className="h-52 w-52 rounded-lg"/>
            </div>) : (<div className="h-52 w-52 rounded-xl bg-slate-200 animate-pulse"/>)}

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Session Room Code:</span>
            <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-mono font-bold text-blue-700 tracking-wider">
              {roomCode}
            </span>
          </div>
        </div>

        {/* Copy session link */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
          <span className="truncate text-xs font-mono text-slate-600 max-w-[260px]">
            {sessionUrl}
          </span>
          <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer shadow-xs">
            {copied ? <Check className="h-3.5 w-3.5"/> : <Copy className="h-3.5 w-3.5"/>}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Privacy reassurance footer */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600"/>
          <span>Zero cloud relay. Devices handshake directly over local Wi-Fi.</span>
        </div>
      </div>
    </div>);
}
