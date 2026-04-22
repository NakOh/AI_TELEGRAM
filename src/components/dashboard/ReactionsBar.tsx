import type React from '../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';

import styles from './Dashboard.module.scss';

type OwnProps = {
  chatId: string;
  message: ApiMessage;
};

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '👀', '🙏', '🤔', '😮'];

const ReactionsBar = ({ chatId, message }: OwnProps) => {
  const actions = getActions();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>();

  useEffect(() => {
    if (!isPickerOpen) return undefined;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isPickerOpen]);

  const results = message.reactions?.results || [];

  const sendReaction = (emoticon: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    actions.toggleReaction({
      chatId,
      messageId: message.id,
      reaction: { type: 'emoji', emoticon },
      shouldAddToRecent: true,
    });
    setIsPickerOpen(false);
  };

  return (
    <div className={styles.reactions} onClick={(e) => e.stopPropagation()}>
      {results.map((r) => {
        if (r.reaction.type === 'paid') return undefined;
        const key = r.reaction.type === 'emoji' ? r.reaction.emoticon : r.reaction.documentId;
        const display = r.reaction.type === 'emoji' ? r.reaction.emoticon : '⭐';
        const active = r.chosenOrder !== undefined;
        return (
          <button
            key={key}
            type="button"
            className={`${styles.reactionChip} ${active ? styles.reactionChipActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (r.reaction.type === 'emoji') sendReaction(r.reaction.emoticon, e);
            }}
          >
            <span>{display}</span>
            <span>{r.count}</span>
          </button>
        );
      })}
      <div className={styles.reactionPickerWrap} ref={wrapRef}>
        <button
          type="button"
          className={styles.reactionAddBtn}
          onClick={(e) => { e.stopPropagation(); setIsPickerOpen((v) => !v); }}
          aria-label="Add reaction"
        >
          ＋
        </button>
        {isPickerOpen && (
          <div className={styles.reactionPicker}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactionPickBtn}
                onClick={(e) => sendReaction(emoji, e)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(ReactionsBar);
