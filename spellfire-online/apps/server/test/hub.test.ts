import { describe, expect, it } from 'vitest';
import { RealtimeHub } from '../src/realtime/hub.js';

const alice = { userId: 'a', email: 'alice@example.com' };
const bob = { userId: 'b', email: 'bob@example.com' };

describe('RealtimeHub', () => {
  it('tracks channel occupants and history', () => {
    const hub = new RealtimeHub();
    hub.joinChannel('s1', alice, 'Main');
    hub.joinChannel('s2', bob, 'Main');
    expect(hub.occupants('Main').map((o) => o.email)).toEqual([
      'alice@example.com',
      'bob@example.com',
    ]);
    hub.recordSay('Main', alice, 'hello');
    hub.leaveChannel('s1', 'Main');
    expect(hub.occupants('Main').map((o) => o.userId)).toEqual(['b']);
  });

  it('dedupes the same user on two sockets', () => {
    const hub = new RealtimeHub();
    hub.joinChannel('s1', alice, 'Main');
    hub.joinChannel('s2', alice, 'Main');
    expect(hub.occupants('Main')).toHaveLength(1);
  });

  it('creates and tears down empty tables', () => {
    const hub = new RealtimeHub();
    const table = hub.createTable('s1', alice, 'Table 1');
    expect(hub.listTables()).toHaveLength(1);
    hub.joinTable('s2', bob, table.id);
    expect(hub.tableSummary(table.id)?.occupants).toHaveLength(2);
    hub.leaveTable('s1');
    hub.leaveTable('s2');
    expect(hub.listTables()).toHaveLength(0);
  });
});
