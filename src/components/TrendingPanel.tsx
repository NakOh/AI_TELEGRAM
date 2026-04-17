import { memo, useEffect, useState } from '../lib/teact/teact';

import { getRanking, subscribeKeywordTracker } from '../util/keywordTracker';

import useShowTrending from '../hooks/useShowTrending';

import styles from './TrendingPanel.module.scss';

const REFRESH_INTERVAL_MS = 5000;

const TrendingPanel = () => {
  const { isTrendingPanelShown, toggleShowTrending } = useShowTrending();
  const [ranking, setRanking] = useState(() => getRanking(10));

  useEffect(() => {
    if (!isTrendingPanelShown) return undefined;

    const refresh = () => setRanking(getRanking(10));
    const unsubscribe = subscribeKeywordTracker(refresh);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [isTrendingPanelShown]);

  if (!isTrendingPanelShown) return undefined;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>실시간 키워드 · 1h</span>
        <button
          type="button"
          className={styles.close}
          onClick={toggleShowTrending}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      {ranking.length === 0 ? (
        <div className={styles.empty}>
          채널에서 메시지가 수집되면 여기 표시됩니다.
        </div>
      ) : (
        <ol className={styles.list}>
          {ranking.map(({ keyword, count }, i) => (
            <li key={keyword} className={styles.item}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.keyword}>{keyword}</span>
              <span className={styles.count}>{count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default memo(TrendingPanel);
