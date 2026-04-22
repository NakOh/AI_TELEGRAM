import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiAttachment } from '../../api/types';
import type { MessageListType, ThreadId } from '../../types';

import useMedia from '../../hooks/useMedia';
import { getChatAvatarHash } from '../../global/helpers';

import buildAttachment from '../middle/composer/helpers/buildAttachment';

import styles from './Dashboard.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  messageListType?: MessageListType;
  placeholder?: string;
};

const EMOJI_QUICK = [
  '❤️', '🔥', '👍', '👎', '😂', '🥲', '😭', '😮', '🤔', '👀',
  '🙏', '🎉', '💯', '✨', '😅', '🙄', '😎', '🚀', '💪', '👏',
];

const MAX_TEXT = 4000;

const MiniComposer = ({
  chatId, threadId, messageListType = 'thread', placeholder = '무슨 일이 일어나고 있나요?',
}: OwnProps) => {
  const actions = getActions();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ApiAttachment[]>([]);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const emojiWrapRef = useRef<HTMLDivElement>();
  const fileInputRef = useRef<HTMLInputElement>();

  const global = getGlobal();
  const currentUser = global.currentUserId ? global.users.byId[global.currentUserId] : undefined;
  const ownChat = global.currentUserId ? global.chats.byId[global.currentUserId] : undefined;
  const avatarHash = ownChat ? getChatAvatarHash(ownChat) : undefined;
  const avatarUrl = useMedia(avatarHash);
  const ownInitial = currentUser?.firstName?.[0] || '?';

  useEffect(() => {
    if (!isEmojiOpen) return undefined;
    const handler = (e: MouseEvent) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setIsEmojiOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isEmojiOpen]);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
  }, [text]);

  const canSend = Boolean(text.trim() || attachments.length);

  const send = () => {
    if (!canSend || isSending) return;
    setIsSending(true);
    setError(undefined);
    try {
      const trimmed = text.trim();
      if (attachments.length > 0) {
        attachments.forEach((attachment, i) => {
          actions.sendMessage({
            messageList: { chatId, threadId, type: messageListType },
            text: i === 0 ? trimmed || undefined : undefined,
            attachments: [attachment],
          });
        });
      } else {
        actions.sendMessage({
          messageList: { chatId, threadId, type: messageListType },
          text: trimmed,
        });
      }
      setText('');
      setAttachments([]);
    } catch (e) {
      setError(String((e as Error)?.message || '전송 실패'));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    if (!files.length) return;
    setError(undefined);
    try {
      const built = await Promise.all(files.map((f) => buildAttachment(f.name, f)));
      setAttachments((prev) => [...prev, ...built]);
    } catch (err) {
      setError(String((err as Error)?.message || '첨부 실패'));
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const insertEmoji = (emoji: string) => {
    const el = textAreaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const remaining = MAX_TEXT - text.length;

  return (
    <div className={styles.composeBox}>
      <div className={styles.composeAvatar}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : ownInitial}
      </div>
      <div className={styles.composeMain}>
        <textarea
          ref={textAreaRef}
          className={styles.composeInput}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_TEXT}
          rows={1}
        />

        {attachments.length > 0 && (
          <div className={styles.composeAttachments}>
            {attachments.map((att, i) => (
              <div key={`${att.filename}-${i}`} className={styles.composeAttachmentCard}>
                {att.previewBlobUrl || att.blobUrl ? (
                  <img src={att.previewBlobUrl || att.blobUrl} alt="" />
                ) : (
                  <span>📎 {att.filename}</span>
                )}
                <button
                  type="button"
                  className={styles.composeAttachmentRemove}
                  onClick={() => removeAttachment(i)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div className={styles.composeError}>{error}</div>}

        <div className={styles.composeToolbar}>
          <div className={styles.composeTools}>
            <button
              type="button"
              className={styles.composeToolBtn}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Media"
              title="사진/영상"
            >
              🖼
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              style="display:none;"
              onChange={handleFilesChosen}
            />
            <div className={styles.composeEmojiWrap} ref={emojiWrapRef}>
              <button
                type="button"
                className={styles.composeToolBtn}
                onClick={() => setIsEmojiOpen((v) => !v)}
                aria-label="Emoji"
                title="이모지"
              >
                😀
              </button>
              {isEmojiOpen && (
                <div className={styles.composeEmojiPicker}>
                  {EMOJI_QUICK.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={styles.composeEmojiPickBtn}
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={styles.composeRight}>
            {text.length > 0 && (
              <span className={remaining < 100 ? styles.composeCounterWarn : styles.composeCounter}>
                {remaining}
              </span>
            )}
            <button
              type="button"
              className={styles.composeSend}
              disabled={!canSend || isSending}
              onClick={send}
            >
              게시
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MiniComposer);
