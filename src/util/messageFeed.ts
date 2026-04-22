import type { ApiMessage, ApiMessageEntity } from '../api/types';
import type { GlobalState } from '../global/types';

import { getPhotoMediaHash } from '../global/helpers';

import { classifyMessage, type CategoryKey } from './categoryClassifier';

export interface FeedItem {
  chatId: string;
  messageId: number;
  chatTitle: string;
  text: string;
  entities?: ApiMessageEntity[];
  timestamp: number;
  category: CategoryKey;
  viewsCount?: number;
  reactionsCount?: number;
  isForwarded: boolean;
  photoHash?: string;
  mediaKind?: 'photo' | 'video' | 'document' | 'voice' | 'audio';
}

export interface FeedOptions {
  windowMs?: number;
  category?: CategoryKey | 'all';
  search?: string;
  limit?: number;
  includeForwarded?: boolean;
  chatId?: string;
}

function getChatTitle(global: GlobalState, chatId: string): string {
  const chat = global.chats.byId[chatId];
  return chat?.title || chatId;
}

function getMessageText(message: ApiMessage): string {
  return message.content?.text?.text || '';
}

function getMediaInfo(message: ApiMessage): { photoHash?: string; mediaKind?: FeedItem['mediaKind'] } {
  const content = message.content;
  if (!content) return {};
  if (content.photo) {
    return { photoHash: getPhotoMediaHash(content.photo, 'preview'), mediaKind: 'photo' };
  }
  if (content.video) return { mediaKind: 'video' };
  if (content.voice) return { mediaKind: 'voice' };
  if (content.audio) return { mediaKind: 'audio' };
  if (content.document) return { mediaKind: 'document' };
  return {};
}

export function collectFeed(global: GlobalState, options: FeedOptions = {}): FeedItem[] {
  const {
    windowMs = 24 * 60 * 60 * 1000,
    category = 'all',
    search,
    limit = 200,
    includeForwarded = true,
    chatId: chatIdFilter,
  } = options;

  const cutoff = Date.now() - windowMs;
  const searchLower = search?.trim().toLowerCase();
  const items: FeedItem[] = [];

  for (const chatId of Object.keys(global.messages.byChatId)) {
    if (chatIdFilter && chatId !== chatIdFilter) continue;
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
      const { photoHash, mediaKind } = getMediaInfo(message);
      // Include media-only messages too (photo/video without caption)
      if (!text && !mediaKind) continue;

      const isForwarded = Boolean(message.forwardInfo);
      if (!includeForwarded && isForwarded) continue;

      const classifyText = text || '';
      const itemCategory = classifyMessage(classifyText);
      if (category !== 'all' && itemCategory !== category) continue;

      if (searchLower && !classifyText.toLowerCase().includes(searchLower)) continue;

      items.push({
        chatId,
        messageId: message.id,
        chatTitle: getChatTitle(global, chatId),
        text: classifyText,
        entities: message.content?.text?.entities,
        timestamp,
        category: itemCategory,
        viewsCount: message.viewsCount,
        reactionsCount: message.reactions?.results?.reduce(
          (sum, r) => sum + (r.count || 0),
          0,
        ),
        isForwarded,
        photoHash,
        mediaKind,
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
    event: 0, announcement: 0, coin: 0, stock: 0, chart: 0,
    breaking: 0, guide: 0, scam: 0, chat: 0,
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
