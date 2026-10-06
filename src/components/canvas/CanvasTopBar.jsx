'use client';
import React, { useState } from 'react';
import { usePeerStore } from '@/stores/usePeerStore';
import { SessionCapsule } from '@/components/layout/SessionCapsule';
import { Laptop, Edit3, Check, Wifi } from 'lucide-react';
export function CanvasTopBar() {
    const { localDevice, setLocalDeviceName, signalingStatus } = usePeerStore();
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(localDevice.name);
    const handleNameSave = () => {
        if (nameInput.trim()) {
            setLocalDeviceName(nameInput.trim());
        }
        setIsEditingName(false);
    };
    return (<header className="relative z-30 w-full flex items-center justify-between gap-4 py-3">
      {/* ── Left Pill: App Logo & Editable Device Tag ── */}
      <div className="flex items-center gap-2.5">
        {/* Brand Icon */}
        <div className="flex items-center gap-2 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 px-3.5 py-2 shadow-xs">
          <div className="h-7 w-7 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Wifi className="h-4 w-4"/>
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight">DropSphere</span>
        </div>

        {/* Device Name Pill */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/90 px-3 py-2 shadow-xs text-xs text-slate-600">
          <Laptop className="h-3.5 w-3.5 text-blue-600"/>
          {isEditingName ? (<div className="flex items-center gap-1.5">
              <input type="text" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNameSave()} className="w-28 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs text-slate-900 outline-none" autoFocus/>
              <button onClick={handleNameSave} className="text-blue-600 hover:text-blue-800 cursor-pointer">
                <Check className="h-3.5 w-3.5"/>
              </button>
            </div>) : (<div onClick={() => setIsEditingName(true)} className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 font-medium transition-colors" title="Click to rename device">
              <span>{localDevice.name}</span>
              <Edit3 className="h-3 w-3 text-slate-400 hover:text-blue-600"/>
            </div>)}
        </div>
      </div>

      {/* ── Right Pill: Apple Dynamic Island Room Capsule ── */}
      <div>
        <SessionCapsule />
      </div>
    </header>);
}
