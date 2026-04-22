import type { ApiChat } from '../api/types';
import type { GlobalState } from '../global/types';

const WINDOW_MS = 60 * 60 * 1000;
const RECENT_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 15000;
const MIN_COUNT = 2;
const GENERIC_CHAT_RATIO = 0.6;
const STORAGE_KEY = 'trendingEntriesV2';
const SAVE_DEBOUNCE_MS = 3000;

type Entry = {
  keyword: string;
  chatId: string;
  timestamp: number;
  weight: number;
};

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
  'http', 'https', 'www', 'com', 'net', 'org', 'kr', 'co', 'io', 'app',
  'html', 'utm', 'ref', 'src', 'bit', 'ly', 'tco', 'png', 'jpg',
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

function messageStructureWeight(text: string): number {
  let w = 1;
  // Chatter penalty: "ㅋㅋㅋ", "ㅎㅎ", lots of emoji-only content
  if (/[ㅋㅎ]{2,}/.test(text)) w *= 0.35;
  // Short message penalty
  if (text.length < 20) w *= 0.5;
  else if (text.length < 50) w *= 0.8;
  // Long structured message bonus (multi-line, bracket headers, bullet lists)
  const lineCount = (text.match(/\n/g) || []).length + 1;
  if (lineCount >= 3) w *= 1.4;
  if (/\[[^\]]{1,20}\]/.test(text)) w *= 1.3; // [공지], [속보], [거래]
  if (/^[\s]*[•·\-\*\d]+[.)]\s/m.test(text)) w *= 1.15;
  return Math.max(0.15, Math.min(w, 2));
}

// Per-keyword "shape" boost. Hashtags / tickers / mixed-script proper nouns
// get amplified because they're almost always informational.
function keywordShapeBoost(original: string): number {
  if (original.startsWith('#') || original.startsWith('$')) return 2;
  // All-caps English 2-6 chars (tickers, acronyms)
  if (/^[A-Z]{2,6}$/.test(original)) return 1.6;
  // Mixed Korean + ASCII (ex: 스페이스X, 1000x)
  if (/[\uac00-\ud7af]/.test(original) && /[A-Za-z0-9]/.test(original)) return 1.3;
  // Proper-noun-ish: starts with capital, contains digits or X
  if (/^[A-Z][A-Za-z0-9]{2,}$/.test(original)) return 1.25;
  return 1;
}

type Extracted = { keyword: string; boost: number };

function extractKeywords(text: string): Extracted[] {
  if (!text) return [];
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[\w.-]+\.(?:com|net|org|io|co|kr|app|html|xyz|gg)\b\S*/gi, ' ');
  const tokens = cleaned.split(/[\s.,!?…·“”""''()\[\]{}<>~@|\-—/\\\n\r\t:;"「」『』]+/);
  const result: Extracted[] = [];
  for (const raw of tokens) {
    if (!raw) continue;
    // Hashtag / ticker: keep prefix, lowercase the rest
    if (/^[#$][\p{L}\p{N}_]{2,}/u.test(raw)) {
      const prefix = raw[0];
      const body = raw.slice(1).toLowerCase();
      result.push({ keyword: `${prefix}${body}`, boost: keywordShapeBoost(raw) });
      continue;
    }
    let token = raw.replace(/^[^\p{L}\p{N}#$]+|[^\p{L}\p{N}]+$/gu, '');
    if (!token) continue;
    const boost = keywordShapeBoost(token);
    token = stripParticle(token);
    const lower = token.toLowerCase();
    if (lower.length < 2) continue;
    if (/^\d+$/.test(lower)) continue;
    if (/^[a-z0-9]+$/.test(lower) && lower.length < 3) continue;
    if (STOPWORDS.has(lower)) continue;
    result.push({ keyword: lower, boost });
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
        weight: typeof e.weight === 'number' ? e.weight : 1,
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
  const extracted = extractKeywords(text);
  if (!extracted.length) return;
  const structure = messageStructureWeight(text);
  for (const { keyword, boost } of extracted) {
    entries.push({
      keyword, chatId, timestamp, weight: structure * boost,
    });
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
  const now = Date.now();
  const recentCutoff = now - RECENT_MS;
  const baselineMinutes = (WINDOW_MS - RECENT_MS) / 60000;
  const recentMinutes = RECENT_MS / 60000;

  type Agg = {
    totalWeight: number;
    recentWeight: number;
    baselineWeight: number;
    count: number;
    chats: Set<string>;
  };
  const agg = new Map<string, Agg>();
  const allChats = new Set<string>();

  for (const e of entries) {
    if (e.chatId) allChats.add(e.chatId);
    let a = agg.get(e.keyword);
    if (!a) {
      a = {
        totalWeight: 0, recentWeight: 0, baselineWeight: 0, count: 0, chats: new Set(),
      };
      agg.set(e.keyword, a);
    }
    a.totalWeight += e.weight;
    a.count += 1;
    if (e.timestamp >= recentCutoff) a.recentWeight += e.weight;
    else a.baselineWeight += e.weight;
    if (e.chatId) a.chats.add(e.chatId);
  }
  const totalChats = Math.max(allChats.size, 1);

  const scored = Array.from(agg.entries()).map(([keyword, a]) => {
    const recentRate = a.recentWeight / recentMinutes;
    const baselineRate = a.baselineWeight / baselineMinutes;
    const burst = (recentRate + 0.1) / (baselineRate + 0.3);
    const resonance = Math.log(a.chats.size + 1) + 0.5;
    const score = a.totalWeight * burst * resonance;
    return {
      keyword, count: a.count, chatCount: a.chats.size, score,
    };
  });

  return scored
    .filter(({ count }) => count >= MIN_COUNT)
    .filter(({ chatCount, keyword }) => {
      if (keyword.startsWith('#') || keyword.startsWith('$')) return true;
      return totalChats < 4 || chatCount <= totalChats * GENERIC_CHAT_RATIO;
    })
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
