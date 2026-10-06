'use client';
import React, { useRef, useState, useMemo } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useUIStore } from '@/stores/useUIStore';
import { useTransferStore } from '@/stores/useTransferStore';
import { formatSpeed } from '@/lib/utils/formatters';
import { Laptop, Smartphone, Tablet, Monitor, FileUp, UploadCloud, CheckCircle2, Sparkles, QrCode, Send, Radio, Zap, ShieldCheck, Search, Copy, Loader2, ArrowUpRight, } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/clipboard';
export function AirDropCanvas() {
    const fileInputRef = useRef(null);
    const [targetedPeerId, setTargetedPeerId] = useState(null);
    const [isWindowDragOver, setIsWindowDragOver] = useState(false);
    const [activeHoverPeerId, setActiveHoverPeerId] = useState(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const { peers, roomId, serverLanIp, localDevice, } = usePeerStore();
    const { transfers } = useTransferStore();
    const { sendFile } = useWebRTC();
    const { setQRModalOpen } = useUIStore();
    const roomCode = roomId || 'ALPHA';
    let host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    if ((host === 'localhost' || host === '127.0.0.1') && serverLanIp) {
        host = serverLanIp;
    }
    const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const inviteUrl = `${protocol}//${host}${port}/#join=${encodeURIComponent(roomCode)}`;
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };
    const handleCopyLink = async () => {
        const ok = await copyToClipboard(inviteUrl);
        if (ok) {
            setCopiedLink(true);
            showToast('Invite link copied!');
            setTimeout(() => setCopiedLink(false), 2000);
        }
    };
    const selectFileForPeer = (peerId) => {
        setTargetedPeerId(peerId);
        fileInputRef.current?.click();
    };
    const selectFileForBroadcast = () => {
        setTargetedPeerId(null);
        fileInputRef.current?.click();
    };
    const handleFiles = async (files, targetPeerId) => {
        if (!files || files.length === 0)
            return;
        if (peers.length === 0) {
            showToast('No devices connected. Share your room code first.');
            return;
        }
        for (const file of Array.from(files)) {
            try {
                await sendFile(file, targetPeerId || undefined);
                showToast(`Sending "${file.name}"...`);
            }
            catch (err) {
                console.error('File send error:', err);
                const msg = err instanceof Error ? err.message : 'Transfer failed';
                showToast(`Error: ${msg}`);
            }
        }
    };
    const onPeerDragOver = (e, peerId) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveHoverPeerId(peerId);
    };
    const onPeerDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveHoverPeerId(null);
    };
    const onPeerDrop = (e, peerId) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveHoverPeerId(null);
        setIsWindowDragOver(false);
        handleFiles(e.dataTransfer.files, peerId);
    };
    const onCanvasDragOver = (e) => {
        e.preventDefault();
        setIsWindowDragOver(true);
    };
    const onCanvasDragLeave = (e) => {
        if (e.currentTarget.contains(e.relatedTarget))
            return;
        setIsWindowDragOver(false);
    };
    const onCanvasDrop = (e) => {
        e.preventDefault();
        setIsWindowDragOver(false);
        handleFiles(e.dataTransfer.files, null);
    };
    const getDeviceIcon = (type, className = 'h-7 w-7') => {
        if (type === 'mobile')
            return <Smartphone className={className}/>;
        if (type === 'tablet')
            return <Tablet className={className}/>;
        if (type === 'desktop')
            return <Monitor className={className}/>;
        return <Laptop className={className}/>;
    };
    // Filter peers based on search & category
    const filteredPeers = useMemo(() => {
        return peers.filter((p) => {
            const matchesSearch = searchQuery === '' ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.os.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = categoryFilter === 'all'
                ? true
                : categoryFilter === 'laptop'
                    ? p.type === 'laptop' || p.type === 'desktop'
                    : p.type === 'mobile' || p.type === 'tablet';
            return matchesSearch && matchesCat;
        });
    }, [peers, searchQuery, categoryFilter]);
    const laptopCount = useMemo(() => peers.filter((p) => p.type === 'laptop' || p.type === 'desktop').length, [peers]);
    const mobileCount = useMemo(() => peers.filter((p) => p.type === 'mobile' || p.type === 'tablet').length, [peers]);
    return (<div onDragOver={onCanvasDragOver} onDragLeave={onCanvasDragLeave} onDrop={onCanvasDrop} className="relative w-full h-[420px] sm:h-[430px] flex flex-col justify-between rounded-3xl bg-white/85 backdrop-blur-2xl border border-white/80 shadow-[0_20px_60px_-15px_rgba(37,99,235,0.08),0_0_1px_1px_rgba(255,255,255,0.9)_inset] p-4 sm:p-5 transition-all duration-300 overflow-hidden select-none">
      {/* ── Soft Ambient Spatial Aura ── */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 bg-gradient-to-br from-blue-400/12 via-indigo-300/8 to-transparent rounded-full blur-3xl"/>
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 bg-gradient-to-tl from-cyan-400/12 via-blue-500/8 to-transparent rounded-full blur-3xl"/>
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-500/4 to-purple-500/4 rounded-full blur-3xl"/>

      {/* Hidden File Input */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
            handleFiles(e.target.files, targetedPeerId);
            setTargetedPeerId(null);
            e.target.value = '';
        }}/>

      {/* Toast Notification */}
      {toastMessage && (<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-950/90 backdrop-blur-md text-white px-4 py-1.5 text-xs font-medium shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2 duration-150">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse"/>
          <span>{toastMessage}</span>
        </div>)}

      {/* ── Interactive Drag Overlay ── */}
      {isWindowDragOver && (<div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-blue-600/90 backdrop-blur-md pointer-events-none text-white animate-in fade-in duration-150">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white shadow-2xl animate-bounce mb-3 border border-white/30 backdrop-blur-lg">
            <FileUp className="h-8 w-8"/>
          </div>
          <p className="text-base font-bold tracking-tight">
            {activeHoverPeerId ? 'Drop to send to this device!' : 'Drop anywhere to send to all connected devices'}
          </p>
          <p className="text-xs text-blue-100/90 mt-1 font-mono">Direct encrypted WebRTC DataChannel stream</p>
        </div>)}

      {/* ── Fixed Top Header Bar (Zero Layout Shift) ── */}
      <div className="relative z-20 flex-none flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100/80">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-[1px] shadow-sm shadow-blue-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[15px] bg-white/90 backdrop-blur-sm text-blue-600">
              <Radio className="h-4 w-4"/>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
                AirDrop Studio
              </h3>
              {peers.length > 0 ? (<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                  {peers.length} {peers.length === 1 ? 'Peer Online' : 'Peers Online'}
                </span>) : (<span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"/>
                  Scanning LAN...
                </span>)}
            </div>
            <p className="text-[11px] text-slate-400">
              Direct P2P DataChannel Transfer · Zero Cloud Storage
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {peers.length > 1 && (<button onClick={selectFileForBroadcast} title="Broadcast file to all connected devices simultaneously" className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs px-3.5 py-1.5 transition-all shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer">
              <UploadCloud className="h-3.5 w-3.5"/>
              <span>Broadcast All ({peers.length})</span>
            </button>)}

          <button onClick={() => setQRModalOpen(true)} title="Pair another phone or laptop via QR code" className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 hover:bg-white text-slate-700 font-medium text-xs px-3.5 py-1.5 transition-all cursor-pointer shadow-xs hover:shadow active:scale-95 backdrop-blur-sm">
            <QrCode className="h-3.5 w-3.5 text-blue-600"/>
            <span>Pair Device</span>
          </button>
        </div>
      </div>

      {/* ── Main Dynamic Stage (Strict Scroll Isolation, Never Overflows) ── */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex flex-col justify-center items-center overflow-y-auto custom-scrollbar px-1 py-1">
        {peers.length === 0 ? (
        /* ──────── STATE 1: Apple Spatial Sonar (0 Devices) ──────── */
        <div className="flex flex-col items-center justify-center text-center my-auto py-2">
            {/* Concentric Breathing Sonar Ripples */}
            <div className="relative flex items-center justify-center mb-3">
              <div className="absolute w-36 h-36 rounded-full border border-blue-400/20 bg-blue-500/5 animate-ping opacity-30 pointer-events-none"/>
              <div className="absolute w-28 h-28 rounded-full border border-indigo-400/30 bg-indigo-500/5 animate-pulse pointer-events-none"/>

              {/* Local Host Node */}
              <div className="relative flex h-18 w-18 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-xl shadow-blue-500/25 border border-white/40">
                {getDeviceIcon(localDevice.type, 'h-9 w-9 text-white drop-shadow-sm')}
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-sm"/>
                </span>
              </div>
            </div>

            <h4 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Looking for Nearby Devices
            </h4>

            {/* Dynamic Room Code Capsule */}
            <div className="mt-1.5 flex items-center gap-2 rounded-full bg-slate-100/90 border border-slate-200/80 px-3 py-1 text-xs font-medium text-slate-600">
              <Radio className="h-3.5 w-3.5 text-blue-600 animate-pulse"/>
              <span>Broadcasting on LAN Room:</span>
              <strong className="text-slate-900 font-mono font-semibold tracking-wider bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {roomCode}
              </strong>
            </div>

            <p className="mt-1.5 text-xs text-slate-400 max-w-sm leading-relaxed">
              Open DropSphere on another phone, tablet, or PC to pair seamlessly over Wi-Fi
            </p>

            {/* Quick Pair Actions */}
            <div className="mt-4 flex items-center gap-2.5">
              <button onClick={() => setQRModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-xs px-4 py-2 transition-all shadow-sm shadow-blue-500/25 active:scale-95 cursor-pointer">
                <QrCode className="h-3.5 w-3.5"/>
                <span>Pair Phone (QR)</span>
              </button>

              <button onClick={handleCopyLink} className="flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/90 hover:bg-white text-slate-700 font-medium text-xs px-3.5 py-2 transition-all shadow-xs hover:shadow active:scale-95 cursor-pointer backdrop-blur-sm">
                {copiedLink ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600"/> : <Copy className="h-3.5 w-3.5 text-blue-600"/>}
                <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          </div>) : peers.length <= 4 ? (
        /* ──────── STATE 2: Apple AirDrop Spatial Orbit (1 to 4 Devices) ──────── */
        <div className="w-full flex flex-col items-center justify-center my-auto">
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 max-w-2xl mx-auto">
              {peers.map((peer) => {
                const isHovered = activeHoverPeerId === peer.id;
                // Find active transfer for this peer
                const activeTransfer = transfers.find((t) => (t.peerId === peer.id || t.peerId === 'broadcast') &&
                    (t.status === 'transferring' || t.status === 'verifying'));
                const isTransferring = !!activeTransfer;
                const progress = activeTransfer ? activeTransfer.progress : 0;
                // SVG Circular Progress calculation (Radius = 38, Circumference = 2 * PI * 38 = 238.76)
                const radius = 38;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (progress / 100) * circumference;
                return (<div key={peer.id} onDragOver={(e) => onPeerDragOver(e, peer.id)} onDragLeave={onPeerDragLeave} onDrop={(e) => onPeerDrop(e, peer.id)} onClick={() => selectFileForPeer(peer.id)} className="group relative flex flex-col items-center cursor-pointer transition-all duration-300">
                    {/* Circular Avatar Node with Perimeter SVG Progress Ring */}
                    <div className="relative flex items-center justify-center">
                      <svg className="w-22 h-22 transform -rotate-90">
                        {/* Background track ring */}
                        <circle cx="44" cy="44" r={radius} className="stroke-slate-200/80 fill-none" strokeWidth="3"/>
                        {/* Active Progress or Hover Ring */}
                        {isTransferring ? (<circle cx="44" cy="44" r={radius} className="stroke-blue-600 fill-none transition-all duration-300 drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]" strokeWidth="3.5" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"/>) : isHovered ? (<circle cx="44" cy="44" r={radius} className="stroke-blue-500 fill-none animate-pulse drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" strokeWidth="3.5" strokeLinecap="round"/>) : null}
                      </svg>

                      {/* Center Glass Node */}
                      <div className={`absolute inset-2 flex items-center justify-center rounded-full backdrop-blur-xl transition-all duration-300 ${isHovered
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 scale-105'
                        : isTransferring
                            ? 'bg-blue-50 border border-blue-400 text-blue-600 shadow-md shadow-blue-500/20'
                            : 'bg-white/90 border border-slate-200/90 text-slate-700 shadow-sm group-hover:scale-105 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:shadow-md'}`}>
                        {isTransferring ? (<div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-bold font-mono text-blue-600">
                              {progress}%
                            </span>
                            <span className="text-[9px] text-blue-500 font-medium">
                              {formatSpeed(activeTransfer.speed)}
                            </span>
                          </div>) : (getDeviceIcon(peer.type, 'h-7 w-7'))}
                      </div>

                      {/* Online Status Beacon */}
                      {!isTransferring && (<span className="absolute top-1 right-1 flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white shadow-xs"/>
                        </span>)}
                    </div>

                    {/* Device Name */}
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight text-center max-w-[120px] truncate group-hover:text-blue-600 transition-colors mt-2">
                      {peer.name}
                    </h4>

                    {/* Dynamic Status / OS Badge */}
                    {isTransferring ? (<div className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-mono font-medium animate-pulse">
                        <Loader2 className="h-2.5 w-2.5 animate-spin"/>
                        <span>Sending...</span>
                      </div>) : (<div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100/80 border border-slate-200/60 text-[10px] text-slate-500 font-medium">
                        <span className="capitalize">{peer.os || peer.type}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-emerald-700 font-mono font-semibold">{peer.ping || 4}ms</span>
                      </div>)}

                    {/* Send Files Action Pill */}
                    <div className="mt-2">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium transition-all ${isHovered
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white/80 border border-slate-200/80 text-slate-600 group-hover:border-blue-400 group-hover:text-blue-600 shadow-2xs'}`}>
                        <Send className="h-2.5 w-2.5"/>
                        <span>{isHovered ? 'Drop to Send' : 'Send Files'}</span>
                      </span>
                    </div>
                  </div>);
            })}
            </div>

            {/* Subtle Helper Tip */}
            <p className="mt-4 text-[11px] text-slate-400 text-center font-medium">
              💡 Tap any device to pick files, or drag and drop files directly onto a node
            </p>
          </div>) : (
        /* ──────── STATE 3: Google Quick Share Scalable Matrix (5 to 50+ Devices) ──────── */
        <div className="w-full flex flex-col h-full max-w-4xl mx-auto py-1">
            {/* Filter & Search Bar */}
            <div className="flex-none flex items-center justify-between gap-2 mb-2 px-1">
              {/* Category Pills */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => setCategoryFilter('all')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${categoryFilter === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}>
                  All ({peers.length})
                </button>
                {laptopCount > 0 && (<button onClick={() => setCategoryFilter('laptop')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${categoryFilter === 'laptop'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}>
                    Laptops ({laptopCount})
                  </button>)}
                {mobileCount > 0 && (<button onClick={() => setCategoryFilter('mobile')} className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${categoryFilter === 'mobile'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'}`}>
                    Phones ({mobileCount})
                  </button>)}
              </div>

              {/* Fast Search Filter */}
              {peers.length > 5 && (<div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none"/>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter devices..." className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-white/90 focus:outline-none focus:border-blue-500 w-36 sm:w-48 placeholder:text-slate-400"/>
                </div>)}
            </div>

            {/* Scrollable Compact Capsule Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 content-start">
              {filteredPeers.map((peer) => {
                const isHovered = activeHoverPeerId === peer.id;
                const activeTransfer = transfers.find((t) => (t.peerId === peer.id || t.peerId === 'broadcast') &&
                    (t.status === 'transferring' || t.status === 'verifying'));
                const isTransferring = !!activeTransfer;
                const progress = activeTransfer ? activeTransfer.progress : 0;
                return (<div key={peer.id} onDragOver={(e) => onPeerDragOver(e, peer.id)} onDragLeave={onPeerDragLeave} onDrop={(e) => onPeerDrop(e, peer.id)} onClick={() => selectFileForPeer(peer.id)} className={`group relative flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer ${isHovered
                        ? 'border-blue-500 bg-blue-50/80 shadow-md ring-2 ring-blue-500/20'
                        : 'border-slate-200/80 bg-white/80 hover:bg-white hover:border-blue-300 hover:shadow-xs'}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Compact Squircle Avatar */}
                      <div className="relative flex-none">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isHovered
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-blue-600 group-hover:bg-blue-50'}`}>
                          {getDeviceIcon(peer.type, 'h-5 w-5')}
                        </div>
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"/>
                        </span>
                      </div>

                      {/* Device Details */}
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {peer.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                          <span className="capitalize">{peer.os || peer.type}</span>
                          <span>·</span>
                          <span className="text-emerald-700 font-mono font-semibold">{peer.ping || 4}ms</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Action / Progress */}
                    <div className="flex-none pl-2">
                      {isTransferring ? (<div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-blue-600 font-mono">
                            {progress}%
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {formatSpeed(activeTransfer.speed)}
                          </span>
                        </div>) : (<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <ArrowUpRight className="h-3.5 w-3.5"/>
                        </div>)}
                    </div>
                  </div>);
            })}
            </div>
          </div>)}
      </div>

      {/* ── Fixed Sub-Footer (Unified Spatial Specs) ── */}
      <div className="relative z-20 flex-none pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500 font-mono tracking-tight">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-700 font-medium">
            <Zap className="h-3 w-3 text-blue-600"/> Direct P2P Stream
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-600"/> WebRTC Encrypted
          </span>
        </div>
        <span className="text-slate-400">Room: <strong className="text-slate-700 font-bold">{roomCode}</strong> · 100% Private LAN</span>
      </div>
    </div>);
}
