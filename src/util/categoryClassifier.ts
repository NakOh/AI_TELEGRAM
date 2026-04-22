export type CategoryKey =
  | 'event'
  | 'announcement'
  | 'coin'
  | 'stock'
  | 'chart'
  | 'breaking'
  | 'guide'
  | 'scam'
  | 'chat';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  emoji: string;
  description: string;
  patterns: RegExp[];
  weight?: number;
}

// Ordering matters: higher-priority categories come first so ties break in their favor.
export const CATEGORIES: CategoryDef[] = [
  {
    key: 'scam',
    label: '스캠/주의',
    emoji: '⚠️',
    description: '피싱·러그풀·해킹 경고, 주의 안내',
    weight: 1.8,
    patterns: [
      /스캠/i, /scam/i, /러그풀/i, /rug\s*pull/i, /사기/, /피싱/i, /phishing/i,
      /해킹/i, /hack(ed)?/i, /유출/, /exploit/i, /경고/, /\[주의\]/, /\[경고\]/,
      /조심\s*하세요/,
    ],
  },
  {
    key: 'breaking',
    label: '속보',
    emoji: '🔥',
    description: '속보 / 긴급 / 단기 급등락 (±10% 이상)',
    weight: 1.5,
    patterns: [
      /\[속보\]/, /속보/i, /breaking/i, /긴급/, /urgent/i,
      /급등/, /급락/, /폭등/, /폭락/, /상한가/, /하한가/,
      /pump(ing)?/i, /dump(ing)?/i,
      /[+-]?\d{2,}(?:\.\d+)?\s*%/, // ≥ 2 자릿수 % 값
    ],
  },
  {
    key: 'event',
    label: '이벤트/에어드랍',
    emoji: '🎁',
    description: '에어드랍·추첨·경품·기프티콘·WL·민팅·giveaway',
    weight: 1.2,
    patterns: [
      /이벤트/i, /에어드랍/, /에어드롭/, /airdrop/i, /추첨/, /경품/,
      /기프티콘/, /giveaway/i, /퀴즈/, /쿠폰/i,
      /whitelist/i, /화이트리스트/, /\bWL\b/, /free\s*mint/i, /프리\s*민팅/,
      /참여\s*방법/, /참가\s*신청/, /리트윗\s*이벤트/,
      /\bNFT\b.*(민팅|mint|airdrop|에어드랍)/i,
    ],
  },
  {
    key: 'announcement',
    label: '공지/상장',
    emoji: '📢',
    description: '거래소 상장·프로젝트 공식 공지·업데이트',
    weight: 1.2,
    patterns: [
      /상장/, /listing/i,
      /공지/, /\[공지\]/, /\[안내\]/, /\[발표\]/, /\[업데이트\]/,
      /업데이트/, /update/i, /출시/, /launch/i, /오픈/, /open/i,
      /신규\s*상장/, /new\s*listing/i, /대규모\s*업데이트/,
    ],
  },
  {
    key: 'stock',
    label: '주식',
    emoji: '📊',
    description: '국내/해외 주식, 지수, ETF, 종목 분석',
    patterns: [
      /주식/, /주가/, /증시/, /증권/, /코스피/i, /코스닥/i, /kospi/i, /kosdaq/i,
      /\bS&P/i, /나스닥/i, /nasdaq/i, /다우/i, /\bDOW\b/i, /russell/i,
      /\bETF\b/i, /실적/, /earnings/i, /\bEPS\b/i, /\bPER\b/i, /\bPBR\b/i, /\bROE\b/i,
      /배당/, /dividend/i, /공모주/, /\bIPO\b/i, /종목/,
      /삼성전자/, /\bSK하이닉스/i, /현대차/, /네이버/, /카카오뱅크/,
      /애플/, /\bapple\b/i, /tesla/i, /테슬라/, /엔비디아/i, /nvidia/i,
      /\bAMD\b/i, /미국\s*증시/, /한국\s*증시/,
    ],
  },
  {
    key: 'coin',
    label: '코인',
    emoji: '🪙',
    description: '암호화폐 가격·프로젝트·DeFi·거래소',
    patterns: [
      /\$[A-Z]{2,10}\b/, /\bBTC\b/i, /\bETH\b/i, /\bSOL\b/i, /\bUSDT\b/i,
      /\bUSDC\b/i, /\bBNB\b/i, /\bXRP\b/i, /\bADA\b/i, /\bDOGE\b/i, /\bSHIB\b/i,
      /비트코인/, /이더리움/, /솔라나/, /리플/, /도지/, /시바/,
      /\bdefi\b/i, /디파이/i, /\bstaking\b/i, /스테이킹/, /liquidity/i, /유동성/,
      /\bLP\b/, /\byield\b/i, /farming/i, /\bDEX\b/i, /\bCEX\b/i,
      /업비트/, /빗썸/, /바이낸스/i, /binance/i, /upbit/i, /bithumb/i,
      /\bTVL\b/, /온체인/, /on[-\s]?chain/i, /\bwallet\b/i, /지갑/,
      /프리세일/, /presale/i, /메인넷/, /mainnet/i, /테스트넷/, /testnet/i,
      /\bIDO\b/i, /\bICO\b/i,
    ],
  },
  {
    key: 'chart',
    label: '시황/분석',
    emoji: '📈',
    description: '기술적 분석·차트·시장 동향 (수치 분석 위주)',
    patterns: [
      /차트/, /chart/i, /시가총액/, /market\s*cap/i, /마켓캡/, /거래량/, /volume/i,
      /저항/, /지지선?/, /돌파/, /이탈/, /breakout/i, /support/i, /resistance/i,
      /이평선?/, /\bMA\s*\d+/i, /\bRSI\b/i, /\bMACD\b/i, /bollinger/i, /볼린저/,
      /시황/, /시장\s*동향/, /전망/, /outlook/i,
      /상승\s*추세/, /하락\s*추세/, /보합/, /반등/, /조정/,
    ],
  },
  {
    key: 'guide',
    label: '정보/가이드',
    emoji: '🎓',
    description: '튜토리얼·FAQ·리서치·기초 설명',
    patterns: [
      /가이드/, /guide/i, /튜토리얼/, /tutorial/i, /\bhow\s*to\b/i,
      /정리/, /요약/, /\bFAQ\b/, /\bQ&A\b/,
      /기초/, /입문/, /beginner/i,
      /\[정보\]/, /\[분석\]/, /\[리서치\]/i, /리서치/i, /research/i,
      /사용법/, /이해하기/,
    ],
  },
];

const FALLBACK: CategoryDef = {
  key: 'chat',
  label: '잡담',
  emoji: '💬',
  description: '위에 해당하지 않는 잡담·공감·짧은 대화',
  patterns: [],
};

export const ALL_CATEGORIES: CategoryDef[] = [...CATEGORIES, FALLBACK];

export function classifyMessage(text: string): CategoryKey {
  if (!text) return 'chat';
  let bestKey: CategoryKey = 'chat';
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let matches = 0;
    for (const pattern of cat.patterns) {
      if (pattern.test(text)) matches += 1;
    }
    if (matches === 0) continue;
    const score = matches * (cat.weight ?? 1);
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
