export type CategoryKey =
  | 'event'
  | 'announcement'
  | 'coin'
  | 'stock'
  | 'chart'
  | 'breaking'
  | 'guide'
  | 'scam'
  | 'project'
  | 'chat';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  emoji: string;
  patterns: RegExp[];
  // Higher priority when multiple match with equal raw score.
  weight?: number;
}

export const CATEGORIES: CategoryDef[] = [
  {
    key: 'scam',
    label: '경고/스캠',
    emoji: '⚠️',
    weight: 1.5,
    patterns: [
      /스캠/i, /scam/i, /러그풀/i, /rug\s*pull/i, /사기/, /피싱/i, /phishing/i,
      /주의[!！]/, /경고[!！]/, /조심/, /해킹/i, /hack(ed)?/i, /유출/, /exploit/i,
      /\[주의\]/, /\[경고\]/,
    ],
  },
  {
    key: 'breaking',
    label: '속보/급등락',
    emoji: '🔥',
    weight: 1.3,
    patterns: [
      /\[속보\]/, /속보/i, /breaking/i, /긴급/, /urgent/i,
      /급등/, /급락/, /폭등/, /폭락/, /상한가/, /하한가/,
      /pump(ing)?/i, /dump(ing)?/i, /moon(ing)?/i,
      /[+-]?\d{2,}(?:\.\d+)?\s*%/, // large percentages (>= 2 digits)
    ],
  },
  {
    key: 'event',
    label: '이벤트/에어드랍',
    emoji: '🎁',
    patterns: [
      /이벤트/i, /에어드랍/, /에어드롭/, /airdrop/i, /추첨/, /경품/,
      /기프티콘/, /지급/, /리트윗/, /retweet/i, /giveaway/i, /퀴즈/,
      /쿠폰/i, /coupon/i, /whitelist/i, /화이트리스트/, /\bWL\b/,
      /free\s*mint/i, /프리\s*민팅/, /참여\s*방법/, /참가\s*신청/,
    ],
  },
  {
    key: 'announcement',
    label: '공지/상장',
    emoji: '📢',
    patterns: [
      /상장/, /listing/i, /공지/, /안내/, /발표/,
      /업데이트/, /update/i, /출시/, /launch/i, /오픈/, /open/i,
      /\[공지\]/, /\[안내\]/, /\[발표\]/, /\[업데이트\]/,
      /신규\s*상장/, /new\s*listing/i,
    ],
  },
  {
    key: 'project',
    label: '프로젝트/NFT',
    emoji: '💎',
    patterns: [
      /\bNFT\b/i, /민팅/, /minting/i, /mint\b/i, /\bIDO\b/i, /\bICO\b/i, /\bIEO\b/i,
      /세일/, /sale\b/i, /프리세일/, /presale/i, /토큰노믹스/i, /tokenomics/i,
      /로드맵/i, /roadmap/i, /백서/i, /whitepaper/i,
      /testnet/i, /테스트넷/, /mainnet/i, /메인넷/,
    ],
  },
  {
    key: 'stock',
    label: '주식',
    emoji: '📊',
    patterns: [
      /\b[A-Z]{2,5}\b(?=.*?(주가|주식|실적|시가총액))/i,
      /주식/, /주가/, /증시/, /증권/, /코스피/i, /코스닥/i, /kospi/i, /kosdaq/i,
      /\bS&P/i, /나스닥/i, /nasdaq/i, /다우/i, /dow/i, /russell/i,
      /실적/, /earnings/i, /eps\b/i, /per\b/i, /pbr\b/i, /roe\b/i,
      /배당/, /dividend/i, /공모주/, /ipo\b/i, /종목/,
      /삼성전자/, /\bsk하이닉스/i, /현대차/, /네이버/, /카카오/,
      /애플/, /apple/i, /tesla/i, /테슬라/, /엔비디아/i, /nvidia/i, /amd\b/i,
    ],
  },
  {
    key: 'coin',
    label: '코인/암호화폐',
    emoji: '🪙',
    patterns: [
      /\$[A-Z]{2,10}\b/, /\bBTC\b/i, /\bETH\b/i, /\bSOL\b/i, /\bUSDT\b/i,
      /\bUSDC\b/i, /\bBNB\b/i, /\bXRP\b/i, /\bADA\b/i, /\bDOGE\b/i, /\bSHIB\b/i,
      /비트코인/, /이더리움/, /솔라나/, /리플/, /도지/, /시바/,
      /\bdefi\b/i, /디파이/i, /staking/i, /스테이킹/, /liquidity/i, /유동성/,
      /\bLP\b/, /yield/i, /farming/i, /\bDEX\b/i, /\bCEX\b/i,
      /업비트/, /빗썸/, /바이낸스/i, /binance/i, /upbit/i, /bithumb/i,
      /\bTVL\b/, /온체인/, /on[-\s]?chain/i, /wallet/i, /지갑/,
    ],
  },
  {
    key: 'chart',
    label: '시황/차트',
    emoji: '📈',
    patterns: [
      /차트/, /chart/i, /시가총액/, /market\s*cap/i, /마켓캡/, /거래량/, /volume/i,
      /저항/, /지지/, /돌파/, /이탈/, /breakout/i, /support/i, /resistance/i,
      /이평선/, /이평/, /ma\s*\d+/i, /rsi/i, /macd/i, /bollinger/i,
      /시황/, /시장\s*동향/, /분석/, /analysis/i, /전망/, /outlook/i,
      /상승/, /하락/, /보합/,
      /[+-]?\d+(?:\.\d+)?\s*%/, // any percentage (lower priority than breaking)
    ],
  },
  {
    key: 'guide',
    label: '정보/가이드',
    emoji: '🎓',
    patterns: [
      /가이드/, /guide/i, /튜토리얼/, /tutorial/i, /방법/, /how\s*to/i,
      /설명/, /정리/, /요약/, /\bFAQ\b/, /\bQ&A\b/,
      /기초/, /입문/, /beginner/i, /기본/,
      /\[정보\]/, /\[분석\]/, /\[리서치\]/i, /리서치/i, /research/i,
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
