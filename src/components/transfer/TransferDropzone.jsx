'use client';
import React, { useRef, useState } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { UploadCloud, FileUp, Shield, Zap, AlertCircle, Users, CheckCircle2, Send, Radio, } from 'lucide-react';
export function TransferDropzone() {
    const fileInputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [warningMessage, setWarningMessage] = useState(null);
    const { isHost, peers, activeConnectedPeerId, targetRecipientMode, selectedRecipientIds, hostPeerId, } = usePeerStore();
    const { sendFile } = useWebRTC();
    const hostPeer = peers.find((p) => p.id === hostPeerId);
    const handleFiles = async (files) => {
        if (!files || files.length === 0)
            return;
        if (peers.length === 0 && !activeConnectedPeerId) {
            setWarningMessage('No peer is connected yet. Invite a device to this room first.');
            setTimeout(() => setWarningMessage(null), 4000);
            return;
        }
        setWarningMessage(null);
        for (const file of Array.from(files)) {
            try {
                await sendFile(file);
            }
            catch (err) {
                console.error('Error initiating file transfer:', err);
                const msg = err instanceof Error ? err.message : 'Transfer failed to start';
                setWarningMessage(msg);
                setTimeout(() => setWarningMessage(null), 5000);
            }
        }
    };
    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };
    const onDragLeave = () => {
        setIsDragOver(false);
    };
    const onDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
    };
    return (<div className="w-full space-y-4">
      {/* ── GUEST DUAL-ZONE: FRESH EMERALD RECEIVER BANNER (If User is Guest) ── */}
      {!isHost && (<div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-300 text-emerald-600 shadow-2xs">
                <Radio className="h-6 w-6 animate-pulse"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-xs"/>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Listening for Incoming Transfers
                  </h4>
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  Ready to receive files from <strong className="text-slate-900 font-bold">{hostPeer?.name || 'Room Host'}</strong>. Downloads stream in real-time.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="rounded-full bg-white border border-emerald-300 px-3 py-1 text-xs font-mono font-medium text-emerald-800 shadow-2xs">
                P2P Receiver Active
              </span>
            </div>
          </div>
        </div>)}

      {/* ── MAIN HERO STUDIO DROPZONE (Fresh White Card) ── */}
      <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => fileInputRef.current?.click()} className={`group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed p-10 sm:p-14 transition-all duration-200 text-center ${isDragOver
            ? 'bg-blue-50/70 border-blue-500 shadow-lg scale-[1.006]'
            : 'bg-white border-slate-300 hover:border-blue-400 hover:bg-slate-50/50 shadow-sm'}`}>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)}/>

        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
          {/* Minimalist Floating Tray Icon */}
          <div className={`relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200 ${isDragOver
            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-110'
            : 'bg-blue-50 text-blue-600 border border-blue-200 group-hover:scale-105 shadow-2xs'}`}>
            {isDragOver ? (<FileUp className="h-8 w-8 animate-bounce text-white"/>) : (<UploadCloud className="h-8 w-8 transition-transform group-hover:-translate-y-0.5"/>)}
          </div>

          {/* Action Title */}
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            {isDragOver ? (<span className="text-blue-600">Release to stream directly via WebRTC</span>) : isHost ? ('Drag and drop files to stream instantly') : (`Drop files to send back to Host (${hostPeer?.name || 'Room Host'})`)}
          </h3>

          {/* Subtext description */}
          <p className="mt-1 text-xs text-slate-500">
            or <span className="text-blue-600 font-semibold underline decoration-blue-300 underline-offset-2">browse from your computer or phone</span>
          </p>

          {/* Warning banner if error */}
          {warningMessage && (<div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs text-amber-800 shadow-2xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600"/>
              <span>{warningMessage}</span>
            </div>)}

          {/* Dynamic Target Indicator Pill */}
          <div className="mt-5 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs shadow-2xs">
            <span className="text-slate-400 font-mono text-[10px] font-bold">TARGET:</span>
            {isHost ? (targetRecipientMode === 'selected' ? (<span className="font-semibold text-blue-700 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="h-3 w-3 text-blue-600"/>
                  {selectedRecipientIds.length} Selected Devices
                </span>) : (<span className="font-semibold text-blue-700 flex items-center gap-1.5 font-mono">
                  <Users className="h-3.5 w-3.5 text-blue-600"/>
                  Broadcast to All ({peers.length} Devices)
                </span>)) : (<span className="font-semibold text-blue-700 flex items-center gap-1.5 font-mono">
                <Send className="h-3 w-3 text-blue-600"/>
                Host: {hostPeer?.name || 'Room Host'}
              </span>)}
          </div>

          {/* Clean Protocol Trust Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-600"/> 64KB Direct Slices
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-emerald-600"/> SHA-256 Verified
            </span>
            <span>•</span>
            <span>Zero Cloud Storage</span>
          </div>
        </div>
      </div>
    </div>);
}
