import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { MessageListType, ThreadId } from '../../types';

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
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const textAreaRef = useRef<HTMLTextAreaElement>();
  const emojiWrapRef = useRef<HTMLDivElement>();

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
    if (!trimmed || isSending) return;
    setIsSending(true);
    setError(undefined);
    try {
      actions.sendMessage({
        messageList: { chatId, threadId, type: messageListType },
        text: trimmed,
      });
      setText('');
    } catch (e) {
      setError(String((e as Error)?.message || '전송 실패'));
    } finally {
      setIsSending(false);
    }
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
        disabled={!text.trim() || isSending}
        onClick={send}
      >
        전송
      </button>
      {error && <div className={styles.miniComposerError}>{error}</div>}
    </div>
  );
};

export default memo(MiniComposer);
