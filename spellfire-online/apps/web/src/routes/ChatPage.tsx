import { DEFAULT_CHAT_CHANNEL, MAX_CHAT_TEXT } from '@spellfire/shared';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useAuthDialog } from '../auth/authDialogStore.js';
import { useRealtime } from '../realtime/RealtimeProvider.js';
import { useChatStore } from '../store/chatStore.js';

function displayName(email: string): string {
  const local = email.split('@')[0];
  return local || email;
}

export default function ChatPage() {
  const { isAuthed, user } = useAuth();
  const openAuth = useAuthDialog((s) => s.open);
  const rt = useRealtime();
  const connected = useChatStore((s) => s.connected);
  const currentChannel = useChatStore((s) => s.currentChannel);
  const joinedChannels = useChatStore((s) => s.joinedChannels);
  const messagesByChannel = useChatStore((s) => s.messagesByChannel);
  const occupantsByChannel = useChatStore((s) => s.occupantsByChannel);
  const tables = useChatStore((s) => s.tables);
  const whispers = useChatStore((s) => s.whispers);
  const error = useChatStore((s) => s.error);
  const setCurrentChannel = useChatStore((s) => s.setCurrentChannel);
  const setError = useChatStore((s) => s.setError);

  const [draft, setDraft] = useState('');
  const [channelDraft, setChannelDraft] = useState('');
  const [tableDraft, setTableDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  const messages = messagesByChannel[currentChannel] ?? [];
  const occupants = occupantsByChannel[currentChannel] ?? [];
  const myUserId = user?.id;
  const myTable = useMemo(
    () => tables.find((t) => t.occupants.some((o) => o.userId === myUserId)),
    [tables, myUserId],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when transcript changes
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, whispers]);

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <h2 className="mb-3 text-xl font-semibold">Chat</h2>
        <p className="mb-4 text-slate-400">
          Sign in to join the lobby and talk with other players.
        </p>
        <button
          type="button"
          onClick={openAuth}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
        >
          Sign in
        </button>
      </div>
    );
  }

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const tell = text.match(/^\/tell\s+(\S+)\s+(.+)$/i);
    if (tell) {
      const target = occupants.find((o) => o.email === tell[1] || o.userId === tell[1]);
      if (!target) {
        setError(`No online user matching "${tell[1]}"`);
        return;
      }
      rt.tell(target.userId, tell[2] ?? '');
    } else {
      rt.say(text);
    }
    setDraft('');
  };

  const joinChannel = (e: FormEvent) => {
    e.preventDefault();
    const name = channelDraft.trim();
    if (!name) return;
    rt.joinChannel(name);
    setChannelDraft('');
  };

  const createTable = (e: FormEvent) => {
    e.preventDefault();
    const name = tableDraft.trim();
    if (!name) return;
    rt.createTable(name);
    setTableDraft('');
  };

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-800 bg-slate-950 p-3">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Channels
          </h2>
          <ul className="flex flex-col gap-1">
            {joinedChannels.map((ch) => (
              <li key={ch} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentChannel(ch)}
                  className={`min-w-0 flex-1 rounded px-2 py-1 text-left text-sm ${
                    ch === currentChannel
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  {ch}
                </button>
                {ch !== DEFAULT_CHAT_CHANNEL ? (
                  <button
                    type="button"
                    aria-label={`Leave ${ch}`}
                    onClick={() => rt.leaveChannel(ch)}
                    className="rounded px-1 text-xs text-slate-500 hover:text-red-400"
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <form onSubmit={joinChannel} className="mt-2 flex gap-1">
            <input
              value={channelDraft}
              onChange={(e) => setChannelDraft(e.target.value)}
              placeholder="Join…"
              aria-label="Join channel"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded bg-slate-700 px-2 py-1 text-xs font-semibold hover:bg-slate-600"
            >
              Join
            </button>
          </form>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Tables
          </h2>
          {tables.length === 0 ? (
            <p className="text-xs text-slate-600">No open tables.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {tables.map((table) => (
                <li key={table.id}>
                  <button
                    type="button"
                    onClick={() =>
                      myTable?.id === table.id ? rt.leaveTable(table.id) : rt.joinTable(table.id)
                    }
                    className={`w-full rounded px-2 py-1 text-left text-sm ${
                      myTable?.id === table.id
                        ? 'bg-emerald-900/60 text-emerald-200'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span className="block truncate font-medium">{table.name}</span>
                    <span className="text-xs text-slate-500">
                      {table.occupants.length} seated
                      {myTable?.id === table.id ? ' · click to leave' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={createTable} className="mt-2 flex gap-1">
            <input
              value={tableDraft}
              onChange={(e) => setTableDraft(e.target.value)}
              placeholder="New table"
              aria-label="Create table"
              className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded bg-sky-700 px-2 py-1 text-xs font-semibold hover:bg-sky-600"
            >
              Open
            </button>
          </form>
        </section>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-2">
          <h2 className="text-sm font-semibold">{currentChannel}</h2>
          <span
            className={`text-xs ${connected ? 'text-emerald-400' : 'text-amber-400'}`}
            aria-live="polite"
          >
            {connected ? 'Connected' : 'Connecting…'}
          </span>
          {error ? (
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto truncate text-xs text-red-400"
            >
              {error}
            </button>
          ) : null}
        </header>
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="flex flex-col gap-2">
            {messages.map((msg) => (
              <li key={msg.id} className={msg.kind === 'system' ? 'text-xs text-slate-500' : ''}>
                {msg.kind === 'system' ? (
                  <em>{msg.text}</em>
                ) : (
                  <>
                    <span className="mr-2 text-xs text-slate-500">
                      {new Date(msg.ts).toLocaleTimeString()}
                    </span>
                    <span className="font-semibold text-emerald-300">
                      {displayName(msg.from.email)}
                    </span>
                    <span className="ml-2 text-slate-200">{msg.text}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {whispers.length > 0 ? (
            <ul className="mt-4 border-t border-slate-800 pt-3">
              {whispers.map((w) => (
                <li key={w.id} className="text-sm text-violet-300">
                  <span className="text-xs text-slate-500">whisper </span>
                  {displayName(w.from.email)} → {displayName(w.to.email)}: {w.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-slate-800 p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_CHAT_TEXT}
            placeholder={`Message ${currentChannel}…  (/tell email text)`}
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </section>

      <aside className="w-52 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-950 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Who's here
        </h2>
        {occupants.length === 0 ? (
          <p className="text-xs text-slate-600">No one yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {occupants.map((o) => (
              <li key={o.userId} className="truncate text-sm text-slate-300" title={o.email}>
                {o.email}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
