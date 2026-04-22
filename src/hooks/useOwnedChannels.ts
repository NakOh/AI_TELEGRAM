import {
  useEffect, useMemo, useState,
} from '../lib/teact/teact';
import { getGlobal } from '../global';

const STORAGE_KEY = 'ownedChannelsV1';

type OwnedChannel = { id: string; title: string };

function readCache(): OwnedChannel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is OwnedChannel => Boolean(c) && typeof c.id === 'string' && typeof c.title === 'string',
    );
  } catch {
    return [];
  }
}

function writeCache(list: OwnedChannel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore quota
  }
}

function scan(): OwnedChannel[] {
  const global = getGlobal();
  const out: OwnedChannel[] = [];
  const byId = global.chats.byId;
  for (const id of Object.keys(byId)) {
    const chat = byId[id];
    if (!chat || chat.type !== 'chatTypeChannel') continue;
    if (!(chat.isCreator || chat.adminRights)) continue;
    out.push({ id, title: chat.title || id });
  }
  return out;
}

// Module-level cache seeded from localStorage so the first render shows
// channels instantly. Merges with new scans — never removes entries
// automatically so transient empty scans during load cannot hide them.
const cached: { list: OwnedChannel[]; signature: string } = {
  list: readCache(),
  signature: '',
};
const listeners = new Set<() => void>();

function refresh() {
  const scanned = scan();

  // Merge: existing cache + new entries, updated titles for any id we saw.
  const byId = new Map<string, OwnedChannel>();
  for (const c of cached.list) byId.set(c.id, c);
  for (const c of scanned) byId.set(c.id, c);

  const merged = Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
  const signature = merged.map((c) => `${c.id}:${c.title}`).join('|');
  if (signature === cached.signature && merged.length === cached.list.length) return;

  cached.list = merged;
  cached.signature = signature;
  if (merged.length > 0) writeCache(merged);
  listeners.forEach((l) => l());
}

// Initial reconcile — if chats happen to be in global already, merge them
// before the component mounts so the first paint already includes new ones.
refresh();

export default function useOwnedChannels() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(Date.now());
    listeners.add(listener);
    refresh();
    const interval = window.setInterval(refresh, 10000);
    return () => {
      listeners.delete(listener);
      window.clearInterval(interval);
    };
  }, []);

  return useMemo(() => cached.list, [cached.list]);
}

// Exposed for potential future "leave channel → drop from nav" UI.
export function forgetOwnedChannel(id: string) {
  cached.list = cached.list.filter((c) => c.id !== id);
  cached.signature = cached.list.map((c) => `${c.id}:${c.title}`).join('|');
  writeCache(cached.list);
  listeners.forEach((l) => l());
}
