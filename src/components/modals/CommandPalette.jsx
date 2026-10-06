'use client';
import React, { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { useTransferStore } from '@/stores/useTransferStore';
import { Search, HardDrive, Tv, Sliders, Smartphone, Trash2, ArrowRight, X } from 'lucide-react';
export function CommandPalette() {
    const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveTab, setQRModalOpen, } = useUIStore();
    const { clearCompleted } = useTransferStore();
    const [query, setQuery] = useState('');
    // Global keydown listener for Cmd+K and Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(!isCommandPaletteOpen);
            }
            if (e.key === 'Escape' && isCommandPaletteOpen) {
                setCommandPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCommandPaletteOpen, setCommandPaletteOpen]);
    if (!isCommandPaletteOpen)
        return null;
    const actions = [
        {
            id: 'transfer',
            title: 'File Transfer Center',
            category: 'Workspace',
            icon: HardDrive,
            run: () => {
                setActiveTab('transfer');
                setCommandPaletteOpen(false);
            },
        },
        {
            id: 'screenshare',
            title: 'Start Screen Cast (60 FPS)',
            category: 'Display',
            icon: Tv,
            run: () => {
                setActiveTab('screenshare');
                setCommandPaletteOpen(false);
            },
        },
        {
            id: 'pair-mobile',
            title: 'Pair Mobile Device via QR',
            category: 'Devices',
            icon: Smartphone,
            run: () => {
                setCommandPaletteOpen(false);
                setQRModalOpen(true);
            },
        },
        {
            id: 'diagnostics',
            title: 'WebRTC & Network Diagnostics',
            category: 'System',
            icon: Sliders,
            run: () => {
                setActiveTab('diagnostics');
                setCommandPaletteOpen(false);
            },
        },
        {
            id: 'clear',
            title: 'Clear Completed Queue',
            category: 'Transfers',
            icon: Trash2,
            run: () => {
                clearCompleted();
                setCommandPaletteOpen(false);
            },
        },
    ];
    const filteredActions = actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));
    return (<div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Search bar */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 bg-slate-50/50">
          <Search className="h-4 w-4 text-slate-400"/>
          <input type="text" placeholder="Type a command or search action..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none" autoFocus/>
          <button onClick={() => setCommandPaletteOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-md hover:bg-slate-200/50">
            <X className="h-4 w-4"/>
          </button>
        </div>

        {/* Action list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filteredActions.map((action) => {
            const Icon = action.icon;
            return (<button key={action.id} onClick={action.run} className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-100 group transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-600 transition-colors">
                    <Icon className="h-4 w-4"/>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{action.title}</p>
                    <span className="text-[10px] text-slate-400 font-medium">{action.category}</span>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"/>
              </button>);
        })}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-400">
          <span>Use arrow keys to navigate</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-200/70 text-[10px] text-slate-600 font-mono">ESC</kbd>
        </div>
      </div>
    </div>);
}
