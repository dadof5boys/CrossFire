import type { PlayView } from '@spellfire/shared';
import { create } from 'zustand';

interface PlayState {
  view: PlayView | null;
  applyState: (view: PlayView) => void;
  reset: () => void;
}

export const usePlayStore = create<PlayState>((set) => ({
  view: null,
  applyState: (view) => set({ view }),
  reset: () => set({ view: null }),
}));
