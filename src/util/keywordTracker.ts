import type { ApiChat } from '../api/types';
import type { GlobalState } from '../global/types';

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 10000;
const MIN_COUNT = 2;
const GENERIC_CHAT_RATIO = 0.5;
const STORAGE_KEY = 'trendingEntriesV1';
const SAVE_DEBOUNCE_MS = 3000;

type Entry = { keyword: string; chatId: string; timestamp: number };

const entries: Entry[] = [];
const listeners = new Set<() => void>();
const backfilledChats = new Set<string>();
const seenMessages = new Set<string>();
let isBackfilling = false;
let saveTimer: number | undefined;

function isChannel(chat: ApiChat | undefined): boolean {
  return chat?.type === 'chatTypeChannel';
}

const STOPWORDS = new Set([
  '있습니다', '없습니다', '합니다', '입니다', '그리고', '하지만', '그러나',
  '때문', '오늘', '지금', '바로', '모두', '우리', '여러분', '정말', '진짜',
  '이것', '저것', '그것', '여기', '저기', '거기', '이거', '저거', '그거',
  '이건', '저건', '그건', '이번', '저번', '지난', '다음', '이미', '아직',
  '원래', '그냥', '완전', '조금', '많이', '너무', '매우', '굉장히', '항상',
  '가장', '최고', '사실', '일단', '우선', '먼저', '다시', '또한', '또는',
  '하는', '되는', '있는', '없는', '같은', '다른', '어떤', '무슨', '어느',
  '만큼', '처럼', '보다', '대한', '위한', '통해', '보면', '하면', '이라',
  '으로', '에서', '까지', '부터', '에게', '한테', '라고', '이라고', '라는',
  '이라는', '라서', '이라서', '라면', '이라면',
  '마감', '주말', '평일', '아침', '저녁', '오후', '오전', '내일', '어제',
  '올해', '작년', '내년', '지난주', '이번주', '다음주', '이번달', '다음달',
  '신청', '조건', '참여', '발표', '공지', '안내', '소식', '최근',
  '시작', '종료', '진행', '확인', '가능', '필요', '사용', '이용',
  '관련', '경우', '부분', '내용', '상태', '상황', '방법', '결과',
  'the', 'and', 'for', 'you', 'are', 'with', 'that', 'this', 'from', 'have',
  'has', 'was', 'were', 'been', 'will', 'your', 'our', 'all', 'can', 'but',
  'not', 'its', 'their', 'about', 'out', 'get', 'got', 'now', 'new', 'one',
  'two', 'may', 'say', 'says', 'said', 'just', 'also',
]);

const PARTICLES = [
  '으로부터', '에서부터', '이라고', '이라는', '이라서', '이라면',
  '로부터', '에서', '까지', '부터', '에게', '한테', '라고', '라는', '라서', '라면',
  '으로', '에다', '이나', '마저', '조차',
  '이다', '이고', '이며', '이라', '이면',
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로', '나',
];

function stripParticle(word: string): string {
  for (const p of PARTICLES) {
    if (word.length > p.length + 1 && word.endsWith(p)) {
      return word.slice(0, -p.length);
    }
  }
  return word;
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const tokens = text.split(/[\s.,!?…·“”""''()\[\]{}<>~@|\-—/\\\n\r\t:;"「」『』]+/);
  const result: string[] = [];
  for (const raw of tokens) {
    if (!raw) continue;
    if (/^[#$][\p{L}\p{N}_]{2,}/u.test(raw)) {
      result.push(raw.toLowerCase());
      continue;
    }
    if (/^https?:/.test(raw)) continue;
    let token = raw.replace(/^[^\p{L}\p{N}#$]+|[^\p{L}\p{N}]+$/gu, '');
    if (!token) continue;
    token = stripParticle(token);
    const lower = token.toLowerCase();
    if (lower.length < 2) continue;
    if (/^\d+$/.test(lower)) continue;
    if (/^[a-z0-9]+$/.test(lower) && lower.length < 3) continue;
    if (STOPWORDS.has(lower)) continue;
    result.push(lower);
  }
  return result;
}

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  let i = 0;
  while (i < entries.length && entries[i].timestamp < cutoff) i++;
  if (i > 0) entries.splice(0, i);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  // Keep seenMessages bounded
  if (seenMessages.size > MAX_ENTRIES * 2) {
    seenMessages.clear();
  }
}

function notify() {
  listeners.forEach((l) => l());
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Entry[];
    if (!Array.isArray(parsed)) return;
    const cutoff = Date.now() - WINDOW_MS;
    for (const e of parsed) {
      if (!e || typeof e !== 'object') continue;
      if (typeof e.keyword !== 'string' || typeof e.timestamp !== 'number') continue;
      if (e.timestamp < cutoff) continue;
      entries.push({
        keyword: e.keyword,
        chatId: typeof e.chatId === 'string' ? e.chatId : '',
        timestamp: e.timestamp,
      });
    }
  } catch {
    // ignore
  }
}

function scheduleSave() {
  if (saveTimer !== undefined) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore quota errors
    }
  }, SAVE_DEBOUNCE_MS);
}

loadFromStorage();

function pushSilent(text: string, timestamp: number, chatId: string) {
  const keywords = extractKeywords(text);
  if (!keywords.length) return;
  for (const k of keywords) {
    entries.push({ keyword: k, chatId, timestamp });
  }
  scheduleSave();
}

export function pushMessageText(
  text: string,
  timestamp: number = Date.now(),
  chatId: string = '',
) {
  pushSilent(text, timestamp, chatId);
  prune();
  notify();
}

export function getRanking(limit = 10): Array<{ keyword: string; count: number }> {
  prune();
  const perKeyword = new Map<string, { count: number; chats: Set<string> }>();
  const allChats = new Set<string>();
  for (const e of entries) {
    if (e.chatId) allChats.add(e.chatId);
    let info = perKeyword.get(e.keyword);
    if (!info) {
      info = { count: 0, chats: new Set() };
      perKeyword.set(e.keyword, info);
    }
    info.count += 1;
    if (e.chatId) info.chats.add(e.chatId);
  }
  const totalChats = Math.max(allChats.size, 1);

  return Array.from(perKeyword.entries())
    .map(([keyword, { count, chats }]) => {
      const chatCount = Math.max(chats.size, 1);
      const idf = Math.log((totalChats + 1) / chatCount) + 1;
      const score = count * idf;
      return { keyword, count, chatCount, score };
    })
    .filter(({ count }) => count >= MIN_COUNT)
    .filter(({ chatCount }) => totalChats < 4 || chatCount <= totalChats * GENERIC_CHAT_RATIO)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ keyword, count }) => ({ keyword, count }));
}

export function getTotalTokenCount(): number {
  prune();
  return entries.length;
}

export function getIsBackfilling() {
  return isBackfilling;
}

export function subscribeKeywordTracker(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function markMessageSeen(chatId: string, messageId: number) {
  seenMessages.add(`${chatId}:${messageId}`);
}

// Scan currently-loaded messages for any we haven't indexed yet.
// Called periodically so messages loaded via chat opens get picked up.
export function scanRecentMessages(global: GlobalState) {
  const cutoff = Date.now() - WINDOW_MS;
  let added = 0;
  for (const chatId of Object.keys(global.messages.byChatId)) {
    const chat = global.chats.byId[chatId];
    if (!isChannel(chat)) continue;
    const byId = global.messages.byChatId[chatId]?.byId;
    if (!byId) continue;
    for (const id in byId) {
      const key = `${chatId}:${id}`;
      if (seenMessages.has(key)) continue;
      seenMessages.add(key);
      const message = byId[id];
      if (!message) continue;
      const ts = message.date ? message.date * 1000 : 0;
      if (ts < cutoff) continue;
      const text = message.content?.text?.text;
      if (!text) continue;
      pushSilent(text, ts, chatId);
      added += 1;
    }
  }
  if (added > 0) {
    prune();
    notify();
  }
}

export async function backfillFromGlobal(global: GlobalState) {
  if (isBackfilling) return;
  isBackfilling = true;
  notify();

  await new Promise<void>((resolve) => { setTimeout(resolve, 0); });

  try {
    const cutoff = Date.now() - WINDOW_MS;
    const chatIds = [
      ...(global.chats.listIds.active || []),
      ...(global.chats.listIds.archived || []),
    ];

    for (const chatId of chatIds) {
      if (backfilledChats.has(chatId)) continue;
      const chat = global.chats.byId[chatId];
      if (!isChannel(chat)) {
        backfilledChats.add(chatId);
        continue;
      }
      const messagesById = global.messages.byChatId[chatId]?.byId;
      if (!messagesById) {
        backfilledChats.add(chatId);
        continue;
      }

      for (const id in messagesById) {
        const key = `${chatId}:${id}`;
        if (seenMessages.has(key)) continue;
        seenMessages.add(key);
        const message = messagesById[id];
        if (!message) continue;
        const timestamp = message.date ? message.date * 1000 : 0;
        if (timestamp < cutoff) continue;
        const text = message.content?.text?.text;
        if (!text) continue;
        pushSilent(text, timestamp, chatId);
      }
      backfilledChats.add(chatId);

      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
      prune();
      notify();
    }
  } finally {
    isBackfilling = false;
    notify();
  }
}
