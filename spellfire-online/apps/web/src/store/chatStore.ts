import type { ChatMessage, Occupant, TableSummary, Whisper } from '@spellfire/shared';
import { DEFAULT_CHAT_CHANNEL } from '@spellfire/shared';
import { create } from 'zustand';

const MAX_CLIENT_HISTORY = 200;

export interface ChatState {
  connected: boolean;
  currentChannel: string;
  joinedChannels: string[];
  messagesByChannel: Record<string, ChatMessage[]>;
  occupantsByChannel: Record<string, Occupant[]>;
  tables: TableSummary[];
  tablesReady: boolean;
  whispers: Whisper[];
  error: string | null;
  setConnected: (connected: boolean) => void;
  setCurrentChannel: (channel: string) => void;
  addJoinedChannel: (channel: string) => void;
  removeJoinedChannel: (channel: string) => void;
  applyHistory: (channel: string, messages: ChatMessage[]) => void;
  applyMessage: (msg: ChatMessage) => void;
  applyPresence: (channel: string, users: Occupant[]) => void;
  applyWhisper: (whisper: Whisper) => void;
  applyTables: (tables: TableSummary[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const empty = {
  connected: false,
  currentChannel: DEFAULT_CHAT_CHANNEL,
  joinedChannels: [DEFAULT_CHAT_CHANNEL],
  messagesByChannel: {} as Record<string, ChatMessage[]>,
  occupantsByChannel: {} as Record<string, Occupant[]>,
  tables: [] as TableSummary[],
  tablesReady: false,
  whispers: [] as Whisper[],
  error: null as string | null,
};

function cap(list: ChatMessage[]): ChatMessage[] {
  return list.length > MAX_CLIENT_HISTORY ? list.slice(list.length - MAX_CLIENT_HISTORY) : list;
}

export const useChatStore = create<ChatState>((set) => ({
  ...empty,
  setConnected: (connected) => set({ connected }),
  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  addJoinedChannel: (channel) =>
    set((s) => ({
      joinedChannels: s.joinedChannels.includes(channel)
        ? s.joinedChannels
        : [...s.joinedChannels, channel],
    })),
  removeJoinedChannel: (channel) =>
    set((s) => ({
      joinedChannels: s.joinedChannels.filter((c) => c !== channel),
      currentChannel: s.currentChannel === channel ? DEFAULT_CHAT_CHANNEL : s.currentChannel,
    })),
  applyHistory: (channel, messages) =>
    set((s) => ({
      messagesByChannel: { ...s.messagesByChannel, [channel]: cap(messages) },
    })),
  applyMessage: (msg) =>
    set((s) => {
      const prev = s.messagesByChannel[msg.channel] ?? [];
      if (prev.some((m) => m.id === msg.id)) return s;
      return {
        messagesByChannel: { ...s.messagesByChannel, [msg.channel]: cap([...prev, msg]) },
      };
    }),
  applyPresence: (channel, users) =>
    set((s) => ({
      occupantsByChannel: { ...s.occupantsByChannel, [channel]: users },
    })),
  applyWhisper: (whisper) =>
    set((s) => ({
      whispers: [...s.whispers, whisper].slice(-50),
    })),
  applyTables: (tables) => set({ tables, tablesReady: true }),
  setError: (error) => set({ error }),
  reset: () => set(empty),
}));
