import { memo, useEffect, useState } from '../lib/teact/teact';
import { getGlobal } from '../global';

import {
  backfillFromGlobal, getIsBackfilling, getRanking, getTotalTokenCount,
  scanRecentMessages, subscribeKeywordTracker,
} from '../util/keywordTracker';

import useShowTrending from '../hooks/useShowTrending';

import styles from './TrendingPanel.module.scss';

const REFRESH_INTERVAL_MS = 5000;

const TrendingPanel = () => {
  const { isTrendingPanelShown, toggleShowTrending } = useShowTrending();
  const [ranking, setRanking] = useState(() => getRanking(10));
  const [isLoading, setIsLoading] = useState(() => getIsBackfilling());
  const [tokenCount, setTokenCount] = useState(() => getTotalTokenCount());

  useEffect(() => {
    if (!isTrendingPanelShown) return undefined;

    const refresh = () => {
      scanRecentMessages(getGlobal());
      setRanking(getRanking(10));
      setIsLoading(getIsBackfilling());
      setTokenCount(getTotalTokenCount());
    };
    refresh();
    const unsubscribe = subscribeKeywordTracker(refresh);
    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);

    // Kick off backfill once per session when panel first becomes visible
    void backfillFromGlobal(getGlobal());

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [isTrendingPanelShown]);

  if (!isTrendingPanelShown) return undefined;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          실시간 키워드 · 1h ({tokenCount})
        </span>
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
          {isLoading ? '데이터 수집 중…' : '채널에서 메시지가 수집되면 여기 표시됩니다.'}
        </div>
      ) : (
        <>
          {isLoading && (
            <div className={styles.loadingStrip}>데이터 수집 중…</div>
          )}
          <ol className={styles.list}>
            {ranking.map(({ keyword, count }, i) => (
              <li key={keyword} className={styles.item}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.keyword}>{keyword}</span>
                <span className={styles.count}>{count}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

export default memo(TrendingPanel);
