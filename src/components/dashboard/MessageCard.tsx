import { memo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { FeedItem } from '../../util/messageFeed';
import { getCategoryDef } from '../../util/categoryClassifier';
import { getChatAvatarHash } from '../../global/helpers';

import useMedia from '../../hooks/useMedia';

import styles from './Dashboard.module.scss';

type OwnProps = {
  item: FeedItem;
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

const MessageCard = ({ item, isExpanded, onToggle }: OwnProps) => {
  const imageUrl = useMedia(item.photoHash);

  const global = getGlobal();
  const chat = global.chats.byId[item.chatId];
  const avatarHash = chat ? getChatAvatarHash(chat) : undefined;
  const avatarUrl = useMedia(avatarHash);

  const catDef = getCategoryDef(item.category);
  const mediaBadge = item.mediaKind && !item.photoHash ? MEDIA_ICON[item.mediaKind] : undefined;
  const firstLetter = item.chatTitle?.[0] || '#';

  return (
    <article className={styles.card} onClick={onToggle}>
      <div className={styles.cardAvatarCol}>
        <div className={styles.cardAvatar}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : firstLetter}
        </div>
      </div>
      <div className={styles.cardMain}>
        <div className={styles.cardHead}>
          <span className={styles.cardChannel}>{item.chatTitle}</span>
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
            {item.text}
          </div>
        )}

        {imageUrl && (
          <div className={styles.cardImageWrap}>
            <img src={imageUrl} alt="" className={styles.cardImage} />
          </div>
        )}

        {(item.viewsCount || item.reactionsCount) && (
          <div className={styles.cardFooter}>
            {item.viewsCount ? <span>👁 {item.viewsCount.toLocaleString()}</span> : undefined}
            {item.reactionsCount ? <span>💬 {item.reactionsCount}</span> : undefined}
          </div>
        )}
      </div>
    </article>
  );
};

export default memo(MessageCard);
