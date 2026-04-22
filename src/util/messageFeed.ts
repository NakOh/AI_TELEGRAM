import type { ApiMessage } from '../api/types';
import type { GlobalState } from '../global/types';

import { classifyMessage, type CategoryKey } from './categoryClassifier';

export interface FeedItem {
  chatId: string;
  messageId: number;
  chatTitle: string;
  text: string;
  timestamp: number;
  category: CategoryKey;
  viewsCount?: number;
  reactionsCount?: number;
  isForwarded: boolean;
}

export interface FeedOptions {
  windowMs?: number;
  category?: CategoryKey | 'all';
  search?: string;
  limit?: number;
  includeForwarded?: boolean;
}

function getChatTitle(global: GlobalState, chatId: string): string {
  const chat = global.chats.byId[chatId];
  return chat?.title || chatId;
}

function getMessageText(message: ApiMessage): string {
  return message.content?.text?.text || '';
}

export function collectFeed(global: GlobalState, options: FeedOptions = {}): FeedItem[] {
  const {
    windowMs = 24 * 60 * 60 * 1000,
    category = 'all',
    search,
    limit = 200,
    includeForwarded = true,
  } = options;

  const cutoff = Date.now() - windowMs;
  const searchLower = search?.trim().toLowerCase();
  const items: FeedItem[] = [];

  for (const chatId of Object.keys(global.messages.byChatId)) {
    const chat = global.chats.byId[chatId];
    if (chat?.type !== 'chatTypeChannel') continue;
    const byId = global.messages.byChatId[chatId]?.byId;
    if (!byId) continue;

    for (const id in byId) {
      const message = byId[id];
      if (!message) continue;
      const timestamp = message.date ? message.date * 1000 : 0;
      if (timestamp < cutoff) continue;
      const text = getMessageText(message);
      if (!text) continue;

      const isForwarded = Boolean(message.forwardInfo);
      if (!includeForwarded && isForwarded) continue;

      const itemCategory = classifyMessage(text);
      if (category !== 'all' && itemCategory !== category) continue;

      if (searchLower && !text.toLowerCase().includes(searchLower)) continue;

      items.push({
        chatId,
        messageId: message.id,
        chatTitle: getChatTitle(global, chatId),
        text,
        timestamp,
        category: itemCategory,
        viewsCount: message.viewsCount,
        reactionsCount: message.reactions?.results?.reduce(
          (sum, r) => sum + (r.count || 0),
          0,
        ),
        isForwarded,
      });
    }
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items.slice(0, limit);
}

export function getCategoryCounts(
  global: GlobalState,
  windowMs: number = 24 * 60 * 60 * 1000,
): Record<CategoryKey, number> {
  const cutoff = Date.now() - windowMs;
  const counts: Record<CategoryKey, number> = {
    event: 0, announcement: 0, market: 0, chat: 0,
  };

  for (const chatId of Object.keys(global.messages.byChatId)) {
    const chat = global.chats.byId[chatId];
    if (chat?.type !== 'chatTypeChannel') continue;
    const byId = global.messages.byChatId[chatId]?.byId;
    if (!byId) continue;

    for (const id in byId) {
      const message = byId[id];
      if (!message) continue;
      const timestamp = message.date ? message.date * 1000 : 0;
      if (timestamp < cutoff) continue;
      const text = getMessageText(message);
      if (!text) continue;
      const cat = classifyMessage(text);
      counts[cat] += 1;
    }
  }

  return counts;
}
