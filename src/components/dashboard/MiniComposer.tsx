import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiAttachment } from '../../api/types';
import type { MessageListType, ThreadId } from '../../types';

import buildAttachment from '../middle/composer/helpers/buildAttachment';

import styles from './Dashboard.module.scss';

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  messageListType?: MessageListType;
  placeholder?: string;
};

const EMOJI_QUICK = ['❤️', '👍', '🔥', '😂', '👀', '🙏', '🤔', '😮', '🎉', '💯', '✨', '👏'];

const MiniComposer = ({
  chatId, threadId, messageListType = 'thread', placeholder = '메시지 입력…',
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

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isSending) return;
    setIsSending(true);
    setError(undefined);
    try {
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

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    if (!files.length) return;
    setError(undefined);
    try {
      const built = await Promise.all(
        files.map((f) => buildAttachment(f.name, f)),
      );
      setAttachments((prev) => [...prev, ...built]);
    } catch (err) {
      setError(String((err as Error)?.message || '첨부 실패'));
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
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
    setIsEmojiOpen(false);
  };

  return (
    <div className={styles.miniComposer}>
      {attachments.length > 0 && (
        <div className={styles.miniComposerAttachments}>
          {attachments.map((att, i) => (
            <div key={`${att.filename}-${i}`} className={styles.miniComposerAttachment}>
              {att.previewBlobUrl || att.blobUrl ? (
                <img src={att.previewBlobUrl || att.blobUrl} alt="" />
              ) : (
                <span>📎 {att.filename}</span>
              )}
              <button
                type="button"
                className={styles.miniComposerAttachmentRemove}
                onClick={() => removeAttachment(i)}
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.miniComposerRow}>
        <div className={styles.miniComposerEmojiWrap} ref={emojiWrapRef}>
          <button
            type="button"
            className={styles.miniComposerIconBtn}
            onClick={() => setIsEmojiOpen((v) => !v)}
            aria-label="Emoji"
          >
            😀
          </button>
          {isEmojiOpen && (
            <div className={styles.miniComposerEmojiPicker}>
              {EMOJI_QUICK.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.reactionPickBtn}
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className={styles.miniComposerIconBtn}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style="display:none;"
          onChange={handleFilesChosen}
        />
        <textarea
          ref={textAreaRef}
          className={styles.miniComposerInput}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button
          type="button"
          className={styles.miniComposerSend}
          disabled={(!text.trim() && attachments.length === 0) || isSending}
          onClick={send}
        >
          전송
        </button>
      </div>
      {error && <div className={styles.miniComposerError}>{error}</div>}
    </div>
  );
};

export default memo(MiniComposer);
