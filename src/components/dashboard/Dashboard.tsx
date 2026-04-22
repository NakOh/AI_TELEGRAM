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

import CommentsModal from './CommentsModal';
import MessageCard from './MessageCard';
import MyChannelItem from './MyChannelItem';

import styles from './Dashboard.module.scss';

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;
const REFRESH_MS = 5000;
const FEED_LIMIT = 200;

type Tab = 'all' | CategoryKey;

const Dashboard = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [channelFilter, setChannelFilter] = useState<string | undefined>();
  const [openCard, setOpenCard] = useState<{ chatId: string; messageId: number } | undefined>();
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
      category: channelFilter ? 'all' : tab,
      search,
      limit: FEED_LIMIT,
      includeForwarded: !isHideForwardedMessages,
      chatId: channelFilter,
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [tick, tab, search, global.messages, isHideForwardedMessages, channelFilter]);

  const ownedChannels = useMemo(() => {
    const out: Array<{ id: string; title: string }> = [];
    for (const id of Object.keys(global.chats.byId)) {
      const chat = global.chats.byId[id];
      if (!chat || chat.type !== 'chatTypeChannel') continue;
      if (!(chat.isCreator || chat.adminRights)) continue;
      out.push({ id, title: chat.title || id });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [tick, global.chats]);

  const trending = useMemo(() => getRanking(10), [tick]);

  const totalChannels = Object.keys(global.chats.byId).filter(
    (id) => global.chats.byId[id]?.type === 'chatTypeChannel',
  ).length;

  const totalAll = Object.values(categoryCounts).reduce((a, b) => a + b, 0);

  const currentTitle = channelFilter
    ? (global.chats.byId[channelFilter]?.title || '내 채널')
    : tab === 'all'
      ? '홈'
      : `${ALL_CATEGORIES.find((c) => c.key === tab)?.emoji || ''} ${ALL_CATEGORIES.find((c) => c.key === tab)?.label || ''}`;

  return (
    <div className={styles.dashboard}>
      {/* Left nav */}
      <aside className={styles.leftNav}>
        <div className={styles.brand}>📊 TG Dash</div>
        <button
          type="button"
          className={`${styles.navItem} ${tab === 'all' && !channelFilter ? styles.navItemActive : ''}`}
          onClick={() => { setTab('all'); setChannelFilter(undefined); }}
        >
          <span className={styles.navIcon}>🏠</span>
          <span>전체</span>
          <span className={styles.navCount}>{totalAll}</span>
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={`${styles.navItem} ${tab === cat.key && !channelFilter ? styles.navItemActive : ''}`}
            onClick={() => { setTab(cat.key); setChannelFilter(undefined); }}
          >
            <span className={styles.navIcon}>{cat.emoji}</span>
            <span>{cat.label}</span>
            <span className={styles.navCount}>{categoryCounts[cat.key] || 0}</span>
          </button>
        ))}

        {ownedChannels.length > 0 && (
          <>
            <div className={styles.navSectionTitle}>내 채널</div>
            {ownedChannels.map((c) => {
              const chat = global.chats.byId[c.id];
              if (!chat) return undefined;
              return (
                <MyChannelItem
                  key={c.id}
                  chat={chat}
                  onClick={() => setChannelFilter(channelFilter === c.id ? undefined : c.id)}
                />
              );
            })}
          </>
        )}

        <div className={styles.navSpacer} />
        <div className={styles.navFooter}>
          채널 {totalChannels} · 최근 {WINDOW_HOURS}시간
        </div>
      </aside>

      {/* Center feed */}
      <section className={styles.feedColumn}>
        <div className={styles.feedHeader}>
          <div className={styles.feedTitle}>{currentTitle}</div>
          <div className={styles.feedSub}>{feed.length}개</div>
          <div className={styles.settingsWrap} ref={settingsRef}>
            <button
              type="button"
              className={styles.settingsBtn}
              onClick={() => setIsSettingsOpen((v) => !v)}
            >
              ⚙
            </button>
            {isSettingsOpen && (
              <div className={styles.settingsPopover}>
                <label className={styles.settingRow}>
                  <span>포워딩 메시지 숨기기</span>
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
                  searchQuery={search}
                  onOpen={() => setOpenCard({ chatId: item.chatId, messageId: item.messageId })}
                />
              );
            })
          )}
        </div>
      </section>

      {/* Right panel */}
      <aside className={styles.rightColumn}>
        <div className={styles.searchWrap}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="🔍  검색"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideCardTitle}>🔥 실시간 키워드</div>
          {trending.length === 0 ? (
            <div className={styles.emptyFeed}>수집 중…</div>
          ) : (
            <ol className={styles.trendingList}>
              {trending.map(({ keyword, count }, i) => (
                <li
                  key={keyword}
                  className={`${styles.trendingItem} ${styles.trendingItemClickable}`}
                  onClick={() => {
                    const query = keyword.replace(/^[#$]/, '');
                    setSearch(query);
                    setTab('all');
                  }}
                >
                  <span className={styles.trendingRank}>{i + 1}</span>
                  <span className={styles.trendingKeyword}>{keyword}</span>
                  <span className={styles.trendingCount}>{count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className={styles.sideCard}>
          <div className={styles.sideCardTitle}>카테고리</div>
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
      </aside>

      {openCard && (
        <CommentsModal
          chatId={openCard.chatId}
          messageId={openCard.messageId}
          onClose={() => setOpenCard(undefined)}
        />
      )}
    </div>
  );
};

export default memo(Dashboard);
