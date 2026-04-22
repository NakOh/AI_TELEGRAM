import type React from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FeedItem } from '../../util/messageFeed';
import { getCategoryDef } from '../../util/categoryClassifier';
import { getChatAvatarHash } from '../../global/helpers';

import useMedia from '../../hooks/useMedia';

import styles from './Dashboard.module.scss';

type OwnProps = {
  item: FeedItem;
  searchQuery?: string;
  isExpanded: boolean;
  onToggle: () => void;
};

function formatRelativeTime(timestamp: number): string {
  const deltaMin = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMin < 1) return '방금';
  if (deltaMin < 60) return `${deltaMin}분`;
  const hours = Math.floor(deltaMin / 60);
  if (hours < 24) return `${hours}시간`;
  const days = Math.floor(hours / 24);
  return `${days}일`;
}

const MEDIA_ICON: Record<NonNullable<FeedItem['mediaKind']>, string> = {
  photo: '📷',
  video: '📹',
  voice: '🎤',
  audio: '🎵',
  document: '📎',
};

function renderHighlighted(text: string, query?: string): React.ReactNode {
  const q = query?.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  if (!lower.includes(qLower)) return text;

  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={`${idx}-${i}`} className={styles.highlight}>
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return parts;
}

function buildTelegramUrl(chatId: string, messageId: number, username?: string): string {
  if (username) return `https://t.me/${username}/${messageId}`;
  // Private channel: strip the -100 prefix used by Telegram client ids
  const internal = chatId.replace(/^-?100/, '');
  return `https://t.me/c/${internal}/${messageId}`;
}

const MessageCard = ({
  item, searchQuery, isExpanded, onToggle,
}: OwnProps) => {
  const imageUrl = useMedia(item.photoHash);

  const global = getGlobal();
  const chat = global.chats.byId[item.chatId];
  const avatarHash = chat ? getChatAvatarHash(chat) : undefined;
  const avatarUrl = useMedia(avatarHash);
  const username = (chat as { usernames?: Array<{ username: string }> } | undefined)?.usernames?.[0]?.username
    || (chat as { username?: string } | undefined)?.username;

  const catDef = getCategoryDef(item.category);
  const mediaBadge = item.mediaKind && !item.photoHash ? MEDIA_ICON[item.mediaKind] : undefined;
  const firstLetter = item.chatTitle?.[0] || '#';

  const openExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = buildTelegramUrl(item.chatId, item.messageId, username);
    window.open(url, '_blank');
  };

  return (
    <article className={styles.card} onClick={onToggle}>
      <div className={styles.cardAvatarCol}>
        <div className={styles.cardAvatar}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : firstLetter}
        </div>
      </div>
      <div className={styles.cardMain}>
        <div className={styles.cardHead}>
          <span className={styles.cardChannel}>
            {renderHighlighted(item.chatTitle, searchQuery)}
          </span>
          <span className={styles.cardDot}>·</span>
          <span className={styles.cardTime}>{formatRelativeTime(item.timestamp)}</span>
          {item.isForwarded && <span className={styles.cardForward}>↪</span>}
          {mediaBadge && <span className={styles.cardForward}>{mediaBadge}</span>}
          <span className={styles.cardCategory}>
            {catDef.emoji} {catDef.label}
          </span>
        </div>

        {item.text && (
          <div className={`${styles.cardBody} ${isExpanded ? styles.expanded : ''}`}>
            {renderHighlighted(item.text, searchQuery)}
          </div>
        )}

        {imageUrl && (
          <div className={styles.cardImageWrap}>
            <img src={imageUrl} alt="" className={styles.cardImage} />
          </div>
        )}

        <div className={styles.cardFooter}>
          {item.viewsCount ? <span>👁 {item.viewsCount.toLocaleString()}</span> : undefined}
          {item.reactionsCount ? <span>💬 {item.reactionsCount}</span> : undefined}
          <button type="button" className={styles.cardOpenBtn} onClick={openExternal}>
            💬 댓글/원본 열기
          </button>
        </div>
      </div>
    </article>
  );
};

export default memo(MessageCard);
