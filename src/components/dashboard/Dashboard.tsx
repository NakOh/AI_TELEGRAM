import {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { CategoryKey } from '../../util/categoryClassifier';
import { ALL_CATEGORIES, getCategoryDef } from '../../util/categoryClassifier';
import {
  collectFeed, getCategoryCounts, type FeedItem,
} from '../../util/messageFeed';
import {
  backfillFromGlobal, getRanking, scanRecentMessages, subscribeKeywordTracker,
} from '../../util/keywordTracker';

import styles from './Dashboard.module.scss';

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const REFRESH_MS = 5000;
const FEED_LIMIT = 200;

function formatRelativeTime(timestamp: number): string {
  const deltaMin = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMin < 1) return '방금';
  if (deltaMin < 60) return `${deltaMin}분 전`;
  const hours = Math.floor(deltaMin / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

type Tab = 'all' | CategoryKey;

const Dashboard = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [expandedId, setExpandedId] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  // Refresh whenever tracker pushes or every REFRESH_MS
  useEffect(() => {
    const bump = () => setTick((t) => (t + 1) % 1_000_000);
    const unsub = subscribeKeywordTracker(bump);

    const globalNow = getGlobal();
    void backfillFromGlobal(globalNow);

    const interval = window.setInterval(() => {
      scanRecentMessages(getGlobal());
      bump();
    }, REFRESH_MS);

    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  const global = getGlobal();

  const categoryCounts = useMemo(
    () => getCategoryCounts(global, WINDOW_MS),
    // Re-run when tick or global.messages shape changes
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [tick, global.messages],
  );

  const feed: FeedItem[] = useMemo(() => {
    return collectFeed(global, {
      windowMs: WINDOW_MS,
      category: tab,
      search,
      limit: FEED_LIMIT,
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [tick, tab, search, global.messages]);

  const trending = useMemo(() => getRanking(10), [tick]);

  const totalCount = feed.length;

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <div className={styles.brand}>📊 Telegram Dashboard</div>
        <div className={styles.searchBox}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="검색 (채널/키워드/본문)"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <div className={styles.headerActions}>
          최근 {WINDOW_HOURS}시간 · 채널 {Object.keys(global.chats.byId).filter(
            (id) => global.chats.byId[id]?.type === 'chatTypeChannel',
          ).length}개
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.feedColumn}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
              onClick={() => setTab('all')}
            >
              전체
              <span className={styles.tabCount}>
                {Object.values(categoryCounts).reduce((a, b) => a + b, 0)}
              </span>
            </button>
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`${styles.tab} ${tab === cat.key ? styles.tabActive : ''}`}
                onClick={() => setTab(cat.key)}
              >
                <span>{cat.emoji}</span>
                {cat.label}
                <span className={styles.tabCount}>{categoryCounts[cat.key] || 0}</span>
              </button>
            ))}
          </div>

          <div className={styles.feed}>
            {totalCount === 0 ? (
              <div className={styles.emptyFeed}>
                {search
                  ? '검색 결과 없음'
                  : '수집된 채널 메시지가 없습니다. 잠시 후 자동으로 채워집니다.'}
              </div>
            ) : (
              feed.map((item) => {
                const id = `${item.chatId}:${item.messageId}`;
                const isExpanded = expandedId === id;
                const catDef = getCategoryDef(item.category);

                return (
                  <div
                    key={id}
                    className={styles.card}
                    onClick={() => setExpandedId(isExpanded ? undefined : id)}
                  >
                    <div className={styles.cardHead}>
                      <span className={styles.cardChannel}>{item.chatTitle}</span>
                      <span className={styles.cardCategory}>
                        {catDef.emoji} {catDef.label}
                      </span>
                      {item.isForwarded && (
                        <span className={styles.cardForward}>↪ forwarded</span>
                      )}
                      <span className={styles.cardTime}>
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <div
                      className={`${styles.cardBody} ${isExpanded ? styles.expanded : ''}`}
                    >
                      {item.text}
                    </div>
                    {(item.viewsCount || item.reactionsCount) && (
                      <div className={styles.cardFooter}>
                        {item.viewsCount ? <span>👁 {item.viewsCount.toLocaleString()}</span> : undefined}
                        {item.reactionsCount ? <span>💬 {item.reactionsCount}</span> : undefined}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <div className={styles.sideCardTitle}>🔥 실시간 키워드 · 1h</div>
            {trending.length === 0 ? (
              <div className={styles.emptyFeed}>수집 중…</div>
            ) : (
              <ol className={styles.trendingList}>
                {trending.map(({ keyword, count }, i) => (
                  <li key={keyword} className={styles.trendingItem}>
                    <span className={styles.trendingRank}>{i + 1}</span>
                    <span className={styles.trendingKeyword}>{keyword}</span>
                    <span className={styles.trendingCount}>{count}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className={styles.sideCard}>
            <div className={styles.sideCardTitle}>카테고리 분포 · {WINDOW_HOURS}h</div>
            <ol className={styles.trendingList}>
              {ALL_CATEGORIES.map((cat) => (
                <li key={cat.key} className={styles.trendingItem}>
                  <span className={styles.trendingRank}>{cat.emoji}</span>
                  <span className={styles.trendingKeyword}>{cat.label}</span>
                  <span className={styles.trendingCount}>
                    {categoryCounts[cat.key] || 0}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Dashboard);
