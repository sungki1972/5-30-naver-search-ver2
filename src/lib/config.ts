// 중앙 설정 + BUILD_ID (수정마다 올림 — 서버/클라이언트 일치 감지용)
export const BUILD_ID = "2026.06.16-001";

// 매칭 신뢰도 게이트 (env로 override)
export const MATCH_CONFIDENCE_THRESHOLD = Number(
  process.env.MATCH_CONFIDENCE_THRESHOLD ?? "0.80",
);

// 가격 결정 룰 (ver1 build_pricelist.py 룰)
export const DEFAULT_MIN_MARGIN = 0.12; // 마진 하한율 (권장가 = 시장기준 × (1+margin) → 천원 올림)

// 수집 파라미터
export const COLLECT = {
  display: 100, // 호출당 최대
  pages: [1, 101] as const, // start 값 (2페이지)
  ratePerSec: 9, // 토큰버킷 (~초당 9, 429 회피)
  dailyLimit: 25000, // 네이버 일일 한도
  minPrice: 1500, // 노이즈 컷 (ver1)
  chunkSize: 25, // chunk당 SKU 수 (Vercel 타임아웃 회피)
};

// 알림 임계값
export const ALERT = {
  priceDropPct: -15, // WoW 시세 급락 경보 임계 (%)
};

// Claude 모델
export const HAIKU_MODEL = "claude-haiku-4-5-20251001";

// 천원 단위 올림 (ver1 사용자 룰: 4550×1.10→5005→ceil→6000 패턴, ceil 사용)
export function ceilToThousand(n: number): number {
  return Math.ceil(n / 1000) * 1000;
}

function reqEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

export const env = {
  supabaseUrl: () => reqEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceKey: () => reqEnv("SUPABASE_SERVICE_ROLE_KEY"),
  naverClientId: () => reqEnv("NAVER_CLIENT_ID"),
  naverClientSecret: () => reqEnv("NAVER_CLIENT_SECRET"),
  telegramToken: () => process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: () => process.env.TELEGRAM_CHAT_ID ?? "",
  anthropicKey: () => reqEnv("ANTHROPIC_API_KEY"),
  cronSecret: () => reqEnv("CRON_SECRET"),
  qstashToken: () => process.env.QSTASH_TOKEN ?? "",
  appUrl: () => process.env.APP_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000",
};
