import type {
  ChatMessage,
  Occupant,
  PlayPhase,
  PlayView,
  TableSummary,
  Whisper,
} from '@spellfire/shared';
import { DEFAULT_CHAT_CHANNEL } from '@spellfire/shared';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { type Socket, io } from 'socket.io-client';
import { useAuth } from '../auth/AuthProvider.js';
import { useChatStore } from '../store/chatStore.js';
import { usePlayStore } from '../store/playStore.js';

export interface RealtimeApi {
  say: (text: string) => void;
  joinChannel: (channel: string) => void;
  leaveChannel: (channel: string) => void;
  tell: (toUserId: string, text: string) => void;
  createTable: (name: string) => void;
  joinTable: (tableId: string) => void;
  leaveTable: (tableId: string) => void;
  sit: (tableId: string) => void;
  stand: (tableId: string) => void;
  loadDeck: (tableId: string, deckId: string) => void;
  start: (tableId: string) => void;
  draw: (tableId: string) => void;
  move: (tableId: string, instanceId: string, toZone: 'pool' | 'realms' | 'discard') => void;
  passTurn: (tableId: string) => void;
  setPhase: (tableId: string, phase: PlayPhase) => void;
  attack: (tableId: string, attackerInstanceId: string, targetInstanceId: string) => void;
  defend: (tableId: string, defenderInstanceId: string) => void;
  declineDefend: (tableId: string) => void;
  ally: (tableId: string, instanceId: string) => void;
  resolveCombat: (tableId: string) => void;
  syncPlay: (tableId: string) => void;
}

const noopApi: RealtimeApi = {
  say: () => {},
  joinChannel: () => {},
  leaveChannel: () => {},
  tell: () => {},
  createTable: () => {},
  joinTable: () => {},
  leaveTable: () => {},
  sit: () => {},
  stand: () => {},
  loadDeck: () => {},
  start: () => {},
  draw: () => {},
  move: () => {},
  passTurn: () => {},
  setPhase: () => {},
  attack: () => {},
  defend: () => {},
  declineDefend: () => {},
  ally: () => {},
  resolveCombat: () => {},
  syncPlay: () => {},
};

const RealtimeContext = createContext<RealtimeApi>(noopApi);

export function useRealtime(): RealtimeApi {
  return useContext(RealtimeContext);
}

function bindStore(socket: Socket): void {
  const store = () => useChatStore.getState();
  socket.on('connect', () => store().setConnected(true));
  socket.on('disconnect', () => store().setConnected(false));
  socket.on('connect_error', (err) => store().setError(err.message));
  socket.on('chat:history', (payload: { channel: string; messages: ChatMessage[] }) => {
    store().applyHistory(payload.channel, payload.messages);
    store().addJoinedChannel(payload.channel);
  });
  socket.on('chat:message', (msg: ChatMessage) => store().applyMessage(msg));
  socket.on('chat:presence', (payload: { channel: string; users: Occupant[] }) => {
    store().applyPresence(payload.channel, payload.users);
  });
  socket.on('chat:whisper', (whisper: Whisper) => store().applyWhisper(whisper));
  socket.on('table:list', (payload: { tables: TableSummary[] }) => {
    store().applyTables(payload.tables);
  });
  socket.on('play:state', (view: PlayView) => {
    usePlayStore.getState().applyState(view);
  });
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { session, isAuthed, loading } = useAuth();
  const token = session?.access_token;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (loading || !isAuthed || !token) {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
      useChatStore.getState().reset();
      usePlayStore.getState().reset();
      return;
    }

    const socket = io({
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    bindStore(socket);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
      useChatStore.getState().reset();
      usePlayStore.getState().reset();
    };
  }, [loading, isAuthed, token]);

  const api = useMemo<RealtimeApi>(() => {
    const emit = (event: string, payload: unknown, onAck?: (err: string | null) => void) => {
      const socket = socketRef.current;
      if (!socket) {
        useChatStore.getState().setError('Not connected');
        return;
      }
      socket.emit(event, payload, (err: string | null) => {
        if (err) useChatStore.getState().setError(err);
        onAck?.(err);
      });
    };
    return {
      say: (text) => {
        const channel = useChatStore.getState().currentChannel;
        emit('chat:say', { channel, text });
      },
      joinChannel: (channel) => {
        emit('chat:join', { channel }, (err) => {
          if (err) return;
          useChatStore.getState().addJoinedChannel(channel);
          useChatStore.getState().setCurrentChannel(channel);
        });
      },
      leaveChannel: (channel) => {
        if (channel === DEFAULT_CHAT_CHANNEL) return;
        emit('chat:leave', { channel }, (err) => {
          if (!err) useChatStore.getState().removeJoinedChannel(channel);
        });
      },
      tell: (toUserId, text) => emit('chat:tell', { toUserId, text }),
      createTable: (name) => emit('table:create', { name }),
      joinTable: (tableId) => emit('table:join', { tableId }),
      leaveTable: (tableId) => emit('table:leave', { tableId }),
      sit: (tableId) => emit('play:sit', { tableId }),
      stand: (tableId) => emit('play:stand', { tableId }),
      loadDeck: (tableId, deckId) => emit('play:load-deck', { tableId, deckId }),
      start: (tableId) => emit('play:start', { tableId }),
      draw: (tableId) => emit('play:draw', { tableId }),
      move: (tableId, instanceId, toZone) => emit('play:move', { tableId, instanceId, toZone }),
      passTurn: (tableId) => emit('play:pass-turn', { tableId }),
      setPhase: (tableId, phase) => emit('play:set-phase', { tableId, phase }),
      attack: (tableId, attackerInstanceId, targetInstanceId) =>
        emit('play:attack', { tableId, attackerInstanceId, targetInstanceId }),
      defend: (tableId, defenderInstanceId) => emit('play:defend', { tableId, defenderInstanceId }),
      declineDefend: (tableId) => emit('play:decline-defend', { tableId }),
      ally: (tableId, instanceId) => emit('play:ally', { tableId, instanceId }),
      resolveCombat: (tableId) => emit('play:resolve', { tableId }),
      syncPlay: (tableId) => emit('play:sync', { tableId }),
    };
  }, []);

  return <RealtimeContext.Provider value={api}>{children}</RealtimeContext.Provider>;
}
