import { create } from 'zustand';
export const useUIStore = create((set) => ({
    activeTab: 'transfer',
    isCommandPaletteOpen: false,
    isQRModalOpen: false,
    isSettingsOpen: false,
    isDiagnosticsOpen: false,
    isDraggingOver: false,
    isSharingScreen: false,
    setActiveTab: (activeTab) => set({ activeTab }),
    setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
    setQRModalOpen: (isQRModalOpen) => set({ isQRModalOpen }),
    setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
    setDiagnosticsOpen: (isDiagnosticsOpen) => set({ isDiagnosticsOpen }),
    setDraggingOver: (isDraggingOver) => set({ isDraggingOver }),
    setSharingScreen: (isSharingScreen) => set({ isSharingScreen }),
}));
