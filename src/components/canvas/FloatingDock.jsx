'use client';
import React from 'react';
import { useUIStore } from '@/stores/useUIStore';
import { usePeerStore } from '@/stores/usePeerStore';
import { Wifi, Tv, Sliders, Activity, QrCode, Command } from 'lucide-react';
export function FloatingDock() {
    const { activeTab, setActiveTab, setQRModalOpen, setCommandPaletteOpen } = useUIStore();
    const { peers } = usePeerStore();
    const dockItems = [
        {
            id: 'transfer',
            label: 'AirDrop Canvas',
            icon: Wifi,
            badge: peers.length > 0 ? peers.length : undefined,
            onClick: () => setActiveTab('transfer'),
            isActive: activeTab === 'transfer',
        },
        {
            id: 'screenshare',
            label: 'Screen Cast (60 FPS)',
            icon: Tv,
            onClick: () => setActiveTab('screenshare'),
            isActive: activeTab === 'screenshare',
        },
        {
            id: 'diagnostics',
            label: 'Network Telemetry',
            icon: Sliders,
            onClick: () => setActiveTab('diagnostics'),
            isActive: activeTab === 'diagnostics',
        },
        {
            id: 'activity',
            label: 'Transfer History',
            icon: Activity,
            onClick: () => setActiveTab('activity'),
            isActive: activeTab === 'activity',
        },
        {
            id: 'qr',
            label: 'Pair Mobile (QR)',
            icon: QrCode,
            onClick: () => setQRModalOpen(true),
        },
        {
            id: 'command',
            label: 'Quick Commands (⌘K)',
            icon: Command,
            onClick: () => setCommandPaletteOpen(true),
        },
    ];
    return (<nav className="relative z-40 select-none">
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_8px_30px_-4px_rgba(15,23,42,0.1)]">
        {dockItems.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = item.isActive;
            return (<div key={item.id} className="flex items-center">
              {/* Optional divider before utility triggers */}
              {(idx === 4) && (<div className="h-6 w-[1px] bg-slate-200 mx-1"/>)}

              <button onClick={item.onClick} className={`group relative flex flex-col items-center justify-center h-11 w-11 rounded-xl transition-all duration-150 cursor-pointer ${isSelected
                    ? 'bg-blue-600 text-white shadow-sm scale-105'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:scale-105'}`} title={item.label}>
                <Icon className="h-5 w-5"/>

                {/* Badge if any */}
                {item.badge !== undefined && (<span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white shadow-xs">
                    {item.badge}
                  </span>)}

                {/* Active Indicator dot underneath */}
                {isSelected && (<span className="absolute -bottom-1 h-1 w-1 rounded-full bg-blue-600"/>)}

                {/* macOS Hover Tooltip */}
                <span className="pointer-events-none absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            </div>);
        })}
      </div>
    </nav>);
}
