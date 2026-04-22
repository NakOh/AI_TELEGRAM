import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

const REPLY_INPUT_ID = 'dashboard-reply-input';
const REPLY_INPUT_SELECTOR = `#${REPLY_INPUT_ID}`;

import type { ApiChat, ApiMessage } from '../../api/types';

import { callApi } from '../../api/gramjs';

import useMedia from '../../hooks/useMedia';
import { getChatAvatarHash } from '../../global/helpers';

import Composer from '../common/Composer';

import ReactionsBar from './ReactionsBar';

import styles from './CommentsModal.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
  onClose: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; topMessages: ApiMessage[]; replies: ApiMessage[]; discussionChatId: string; threadId: number };

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) return `${h}:${m}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

function getChat(chatId: string): ApiChat | undefined {
  return getGlobal().chats.byId[chatId];
}

const CommentRow = memo(({ discussionChatId, message }: { discussionChatId: string; message: ApiMessage }) => {
  const senderId = message.senderId;
  const global = getGlobal();
  const user = senderId ? global.users.byId[senderId] : undefined;
  const senderChat = senderId ? global.chats.byId[senderId] : undefined;
  const name = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.usernames?.[0]?.username || '익명'
    : senderChat?.title || '익명';
  const avatarHash = user ? getChatAvatarHash(user as unknown as ApiChat)
    : senderChat ? getChatAvatarHash(senderChat) : undefined;
  const avatarUrl = useMedia(avatarHash);

  const text = message.content?.text?.text;

  return (
    <div className={styles.replyRow}>
      <div className={styles.replyAvatar}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : (name[0] || '?')}
      </div>
      <div className={styles.replyBody}>
        <div className={styles.replyHead}>
          <span className={styles.replyName}>{name}</span>
          <span className={styles.replyTime}>
            {formatDate((message.date || 0) * 1000)}
          </span>
        </div>
        {text && <div className={styles.replyText}>{text}</div>}
        <ReactionsBar chatId={discussionChatId} message={message} />
      </div>
    </div>
  );
});

const CommentsComposer = memo(({ chatId, threadId }: { chatId: string; threadId: number }) => {
  useEffect(() => {
    getActions().openThread({ chatId, threadId });
  }, [chatId, threadId]);

  return (
    <div className={styles.composerRegion}>
      <Composer
        type="messageList"
        chatId={chatId}
        threadId={threadId}
        messageListType="thread"
        isReady
        editableInputId={REPLY_INPUT_ID}
        editableInputCssSelector={REPLY_INPUT_SELECTOR}
        inputId={`${REPLY_INPUT_ID}-wrap`}
        inputPlaceholder="댓글 입력…"
      />
    </div>
  );
});

const CommentsModal = ({ chatId, messageId, onClose }: OwnProps) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const reload = () => {
    const chat = getChat(chatId);
    if (!chat) {
      setState({ kind: 'error', message: '채널을 찾을 수 없습니다.' });
      return;
    }

    callApi('fetchDiscussionMessage', { chat, messageId })
      .then((result) => {
        if (!result) {
          setState({ kind: 'error', message: '댓글을 불러올 수 없습니다. (비공개 채널이거나 댓글이 비활성화됨)' });
          return;
        }
        const topIds = new Set(result.topMessages.map((m) => m.id));
        const replies = result.messages.filter((m) => !topIds.has(m.id));
        replies.sort((a, b) => (a.date || 0) - (b.date || 0));
        const discussionChatId = result.topMessages[0]?.chatId || chatId;
        setState({
          kind: 'ready',
          topMessages: result.topMessages,
          replies,
          discussionChatId,
          threadId: result.threadId,
        });
      })
      .catch((err) => {
        setState({ kind: 'error', message: String(err?.message || err || '로드 실패') });
      });
  };

  useEffect(() => {
    setState({ kind: 'loading' });
    reload();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [chatId, messageId]);

  // Poll for new replies every 10s while the modal is open
  useEffect(() => {
    if (state.kind !== 'ready') return undefined;
    const interval = window.setInterval(reload, 10000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [state.kind, chatId, messageId]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>댓글</div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {state.kind === 'loading' && (
            <div className={styles.stateNote}>댓글 불러오는 중…</div>
          )}
          {state.kind === 'error' && (
            <div className={styles.stateNote}>{state.message}</div>
          )}
          {state.kind === 'ready' && (
            <>
              {state.topMessages.map((m) => (
                <div key={m.id} className={styles.topMessage}>
                  {m.content?.text?.text && (
                    <div className={styles.topMessageText}>{m.content.text.text}</div>
                  )}
                  <ReactionsBar chatId={state.discussionChatId} message={m} />
                </div>
              ))}
              <div className={styles.replyList}>
                {state.replies.length === 0 ? (
                  <div className={styles.stateNote}>아직 댓글이 없습니다.</div>
                ) : (
                  state.replies.map((m) => (
                    <CommentRow key={m.id} discussionChatId={state.discussionChatId} message={m} />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {state.kind === 'ready' && (
          <CommentsComposer
            chatId={state.discussionChatId}
            threadId={state.threadId}
          />
        )}
      </div>
    </div>
  );
};

export default memo(CommentsModal);
