import { create } from 'zustand';

interface AuthDialogState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/** Controls the sign-in/sign-up dialog from anywhere (e.g. gated actions). */
export const useAuthDialog = create<AuthDialogState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
