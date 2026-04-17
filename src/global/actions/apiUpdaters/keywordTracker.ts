import { addActionHandler } from '../../index';

import { pushMessageText } from '../../../util/keywordTracker';

addActionHandler('apiUpdate', (global, actions, update) => {
  if (update['@type'] !== 'newMessage') return undefined;

  const message = update.message;
  if (!message) return undefined;

  const chat = global.chats.byId[update.chatId];
  if (!chat?.isChannel) return undefined;

  const text = message.content?.text?.text;
  if (!text) return undefined;

  const timestamp = message.date ? message.date * 1000 : Date.now();
  pushMessageText(text, timestamp);

  return undefined;
});
