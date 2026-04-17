import { addActionHandler } from '../../index';

import { markMessageSeen, pushMessageText } from '../../../util/keywordTracker';

addActionHandler('apiUpdate', (global, actions, update) => {
  if (update['@type'] !== 'newMessage') return undefined;

  const message = update.message;
  if (!message) return undefined;

  const chat = global.chats.byId[update.chatId];
  if (chat?.type !== 'chatTypeChannel') return undefined;

  const text = message.content?.text?.text;
  if (!text) return undefined;

  markMessageSeen(update.chatId, update.id);
  const timestamp = message.date ? message.date * 1000 : Date.now();
  pushMessageText(text, timestamp, update.chatId);

  return undefined;
});
