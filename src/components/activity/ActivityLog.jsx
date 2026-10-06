'use client';
import React, { useState } from 'react';
import { useTransferStore } from '@/stores/useTransferStore';
import { formatBytes } from '@/lib/utils/formatters';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { Activity, FileText, Film, Archive, Image as ImageIcon, Code, ArrowUpRight, ArrowDownLeft, ShieldCheck, Search, Trash2, Layers } from 'lucide-react';
export function ActivityLog() {
    const { transfers, clearCompleted, removeTransfer } = useTransferStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [copiedId, setCopiedId] = useState(null);
    const getFileIcon = (mimeType) => {
        if (mimeType.startsWith('video/'))
            return <Film className="h-4 w-4 text-indigo-600"/>;
        if (mimeType.startsWith('image/'))
            return <ImageIcon className="h-4 w-4 text-sky-600"/>;
        if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
            return <Archive className="h-4 w-4 text-purple-600"/>;
        }
        if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html')) {
            return <Code className="h-4 w-4 text-amber-600"/>;
        }
        return <FileText className="h-4 w-4 text-blue-600"/>;
    };
    const filteredTransfers = transfers.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.peerName.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch)
            return false;
        if (filterType === 'send')
            return item.direction === 'send';
        if (filterType === 'receive')
            return item.direction === 'receive';
        if (filterType === 'verified')
            return item.sha256Verified;
        return true;
    });
    const totalBytesTransferred = transfers.reduce((acc, t) => acc + (t.bytesTransferred || t.size), 0);
    const totalCompleted = transfers.filter((t) => t.status === 'completed').length;
    const totalVerified = transfers.filter((t) => t.sha256Verified).length;
    const handleCopyHash = async (hash, id) => {
        const ok = await copyToClipboard(hash);
        if (ok) {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }
    };
    return (<div className="relative w-full h-[420px] sm:h-[430px] flex flex-col justify-between rounded-2xl bg-white border border-slate-200/90 p-4 sm:p-5 shadow-sm transition-all duration-200">
      {/* ── Top Header Bar ── */}
      <div className="flex-none flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
            <Activity className="h-4 w-4"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
                Transfer Activity & History
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-600">
                {transfers.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              WebRTC direct transfers with SHA-256 cryptographic verification
            </p>
          </div>
        </div>

        {/* Header Badges & Actions */}
        <div className="flex items-center gap-2 text-xs">
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 text-[11px]">
            <Layers className="h-3 w-3 text-blue-600"/>
            <span>Volume: <strong className="font-semibold text-slate-900">{formatBytes(totalBytesTransferred)}</strong></span>
          </div>

          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 text-[11px]">
            <ShieldCheck className="h-3 w-3 text-emerald-600"/>
            <span>Verified: <strong className="font-semibold">{totalVerified}</strong></span>
          </div>

          {transfers.length > 0 && (<button onClick={clearCompleted} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">
              <Trash2 className="h-3 w-3"/>
              <span>Clear</span>
            </button>)}
        </div>
      </div>

      {/* ── Content Stage (Fills available height) ── */}
      <div className="flex-1 min-h-0 mt-3 flex flex-col">
        {transfers.length === 0 ? (
        /* Empty State: Fills stage with identical proportion to Screen Broadcast */
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-6 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600 mb-3 shadow-xs">
              <Activity className="h-6 w-6"/>
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
              No Transfers Recorded Yet
            </h4>

            <p className="mt-1 text-xs text-slate-500 max-w-sm leading-relaxed">
              Files you send or receive via AirDrop will appear here in real-time with verified checksums, speed telemetry, and peer stamps.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600"/>
              <span>Client-side SHA-256 integrity verification active</span>
            </div>
          </div>) : (
        /* Populated State: Search, Filter, and Sleek List */
        <div className="flex-1 flex flex-col min-h-0 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-3">
            {/* Filter Bar */}
            <div className="flex-none flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
              <div className="flex items-center gap-1">
                {['all', 'send', 'receive', 'verified'].map((type) => (<button key={type} onClick={() => setFilterType(type)} className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-colors cursor-pointer capitalize ${filterType === type
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'}`}>
                    {type === 'verified' ? 'SHA-256' : type}
                  </button>))}
              </div>

              <div className="relative flex items-center">
                <Search className="absolute left-2.5 h-3 w-3 text-slate-400"/>
                <input type="text" placeholder="Filter files..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-40 sm:w-48 rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 py-0.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 transition-colors"/>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100 pr-1 mt-1">
              {filteredTransfers.map((item) => {
                const isSend = item.direction === 'send';
                return (<div key={item.id} className="group py-2 px-2.5 flex items-center justify-between gap-2 rounded-xl hover:bg-white transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600">
                        {getFileIcon(item.type)}
                      </div>
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-slate-900 truncate max-w-xs">
                          {item.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          {isSend ? (<ArrowUpRight className="h-3 w-3 text-blue-600"/>) : (<ArrowDownLeft className="h-3 w-3 text-emerald-600"/>)}
                          <span>{isSend ? 'To' : 'From'}</span>
                          <strong className="text-slate-700">{item.peerName}</strong>
                          <span>•</span>
                          <span className="font-mono">{formatBytes(item.size)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.sha256 && (<button onClick={() => handleCopyHash(item.sha256, item.id)} className="hidden sm:flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 transition-colors cursor-pointer" title="Click to copy SHA-256 hash">
                          <ShieldCheck className="h-3 w-3 text-emerald-600"/>
                          <span>{copiedId === item.id ? 'Copied' : item.sha256.substring(0, 6)}</span>
                        </button>)}
                      <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Done
                      </span>
                      {/* Individual delete record button */}
                      <button onClick={() => removeTransfer(item.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer" title="Delete from history">
                        <Trash2 className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  </div>);
            })}
            </div>
          </div>)}
      </div>

      {/* ── Footer Status Bar ── */}
      <div className="flex-none pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Persistent Vault Active</span>
        <span>{filteredTransfers.length} records</span>
      </div>
    </div>);
}
