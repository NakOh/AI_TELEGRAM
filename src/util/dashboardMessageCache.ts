import type { ApiMessage } from '../api/types';
import type { GlobalState } from '../global/types';

import { DASH_MSGS_IDB_STORE } from './browser/idb';
import { onBeforeUnload } from './schedulers';

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PER_CHAT = 500;
const SAVE_INTERVAL_MS = 30_000;

type ChatEntry = {
  byId: Record<number, ApiMessage>;
  updatedAt: number;
};

let saveTimer: number | undefined;
let isLoopRunning = false;

function isChannelChat(global: GlobalState, chatId: string): boolean {
  return global.chats.byId[chatId]?.type === 'chatTypeChannel';
}

export async function loadDashboardMessagesIntoGlobal(global: GlobalState): Promise<GlobalState> {
  try {
    const cutoff = Date.now() - WINDOW_MS;
    const rawEntries = await DASH_MSGS_IDB_STORE.entries();
    if (!rawEntries.length) return global;

    const mergedByChatId: GlobalState['messages']['byChatId'] = { ...global.messages.byChatId };
    const staleKeys: string[] = [];

    for (const [rawKey, rawValue] of rawEntries) {
      const chatId = String(rawKey);
      const entry = rawValue as ChatEntry | undefined;
      if (!entry?.byId) {
        staleKeys.push(chatId);
        continue;
      }

      const freshById: Record<number, ApiMessage> = {};
      let hasFresh = false;
      for (const idStr in entry.byId) {
        const message = entry.byId[idStr];
        const ts = message?.date ? message.date * 1000 : 0;
        if (ts < cutoff) continue;
        freshById[Number(idStr)] = message;
        hasFresh = true;
      }
      if (!hasFresh) {
        staleKeys.push(chatId);
        continue;
      }

      const existing = mergedByChatId[chatId];
      mergedByChatId[chatId] = existing
        ? {
          ...existing,
          byId: { ...freshById, ...existing.byId },
        }
        : {
          byId: freshById,
          threadsById: {},
          summaryById: {},
        };
    }

    if (staleKeys.length) {
      void DASH_MSGS_IDB_STORE.delMany(staleKeys);
    }

    return {
      ...global,
      messages: {
        ...global.messages,
        byChatId: mergedByChatId,
      },
    };
  } catch {
    return global;
  }
}

export async function saveDashboardMessagesFromGlobal(global: GlobalState): Promise<void> {
  const cutoff = Date.now() - WINDOW_MS;
  const batch: [string, ChatEntry][] = [];

  for (const chatId of Object.keys(global.messages.byChatId)) {
    if (!isChannelChat(global, chatId)) continue;
    const byId = global.messages.byChatId[chatId]?.byId;
    if (!byId) continue;

    const fresh: Array<[number, ApiMessage]> = [];
    for (const idStr in byId) {
      const message = byId[idStr];
      if (!message) continue;
      const ts = message.date ? message.date * 1000 : 0;
      if (ts < cutoff) continue;
      fresh.push([Number(idStr), message]);
    }
    if (!fresh.length) continue;

    fresh.sort((a, b) => (b[1].date || 0) - (a[1].date || 0));
    const kept = fresh.slice(0, MAX_PER_CHAT);

    batch.push([chatId, {
      byId: Object.fromEntries(kept),
      updatedAt: Date.now(),
    }]);
  }

  if (!batch.length) return;
  try {
    await DASH_MSGS_IDB_STORE.setMany(batch);
  } catch {
    // ignore quota errors
  }
}

export function startDashboardCacheLoop(getGlobal: () => GlobalState) {
  if (isLoopRunning) return;
  isLoopRunning = true;

  saveTimer = window.setInterval(() => {
    void saveDashboardMessagesFromGlobal(getGlobal());
  }, SAVE_INTERVAL_MS);

  onBeforeUnload(() => {
    void saveDashboardMessagesFromGlobal(getGlobal());
  });
}

export function stopDashboardCacheLoop() {
  if (saveTimer !== undefined) {
    window.clearInterval(saveTimer);
    saveTimer = undefined;
  }
  isLoopRunning = false;
}
