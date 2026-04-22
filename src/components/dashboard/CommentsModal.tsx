import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiChat, ApiMessage } from '../../api/types';

import { callApi } from '../../api/gramjs';

import useMedia from '../../hooks/useMedia';
import { getChatAvatarHash, getPhotoMediaHash } from '../../global/helpers';

import MiniComposer from './MiniComposer';
import ReactionsBar from './ReactionsBar';
import renderEntities from './renderEntities';

import styles from './CommentsModal.module.scss';

type OwnProps = {
  chatId: string;
  messageId: number;
  onClose: () => void;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; replies: ApiMessage[]; discussionChatId: string; threadId: number };

function formatDate(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${h}:${m}`;
}

function formatShort(ts: number): string {
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

const PostBody = memo(({ chatId, message }: { chatId: string; message: ApiMessage }) => {
  const chat = getChat(chatId);
  const avatarUrl = useMedia(chat ? getChatAvatarHash(chat) : undefined);
  const photoHash = message.content?.photo ? getPhotoMediaHash(message.content.photo, 'preview') : undefined;
  const imageUrl = useMedia(photoHash);

  const title = chat?.title || chatId;
  const firstLetter = title[0] || '#';
  const text = message.content?.text?.text;
  const entities = message.content?.text?.entities;
  const ts = (message.date || 0) * 1000;

  return (
    <div className={styles.post}>
      <div className={styles.postHead}>
        <div className={styles.postAvatar}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : firstLetter}
        </div>
        <div className={styles.postHeadMain}>
          <div className={styles.postChannel}>{title}</div>
          <div className={styles.postTime}>{formatDate(ts)}</div>
        </div>
      </div>
      {text && (
        <div className={styles.postText}>
          {renderEntities(text, entities)}
        </div>
      )}
      {imageUrl && (
        <div className={styles.postImageWrap}>
          <img src={imageUrl} alt="" className={styles.postImage} />
        </div>
      )}
      <div className={styles.postStats}>
        {message.viewsCount ? <span>👁 {message.viewsCount.toLocaleString()}</span> : undefined}
      </div>
      <ReactionsBar chatId={chatId} message={message} />
    </div>
  );
});

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
          <span className={styles.replyTime}>{formatShort((message.date || 0) * 1000)}</span>
        </div>
        {text && (
          <div className={styles.replyText}>
            {renderEntities(text, message.content?.text?.entities)}
          </div>
        )}
        <ReactionsBar chatId={discussionChatId} message={message} />
      </div>
    </div>
  );
});

const CommentsModal = ({ chatId, messageId, onClose }: OwnProps) => {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const global = getGlobal();
  const post = global.messages.byChatId[chatId]?.byId[messageId];

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
    // Mark the chat as current so its messages persist in the IndexedDB
    // cache between refreshes.
    getActions().openChat({ id: chatId });
    setState({ kind: 'loading' });
    reload();
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [chatId, messageId]);

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
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ←
          </button>
          <div className={styles.title}>게시물</div>
        </div>

        <div className={styles.content}>
          {post && <PostBody chatId={chatId} message={post} />}

          {state.kind === 'ready' && (
            <div className={styles.composerWrap}>
              <MiniComposer
                chatId={state.discussionChatId}
                threadId={state.threadId}
                messageListType="thread"
                placeholder="답글을 작성하세요"
              />
            </div>
          )}

          <div className={styles.divider}>
            {state.kind === 'ready'
              ? `댓글 ${state.replies.length}${state.replies.length >= 100 ? '+' : ''}`
              : '댓글'}
          </div>

          {state.kind === 'loading' && (
            <div className={styles.stateNote}>댓글 불러오는 중…</div>
          )}
          {state.kind === 'error' && (
            <div className={styles.stateNote}>{state.message}</div>
          )}
          {state.kind === 'ready' && (
            <div className={styles.replyList}>
              {state.replies.length === 0 ? (
                <div className={styles.stateNote}>아직 댓글이 없습니다.</div>
              ) : (
                state.replies.map((m) => (
                  <CommentRow key={m.id} discussionChatId={state.discussionChatId} message={m} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(CommentsModal);
