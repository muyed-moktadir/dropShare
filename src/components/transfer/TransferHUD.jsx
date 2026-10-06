'use client';
import React, { useState, useEffect } from 'react';
import { useTransferStore } from '@/stores/useTransferStore';
import { formatBytes, formatSpeed } from '@/lib/utils/formatters';
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, X, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
export function TransferHUD() {
    const { transfers } = useTransferStore();
    const [isExpanded, setIsExpanded] = useState(false);
    const [dismissedId, setDismissedId] = useState(null);
    // Find active transfer, or fallback to the latest transfer
    const activeTransfer = transfers.find((t) => t.status === 'transferring' || t.status === 'verifying');
    const latestTransfer = activeTransfer || transfers[0];
    // Auto-dismiss 3.5 seconds after a transfer completes or fails
    useEffect(() => {
        if (latestTransfer && (latestTransfer.status === 'completed' || latestTransfer.status === 'failed')) {
            const timer = setTimeout(() => {
                setDismissedId(latestTransfer.id);
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [latestTransfer?.id, latestTransfer?.status]);
    if (!latestTransfer || latestTransfer.id === dismissedId) {
        return null;
    }
    const isComplete = latestTransfer.status === 'completed';
    const isFailed = latestTransfer.status === 'failed';
    return (<div className="fixed bottom-22 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] select-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Floating Mini Player Widget */}
      <div className={`rounded-2xl bg-white/95 backdrop-blur-xl border p-3.5 transition-all duration-300 ${isComplete
            ? 'border-emerald-200 shadow-[0_16px_40px_-8px_rgba(16,185,129,0.18)]'
            : isFailed
                ? 'border-rose-200 shadow-[0_16px_40px_-8px_rgba(244,63,94,0.18)]'
                : 'border-slate-200/90 shadow-[0_16px_40px_-8px_rgba(15,23,42,0.14)]'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${isComplete
            ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
            : isFailed
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : latestTransfer.direction === 'send'
                    ? 'bg-blue-50 border-blue-100 text-blue-600'
                    : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              {isComplete ? (<CheckCircle2 className="h-5 w-5 text-emerald-600 animate-in zoom-in-75 duration-200"/>) : isFailed ? (<AlertCircle className="h-5 w-5 text-rose-600"/>) : latestTransfer.direction === 'send' ? (<ArrowUpRight className="h-5 w-5 text-blue-600"/>) : (<ArrowDownLeft className="h-5 w-5 text-emerald-600"/>)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {latestTransfer.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {latestTransfer.progress}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                {isComplete ? (<span className="text-emerald-700 font-semibold flex items-center gap-1">
                    ✓ Complete • {formatBytes(latestTransfer.size)}
                  </span>) : isFailed ? (<span className="text-rose-600 font-semibold">Transfer failed</span>) : (<span>
                    {formatSpeed(latestTransfer.speed)} • {formatBytes(latestTransfer.bytesTransferred)} / {formatBytes(latestTransfer.size)}
                  </span>)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {transfers.length > 1 && (<button onClick={() => setIsExpanded(!isExpanded)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer" title={isExpanded ? 'Collapse' : 'Expand full queue'}>
                {isExpanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
              </button>)}
            <button onClick={() => setDismissedId(latestTransfer.id)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer" title="Dismiss notification (History is preserved)">
              <X className="h-4 w-4"/>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-200 ${isComplete
            ? 'bg-emerald-500'
            : isFailed
                ? 'bg-rose-500'
                : 'bg-blue-600'}`} style={{ width: `${latestTransfer.progress}%` }}/>
        </div>

        {/* Expandable full queue list */}
        {isExpanded && (<div className="mt-3 pt-3 border-t border-slate-100 max-h-56 overflow-y-auto space-y-2">
            {transfers.slice(0, 5).map((item) => (<div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="truncate mr-2">
                  <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {formatBytes(item.size)} • {item.peerName}
                  </p>
                </div>
                <span className="font-mono text-xs text-blue-600 font-semibold shrink-0">
                  {item.status === 'completed' ? '✓' : `${item.progress}%`}
                </span>
              </div>))}
          </div>)}
      </div>
    </div>);
}
