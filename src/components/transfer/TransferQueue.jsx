'use client';
import React from 'react';
import { useTransferStore } from '@/stores/useTransferStore';
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils/formatters';
import { transferManager } from '@/lib/transfer/TransferManager';
import { FileText, Film, Archive, CheckCircle2, Pause, Play, X, ShieldCheck, Activity, Trash2, AlertTriangle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils/clipboard';
export function TransferQueue() {
    const { transfers, removeTransfer, clearCompleted } = useTransferStore();
    if (transfers.length === 0) {
        return null;
    }
    const getFileIcon = (mimeType) => {
        if (mimeType.startsWith('video/'))
            return <Film className="h-5 w-5 text-indigo-600"/>;
        if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) {
            return <Archive className="h-5 w-5 text-purple-600"/>;
        }
        return <FileText className="h-5 w-5 text-blue-600"/>;
    };
    const handlePauseResume = (id, currentStatus) => {
        if (currentStatus === 'paused') {
            transferManager.resume(id);
        }
        else {
            transferManager.pause(id);
        }
    };
    const handleCancel = (id) => {
        transferManager.cancel(id);
        removeTransfer(id);
    };
    return (<div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Activity className="h-4 w-4"/>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Live Transfers
            </h3>
            <p className="text-xs text-slate-500">{transfers.length} active or recent transfer{transfers.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <button onClick={clearCompleted} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
          <Trash2 className="h-3.5 w-3.5"/>
          <span>Clear finished</span>
        </button>
      </div>

      {/* Transfer rows */}
      <div className="mt-4 space-y-3">
        {transfers.map((item) => {
            const isDone = item.status === 'completed';
            const isVerifying = item.status === 'verifying';
            const isFailed = item.status === 'failed';
            const isCancelled = item.status === 'cancelled';
            const isSend = item.direction === 'send';
            return (<div key={item.id} className="group relative rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:bg-white hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-4">
                {/* File info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs">
                    {getFileIcon(item.type)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      {isSend ? (<ArrowUpRight className="h-3.5 w-3.5 text-blue-600 shrink-0"/>) : (<ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 shrink-0"/>)}
                      <span className="truncate">
                        {formatBytes(item.bytesTransferred)} of {formatBytes(item.size)} • {isSend ? 'To' : 'From'}{' '}
                        <span className="font-medium text-slate-700">{item.peerName}</span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {isDone ? (<div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600"/>
                      <span>{isSend ? 'Sent' : 'Received'}</span>
                    </div>) : isVerifying ? (<div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      <ShieldCheck className="h-3.5 w-3.5 animate-pulse text-amber-600"/>
                      <span>Verifying...</span>
                    </div>) : isFailed ? (<div className="flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600"/>
                      <span>Failed</span>
                    </div>) : isCancelled ? (<div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      <span>Cancelled</span>
                    </div>) : (<div className="flex items-center gap-1">
                      {isSend && (<button onClick={() => handlePauseResume(item.id, item.status)} className="rounded-lg p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors" title={item.status === 'paused' ? 'Resume' : 'Pause'}>
                          {item.status === 'paused' ? (<Play className="h-4 w-4"/>) : (<Pause className="h-4 w-4"/>)}
                        </button>)}
                      <button onClick={() => handleCancel(item.id)} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Cancel">
                        <X className="h-4 w-4"/>
                      </button>
                    </div>)}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 relative h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${isDone
                    ? 'bg-emerald-500'
                    : isFailed
                        ? 'bg-rose-500'
                        : 'bg-blue-600'}`} style={{ width: `${item.progress}%` }}/>
              </div>

              {/* Real-time Telemetry footer */}
              <div className="mt-2.5 flex items-center justify-between text-xs text-slate-500 font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-slate-900 font-semibold">{item.progress}%</span>
                  <span>
                    {formatBytes(item.bytesTransferred)} / {formatBytes(item.size)}
                  </span>
                  {item.sha256Verified && (<span className="hidden sm:inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 text-[10px]">
                      <ShieldCheck className="h-3 w-3 text-emerald-600"/>
                      <span>SHA-256 Verified</span>
                      {item.sha256 && (<button onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(item.sha256);
                        }} className="rounded bg-emerald-100 hover:bg-emerald-200 px-1 py-0.2 text-[9px] text-emerald-800 transition-colors" title={`SHA-256: ${item.sha256}\nClick to copy hash`}>
                          {item.sha256.substring(0, 6)}...{item.sha256.slice(-4)}
                        </button>)}
                    </span>)}
                  {isFailed && item.error && (<span className="text-rose-600 text-[11px] truncate max-w-xs">{item.error}</span>)}
                </div>

                {!isDone && !isFailed && !isCancelled && (<div className="flex items-center gap-3">
                    <span className="text-blue-600 font-semibold">{formatSpeed(item.speed)}</span>
                    <span className="text-slate-400">ETA {formatDuration(item.eta)}</span>
                  </div>)}
              </div>
            </div>);
        })}
      </div>
    </div>);
}
