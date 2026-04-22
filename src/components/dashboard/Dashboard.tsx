import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { CategoryKey } from '../../util/categoryClassifier';
import { ALL_CATEGORIES } from '../../util/categoryClassifier';
import {
  collectFeed, getCategoryCounts, type FeedItem,
} from '../../util/messageFeed';
import {
  backfillFromGlobal, getRanking, scanRecentMessages, subscribeKeywordTracker,
} from '../../util/keywordTracker';

import useHideForwarded from '../../hooks/useHideForwarded';

import MessageCard from './MessageCard';

import styles from './Dashboard.module.scss';

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const REFRESH_MS = 5000;
const FEED_LIMIT = 200;

type Tab = 'all' | CategoryKey;

const Dashboard = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [expandedId, setExpandedId] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>();

  const { isHideForwardedMessages, toggleHideForwarded } = useHideForwarded();

  useEffect(() => {
    const bump = () => setTick((t) => (t + 1) % 1_000_000);
    const unsub = subscribeKeywordTracker(bump);

    void backfillFromGlobal(getGlobal());

    const interval = window.setInterval(() => {
      scanRecentMessages(getGlobal());
      bump();
    }, REFRESH_MS);

    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSettingsOpen]);

  const global = getGlobal();

  const categoryCounts = useMemo(
    () => getCategoryCounts(global, WINDOW_MS),
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
    [tick, global.messages],
  );

  const feed: FeedItem[] = useMemo(() => {
    return collectFeed(global, {
      windowMs: WINDOW_MS,
      category: tab,
      search,
      limit: FEED_LIMIT,
      includeForwarded: !isHideForwardedMessages,
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [tick, tab, search, global.messages, isHideForwardedMessages]);

  const trending = useMemo(() => getRanking(10), [tick]);

  const totalChannels = Object.keys(global.chats.byId).filter(
    (id) => global.chats.byId[id]?.type === 'chatTypeChannel',
  ).length;

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
        <div className={styles.headerActions} ref={settingsRef}>
          <span>최근 {WINDOW_HOURS}h · 채널 {totalChannels}</span>
          <button
            type="button"
            className={styles.settingsBtn}
            onClick={() => setIsSettingsOpen((v) => !v)}
            aria-label="Settings"
          >
            ⚙ 설정
          </button>
          {isSettingsOpen && (
            <div className={styles.settingsPopover}>
              <label className={styles.settingRow}>
                <span className={styles.settingLabel}>포워딩 메시지 숨기기</span>
                <input
                  type="checkbox"
                  className={styles.settingToggle}
                  checked={isHideForwardedMessages}
                  onChange={toggleHideForwarded}
                />
              </label>
            </div>
          )}
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
            {feed.length === 0 ? (
              <div className={styles.emptyFeed}>
                {search
                  ? '검색 결과 없음'
                  : '수집된 채널 메시지가 없습니다. 잠시 후 자동으로 채워집니다.'}
              </div>
            ) : (
              feed.map((item) => {
                const id = `${item.chatId}:${item.messageId}`;
                return (
                  <MessageCard
                    key={id}
                    item={item}
                    isExpanded={expandedId === id}
                    onToggle={() => setExpandedId(expandedId === id ? undefined : id)}
                  />
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
