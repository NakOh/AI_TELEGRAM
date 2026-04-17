const WINDOW_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 5000;

type Entry = { keyword: string; timestamp: number };

const entries: Entry[] = [];
const listeners = new Set<() => void>();

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
  'the', 'and', 'for', 'you', 'are', 'with', 'that', 'this', 'from', 'have',
  'has', 'was', 'were', 'been', 'will', 'your', 'our', 'all', 'can', 'but',
  'not', 'its', 'their',
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
    // Hashtag / ticker preserve as-is
    if (/^[#$]\w+/.test(raw)) {
      result.push(raw.toLowerCase());
      continue;
    }
    // Drop URLs
    if (/^https?:/.test(raw)) continue;
    // Strip trailing punctuation
    let token = raw.replace(/^[^\p{L}\p{N}#$]+|[^\p{L}\p{N}]+$/gu, '');
    if (!token) continue;
    token = stripParticle(token);
    const lower = token.toLowerCase();
    if (lower.length < 2) continue;
    if (/^\d+$/.test(lower)) continue;
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
}

function notify() {
  listeners.forEach((l) => l());
}

export function pushMessageText(text: string, timestamp: number = Date.now()) {
  const keywords = extractKeywords(text);
  if (!keywords.length) return;
  for (const k of keywords) {
    entries.push({ keyword: k, timestamp });
  }
  prune();
  notify();
}

export function getRanking(limit = 10): Array<{ keyword: string; count: number }> {
  prune();
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.keyword, (counts.get(e.keyword) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword, count]) => ({ keyword, count }));
}

export function subscribeKeywordTracker(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
