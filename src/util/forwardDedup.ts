import type { ApiChat, ApiMessage } from '../api/types';

// Per-session record of which (chatId, messageId) was picked first for a given
// source forward. Subsequent forwards of the same source get filtered out.
const chosenByKey = new Map<string, string>();

function getKey(message: ApiMessage): string | undefined {
  const fwd = message.forwardInfo;
  if (!fwd?.fromChatId || !fwd.fromMessageId) return undefined;
  return `${fwd.fromChatId}:${fwd.fromMessageId}`;
}

export function isOwnedOrAdminChat(chat: ApiChat | undefined): boolean {
  if (!chat) return false;
  return Boolean(chat.isCreator || chat.adminRights);
}

export function shouldHideForwardedMessage(
  message: ApiMessage,
  chatId: string,
  subscribedChatIds: Set<string>,
  hostChat?: ApiChat,
): boolean {
  if (!message.forwardInfo) return false;

  if (isOwnedOrAdminChat(hostChat)) return false;

  const sourceChatId = message.forwardInfo.fromChatId;
  if (sourceChatId && subscribedChatIds.has(sourceChatId)) {
    return true;
  }

  const key = getKey(message);
  if (!key) return false;

  const ident = `${chatId}:${message.id}`;
  const chosen = chosenByKey.get(key);
  if (!chosen) {
    chosenByKey.set(key, ident);
    return false;
  }
  return chosen !== ident;
}

export function resetForwardDedup() {
  chosenByKey.clear();
}
