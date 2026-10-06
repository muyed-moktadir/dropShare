'use client';
import React from 'react';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { CanvasTopBar } from '@/components/canvas/CanvasTopBar';
import { AirDropCanvas } from '@/components/canvas/AirDropCanvas';
import { FloatingDock } from '@/components/canvas/FloatingDock';
import { TransferHUD } from '@/components/transfer/TransferHUD';
import { TechnicalDiagnostics } from '@/components/diagnostics/TechnicalDiagnostics';
import { ScreenShareViewer } from '@/components/screen-share/ScreenShareViewer';
import { ActivityLog } from '@/components/activity/ActivityLog';
import { QRPairingModal } from '@/components/modals/QRPairingModal';
import { CommandPalette } from '@/components/modals/CommandPalette';
import { useUIStore } from '@/stores/useUIStore';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
export default function HomePage() {
    const { activeTab } = useUIStore();
    useSignaling();
    useWebRTC();
    return (<div className="relative h-screen w-screen overflow-hidden flex flex-col justify-between bg-[#f8fafc] text-slate-800 selection:bg-blue-500/20 selection:text-blue-900">
      {/* ── Soft Ambient Studio Mesh Lighting ── */}
      <AuroraBackground />

      {/* ── Studio Top Bar (Fixed Header, Flex-none) ── */}
      <header className="flex-none w-full max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2 z-20">
        <CanvasTopBar />
      </header>

      {/* ── Main Studio App Stage (With clear breathing room top & bottom) ── */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center justify-center overflow-hidden">
        {activeTab === 'transfer' && (<div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <AirDropCanvas />
          </div>)}

        {activeTab === 'screenshare' && (<div className="w-full h-full min-h-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <ScreenShareViewer />
          </div>)}

        {activeTab === 'diagnostics' && (<div className="w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <TechnicalDiagnostics />
          </div>)}

        {activeTab === 'activity' && (<div className="w-full flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <ActivityLog />
          </div>)}
      </main>

      {/* ── Dedicated Dock Footer (With clear breathing room) ── */}
      <footer className="flex-none w-full pt-1 pb-5 flex items-center justify-center z-40">
        <FloatingDock />
      </footer>

      {/* ── Real-Time Transfer Mini-Player HUD ── */}
      <TransferHUD />

      {/* ── Global Modals ── */}
      <QRPairingModal />
      <CommandPalette />
    </div>);
}
