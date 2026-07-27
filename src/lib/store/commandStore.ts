import { create } from 'zustand';

/**
 * Status buka/tutup command palette. Ditaruh di store supaya pemicu mana pun
 * (pintasan Ctrl+K, tombol "Cari" di Topbar, tautan di halaman) memakai jalur
 * yang sama tanpa perlu mengoper prop lintas layout.
 */
interface CommandState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useCommandStore = create<CommandState>()((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
