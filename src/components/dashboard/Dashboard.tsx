import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { MAIN_THREAD_ID } from '../../api/types';
import { LoadMoreDirection } from '../../types';

import type { CategoryKey } from '../../util/categoryClassifier';
import { ALL_CATEGORIES } from '../../util/categoryClassifier';
import {
  collectFeed, getCategoryCounts, type FeedItem,
} from '../../util/messageFeed';
import {
  backfillFromGlobal, getRanking, scanRecentMessages, subscribeKeywordTracker,
} from '../../util/keywordTracker';

import useHiddenCategories from '../../hooks/useHiddenCategories';
import useHideForwarded from '../../hooks/useHideForwarded';
import useOwnedChannels from '../../hooks/useOwnedChannels';

import CommentsModal from './CommentsModal';
import MessageCard from './MessageCard';
import MiniComposer from './MiniComposer';
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
  const { hiddenCategories, toggleHidden } = useHiddenCategories();

  // Load history when a single channel is selected. Keeps fetching older
  // batches until the message count stops growing — effectively full history.
  useEffect(() => {
    if (!channelFilter) return undefined;
    let cancelled = false;
    let prevCount = 0;
    let stableTicks = 0;

    const actions = getActions();
    actions.loadViewportMessages({ chatId: channelFilter, threadId: MAIN_THREAD_ID });

    const pullOlder = () => {
      if (cancelled || !channelFilter) return;
      actions.loadViewportMessages({
        chatId: channelFilter,
        threadId: MAIN_THREAD_ID,
        direction: LoadMoreDirection.Backwards,
      });
      const byId = getGlobal().messages.byChatId[channelFilter]?.byId;
      const count = byId ? Object.keys(byId).length : 0;
      if (count === prevCount) {
        stableTicks += 1;
        if (stableTicks >= 4) return;
      } else {
        stableTicks = 0;
      }
      prevCount = count;
      window.setTimeout(pullOlder, 700);
    };

    const timer = window.setTimeout(pullOlder, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [channelFilter]);

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
    const raw = collectFeed(global, {
      windowMs: channelFilter ? Number.MAX_SAFE_INTEGER : WINDOW_MS,
      category: channelFilter ? 'all' : tab,
      search,
      limit: channelFilter ? 2000 : FEED_LIMIT,
      includeForwarded: !isHideForwardedMessages,
      chatId: channelFilter,
    });
    if (channelFilter) return raw;
    return raw.filter((item) => !hiddenCategories.has(item.category));
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [tick, tab, search, global.messages, isHideForwardedMessages, channelFilter, hiddenCategories]);

  const ownedChannels = useOwnedChannels();

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
        {ALL_CATEGORIES
          .filter((cat) => !hiddenCategories.has(cat.key))
          .map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={`${styles.navItem} ${tab === cat.key && !channelFilter ? styles.navItemActive : ''}`}
              onClick={() => { setTab(cat.key); setChannelFilter(undefined); }}
              title={cat.description}
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
              return (
                <MyChannelItem
                  key={c.id}
                  chat={chat}
                  fallbackTitle={c.title}
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
                <div className={styles.settingsDivider} />
                <div className={styles.settingsSectionTitle}>카테고리 숨기기</div>
                {ALL_CATEGORIES.map((cat) => (
                  <label key={cat.key} className={styles.settingRow} title={cat.description}>
                    <span>{cat.emoji} {cat.label}</span>
                    <input
                      type="checkbox"
                      className={styles.settingToggle}
                      checked={hiddenCategories.has(cat.key)}
                      onChange={() => toggleHidden(cat.key)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {channelFilter && (
          <>
            <div className={styles.channelComposerWrap}>
              <MiniComposer
                chatId={channelFilter}
                threadId={MAIN_THREAD_ID}
                placeholder="무슨 공지를 작성하시겠어요?"
              />
            </div>
            <div className={styles.channelMeta}>
              {feed.length}개 로드됨 · 전체 히스토리 자동 로드 중
            </div>
          </>
        )}

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
