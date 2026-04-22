import {
  memo, useEffect, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { ApiChat, ApiMessage } from '../../api/types';

import { callApi } from '../../api/gramjs';

import useMedia from '../../hooks/useMedia';
import { getChatAvatarHash } from '../../global/helpers';

import styles from './CommentsModal.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
  onClose: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; topMessages: ApiMessage[]; replies: ApiMessage[] };

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

const CommentRow = memo(({ message }: { message: ApiMessage }) => {
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
  if (!text) return undefined;

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
        <div className={styles.replyText}>{text}</div>
      </div>
    </div>
  );
});

const CommentsModal = ({ chatId, messageId, onClose }: OwnProps) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const chat = getChat(chatId);
    if (!chat) {
      setState({ kind: 'error', message: '채널을 찾을 수 없습니다.' });
      return () => { /* noop */ };
    }

    callApi('fetchDiscussionMessage', { chat, messageId })
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState({ kind: 'error', message: '댓글을 불러올 수 없습니다. (비공개 채널이거나 댓글이 비활성화됨)' });
          return;
        }
        const topIds = new Set(result.topMessages.map((m) => m.id));
        const replies = result.messages.filter((m) => !topIds.has(m.id));
        replies.sort((a, b) => (a.date || 0) - (b.date || 0));
        setState({ kind: 'ready', topMessages: result.topMessages, replies });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ kind: 'error', message: String(err?.message || err || '로드 실패') });
      });

    return () => {
      cancelled = true;
    };
  }, [chatId, messageId]);

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
                m.content?.text?.text ? (
                  <div key={m.id} className={styles.topMessage}>
                    {m.content.text.text}
                  </div>
                ) : undefined
              ))}
              <div className={styles.replyList}>
                {state.replies.length === 0 ? (
                  <div className={styles.stateNote}>아직 댓글이 없습니다.</div>
                ) : (
                  state.replies.map((m) => <CommentRow key={m.id} message={m} />)
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(CommentsModal);
