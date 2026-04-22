import { memo } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';

import { getChatAvatarHash } from '../../global/helpers';

import useMedia from '../../hooks/useMedia';

import styles from './Dashboard.module.scss';

type OwnProps = {
  chat?: ApiChat;
  fallbackTitle?: string;
  onClick: () => void;
};

const MyChannelItem = ({ chat, fallbackTitle, onClick }: OwnProps) => {
  const avatarUrl = useMedia(chat ? getChatAvatarHash(chat) : undefined);
  const title = chat?.title || fallbackTitle || '#';
  const firstLetter = title[0] || '#';

  return (
    <div className={styles.myChannel} onClick={onClick}>
      <div className={styles.myChannelAvatar}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : firstLetter}
      </div>
      <span className={styles.myChannelName}>{title}</span>
    </div>
  );
};

export default memo(MyChannelItem);
