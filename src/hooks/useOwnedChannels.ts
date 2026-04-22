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
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

// Module-level cache seeded from localStorage so the first render shows
// channels instantly; a background scan reconciles once global state
// populates.
const cached: { list: OwnedChannel[]; signature: string } = {
  list: readCache(),
  signature: '',
};
const listeners = new Set<() => void>();

function refresh() {
  const global = getGlobal();
  // Only reconcile once the chat list has actually loaded; otherwise
  // scan() returns [] and we'd clobber the cache from the previous
  // session until messages arrive.
  const chatsLoaded = Boolean(global.chats.listIds.active?.length);
  if (!chatsLoaded) return;

  const next = scan();
  const signature = next.map((c) => `${c.id}:${c.title}`).join('|');
  if (signature === cached.signature && next.length === cached.list.length) return;
  if (next.length === 0 && cached.list.length > 0) {
    // Safety net: never overwrite a populated cache with an empty scan.
    return;
  }
  cached.list = next;
  cached.signature = signature;
  writeCache(next);
  listeners.forEach((l) => l());
}

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
