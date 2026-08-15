import { DEFAULT_CHAT_CHANNEL } from '@spellfire/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chatStore.js';

const alice = { userId: 'a', email: 'alice@example.com' };

describe('chatStore', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
  });

  it('replaces history and appends unique messages', () => {
    const first = {
      id: '1',
      channel: DEFAULT_CHAT_CHANNEL,
      from: alice,
      text: 'hi',
      ts: '2026-01-01T00:00:00.000Z',
      kind: 'say' as const,
    };
    useChatStore.getState().applyHistory(DEFAULT_CHAT_CHANNEL, [first]);
    useChatStore.getState().applyMessage({ ...first, id: '2', text: 'again' });
    useChatStore.getState().applyMessage(first); // duplicate id
    expect(
      useChatStore.getState().messagesByChannel[DEFAULT_CHAT_CHANNEL]?.map((m) => m.id),
    ).toEqual(['1', '2']);
  });

  it('tracks presence, tables, and whispers', () => {
    useChatStore.getState().applyPresence(DEFAULT_CHAT_CHANNEL, [alice]);
    useChatStore.getState().applyTables([{ id: 't1', name: 'Arena', occupants: [alice] }]);
    useChatStore.getState().applyWhisper({
      id: 'w1',
      from: alice,
      to: { userId: 'b', email: 'bob@example.com' },
      text: 'psst',
      ts: '2026-01-01T00:00:00.000Z',
    });
    const s = useChatStore.getState();
    expect(s.occupantsByChannel[DEFAULT_CHAT_CHANNEL]).toEqual([alice]);
    expect(s.tables[0]?.name).toBe('Arena');
    expect(s.whispers[0]?.text).toBe('psst');
  });
});
