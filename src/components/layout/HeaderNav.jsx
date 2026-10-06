'use client';
import React, { useState } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { useUIStore } from '@/stores/useUIStore';
import { Radio, Terminal, HardDrive, Activity, Sliders, Edit3, Check, Tv, Menu, X, } from 'lucide-react';
import { SessionCapsule } from './SessionCapsule';
export function HeaderNav() {
    const { localDevice, setLocalDeviceName, signalingStatus, roomId, isHost } = usePeerStore();
    const { activeTab, setActiveTab, setCommandPaletteOpen } = useUIStore();
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(localDevice.name);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const handleSaveName = () => {
        if (tempName.trim()) {
            setLocalDeviceName(tempName.trim());
        }
        setIsEditingName(false);
    };
    const navItems = [
        { id: 'transfer', label: 'Transfer', icon: HardDrive },
        { id: 'screenshare', label: 'Screen Share', icon: Tv },
        { id: 'diagnostics', label: 'Diagnostics', icon: Sliders },
        { id: 'activity', label: 'Activity', icon: Activity },
    ];
    const handleNavClick = (id) => {
        setActiveTab(id);
        setMobileMenuOpen(false);
    };
    return (<header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      {/* ── Main header row ── */}
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">

        {/* LEFT: Brand / Logo */}
        <div className="flex shrink-0 items-center gap-3 min-w-0">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/25">
            <Radio className="h-4 w-4 text-white"/>
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"/>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                Drop<span className="text-blue-600">Sphere</span>
              </span>
              <span className="hidden sm:inline rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200">
                P2P MESH
              </span>
            </div>
            {/* Signaling status */}
            <p className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-mono truncate">
              <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${signalingStatus === 'connected'
            ? 'bg-emerald-500'
            : signalingStatus === 'connecting' || signalingStatus === 'reconnecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-slate-400'}`}/>
              <span className="truncate">
                {signalingStatus === 'connected'
            ? `${roomId || 'Subnet'} · Online`
            : signalingStatus === 'connecting' || signalingStatus === 'reconnecting'
                ? 'Connecting Hub...'
                : 'Standalone'}
              </span>
            </p>
          </div>
        </div>

        {/* CENTER: Desktop Nav Tabs & Dynamic Session Capsule */}
        <div className="hidden md:flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
            {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${isActive
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}/>
                  <span>{item.label}</span>
                </button>);
        })}
          </nav>

          {/* Apple Dynamic Island Session Capsule */}
          <SessionCapsule />
        </div>

        {/* RIGHT: Device Identifier & Cmd+K */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile view of Session Capsule */}
          <div className="md:hidden">
            <SessionCapsule />
          </div>

          {/* Device name badge (Clean White Card) */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 shadow-2xs">
            <span className="text-[10px] uppercase font-mono text-slate-400">Device:</span>
            {isEditingName ? (<div className="flex items-center gap-1">
                <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveName()} className="w-24 bg-white border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-900 outline-none" autoFocus/>
                <button onClick={handleSaveName} className="text-emerald-600 hover:text-emerald-700">
                  <Check className="h-3.5 w-3.5"/>
                </button>
              </div>) : (<div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-800 max-w-[100px] truncate">{localDevice.name}</span>
                <button onClick={() => { setTempName(localDevice.name); setIsEditingName(true); }} className="text-slate-400 hover:text-blue-600">
                  <Edit3 className="h-3 w-3"/>
                </button>
              </div>)}
          </div>

          {/* Cmd+K palette — desktop only */}
          <button onClick={() => setCommandPaletteOpen(true)} className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 transition-all font-mono shadow-2xs cursor-pointer">
            <Terminal className="h-3.5 w-3.5 text-blue-600"/>
            <span>Cmd+K</span>
          </button>

          {/* Hamburger menu — mobile only */}
          <button onClick={() => setMobileMenuOpen((prev) => !prev)} className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all" aria-label="Open navigation menu">
            {mobileMenuOpen ? <X className="h-4 w-4"/> : <Menu className="h-4 w-4"/>}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown nav ── */}
      {mobileMenuOpen && (<div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1.5 shadow-lg">
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-mono text-slate-500">
            <span className={`inline-block h-2 w-2 rounded-full ${signalingStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}/>
            <span>{signalingStatus === 'connected' ? `${roomId} · Online` : 'Connecting...'}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-2">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (<button key={item.id} onClick={() => handleNavClick(item.id)} className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all ${isActive
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-slate-600 hover:bg-slate-50'}`}>
                  <Icon className="h-4 w-4"/>
                  <span>{item.label}</span>
                </button>);
            })}
          </div>
        </div>)}
    </header>);
}
