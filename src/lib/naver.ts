import { env, COLLECT } from "./config";
import { NaverItem } from "./types";

// 토큰버킷 rate limiter (단일 프로세스 내 ~초당 N회)
class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity;
    this.last = Date.now();
  }
  async take(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const elapsed = (now - this.last) / 1000;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
      this.last = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.refillPerSec) * 1000);
      await sleep(waitMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const bucket = new TokenBucket(COLLECT.ratePerSec, COLLECT.ratePerSec);

export interface SearchResult {
  total: number;
  items: NaverItem[];
  apiCalls: number;
}

// 단일 API 호출 (429 지수 백오프)
async function callOnce(
  query: string,
  start: number,
  sort: "asc" | "sim",
): Promise<NaverItem[]> {
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(
    query,
  )}&display=${COLLECT.display}&start=${start}&sort=${sort}`;
  let backoff = 1000;
  for (let attempt = 0; attempt < 4; attempt++) {
    await bucket.take();
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": env.naverClientId(),
        "X-Naver-Client-Secret": env.naverClientSecret(),
        "User-Agent": "naver-pricewatch/2.0",
      },
    });
    if (res.status === 429) {
      await sleep(backoff);
      backoff *= 2;
      continue;
    }
    if (!res.ok) {
      throw new Error(`Naver API ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return (data.items ?? []) as NaverItem[];
  }
  throw new Error(`Naver API 429 persisted after retries: ${query}`);
}

// 한 질의어를 2페이지(start 1,101) × 정렬로 수집. maxPages로 축소 가능(검색어 테스트용).
export async function searchQuery(
  query: string,
  sort: "asc" | "sim" = "asc",
  maxPages: number = COLLECT.pages.length,
): Promise<SearchResult> {
  const items: NaverItem[] = [];
  let apiCalls = 0;
  for (const start of COLLECT.pages.slice(0, maxPages)) {
    const page = await callOnce(query, start, sort);
    apiCalls++;
    items.push(...page);
    if (page.length < COLLECT.display) break; // 마지막 페이지
  }
  return { total: items.length, items, apiCalls };
}
