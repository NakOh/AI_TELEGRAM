export type CategoryKey = 'event' | 'announcement' | 'market' | 'chat';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  emoji: string;
  // Weighted keyword patterns. A message scoring highest across categories wins.
  patterns: RegExp[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'event',
    label: '이벤트',
    emoji: '🎁',
    patterns: [
      /이벤트/i, /에어드랍/i, /에어드롭/i, /airdrop/i, /추첨/i,
      /경품/i, /기프티콘/i, /지급/i, /참여/i, /리트윗/i, /retweet/i,
      /giveaway/i, /퀴즈/i, /쿠폰/i,
    ],
  },
  {
    key: 'announcement',
    label: '공지/상장',
    emoji: '📢',
    patterns: [
      /상장/i, /listing/i, /공지/i, /안내/i, /발표/i,
      /업데이트/i, /update/i, /출시/i, /launch/i, /오픈/i,
      /\[공지\]/i, /\[안내\]/i, /\[속보\]/i,
    ],
  },
  {
    key: 'market',
    label: '시장',
    emoji: '📈',
    patterns: [
      /\$[A-Z]{2,10}\b/, /\bBTC\b/i, /\bETH\b/i, /\bUSDT\b/i, /\bUSDC\b/i,
      /비트코인/i, /이더리움/i, /솔라나/i, /리플/i,
      /[+-]?\d+(?:\.\d+)?\s*%/, // percentages
      /차트/i, /시가총액/i, /마켓캡/i, /거래량/i,
      /상승/i, /하락/i, /급등/i, /급락/i, /돌파/i, /저항/i, /지지/i,
    ],
  },
];

const FALLBACK: CategoryDef = {
  key: 'chat',
  label: '잡담',
  emoji: '💬',
  patterns: [],
};

export const ALL_CATEGORIES: CategoryDef[] = [...CATEGORIES, FALLBACK];

export function classifyMessage(text: string): CategoryKey {
  if (!text) return 'chat';
  let bestKey: CategoryKey = 'chat';
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let score = 0;
    for (const pattern of cat.patterns) {
      if (pattern.test(text)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestKey = cat.key;
    }
  }

  return bestScore > 0 ? bestKey : 'chat';
}

export function getCategoryDef(key: CategoryKey): CategoryDef {
  return ALL_CATEGORIES.find((c) => c.key === key) || FALLBACK;
}
