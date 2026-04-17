import { addActionHandler } from '../../index';

import { pushMessageText } from '../../../util/keywordTracker';

// eslint-disable-next-line no-console
console.log('[trending] action handler module loaded');

addActionHandler('apiUpdate', (global, actions, update) => {
  if (update['@type'] !== 'newMessage') return undefined;

  const message = update.message;
  const chat = global.chats.byId[update.chatId];
  const text = message?.content?.text?.text;

  // eslint-disable-next-line no-console
  console.log('[trending] newMessage', {
    chatId: update.chatId,
    isChannel: chat?.isChannel,
    isBroadcast: chat?.type,
    hasText: Boolean(text),
    textPreview: text?.slice(0, 40),
  });

  if (!text) return undefined;

  const timestamp = message.date ? message.date * 1000 : Date.now();
  pushMessageText(text, timestamp);

  return undefined;
});
