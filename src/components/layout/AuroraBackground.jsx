'use client';
import React from 'react';
export function AuroraBackground() {
    return (<div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#f8fafc]">
      {/* ── Soft, Airy Apple Studio Ambient Glow ── */}
      <div className="absolute inset-0" style={{
            backgroundImage: `
            radial-gradient(ellipse 75% 55% at 50% -10%, rgba(37, 99, 235, 0.08) 0%, transparent 65%),
            radial-gradient(ellipse 60% 45% at 10% 30%, rgba(99, 102, 241, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 60% 45% at 90% 70%, rgba(14, 165, 233, 0.05) 0%, transparent 60%)
          `,
        }}/>
    </div>);
}
