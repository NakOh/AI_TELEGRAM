import { memo } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';

import { getChatAvatarHash } from '../../global/helpers';

import useMedia from '../../hooks/useMedia';

import styles from './Dashboard.module.scss';

type OwnProps = {
  chat: ApiChat;
  onClick: () => void;
};

const MyChannelItem = ({ chat, onClick }: OwnProps) => {
  const avatarUrl = useMedia(getChatAvatarHash(chat));
  const firstLetter = chat.title?.[0] || '#';

  return (
    <div className={styles.myChannel} onClick={onClick}>
      <div className={styles.myChannelAvatar}>
        {avatarUrl ? <img src={avatarUrl} alt="" /> : firstLetter}
      </div>
      <span className={styles.myChannelName}>{chat.title}</span>
    </div>
  );
};

export default memo(MyChannelItem);
