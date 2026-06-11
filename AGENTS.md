<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 5-30 네이버 가격 정찰 시세 인텔리전스 (진주 전기자재·조명 도소매)

## 무엇
내 취급 품목(매입가) 기준으로 네이버 검색 API에서 **시세를 주 1회 수집·필터·매칭**하여
**"내 판매가 vs 시세 격차 + 권장가 + 마진" 리포트**를 Next.js 대시보드로 보여주고,
마진 침해/시세 급락은 Telegram 경보. **오프라인 도소매 의사결정 지원 전용**(온라인 리프라이싱/발행 없음).

- 스펙: `.omc/specs/deep-interview-naver-price-intel.md` (deep-interview, 모호도 14%)
- 계획: `.omc/plans/naver-price-intel-plan.md` (ralplan consensus, Architect+Critic ACCEPT)
- 전신(ver1): `/home/gihwaja/apps/5-28-price-naver/` — 일회성 Python 도구. 필터·가격룰을 TS로 포팅함.

## 스택
Next.js 16 (App Router, src-dir) + Supabase(Postgres) + 네이버 검색 API + Claude Haiku + Telegram + Vercel Cron.

## 아키텍처 (타임아웃 회피)
```
Vercel Cron(월 09:00 KST) → /api/cron/scan (오케스트레이터, enqueue만)
   → SKU를 25개 chunk로 분할 → QStash(없으면 self-chain)로 디스패치
/api/jobs/scan-chunk → 수집→필터→매칭→분석→DB upsert (chunk당, 멱등)
   → 마지막 chunk → /api/jobs/finalize → 집계+경보+Haiku요약+prune
대시보드(Server Components, service_role): / (격차표) /product/[sku] (시계열) /runs (이력)
```

## 핵심 로직 (ver1 포팅)
- `src/lib/naver-filter.ts` — 제목 필터: 조명키워드 필수, 비조명 제외, **인치 정확매칭**, 옵션-인치 추출, LDS/리더스 브랜드 검증. (라이브 실증: 5인치 1150건 중 60건만 통과)
- `src/lib/catalog.ts` — **다나와식 카탈로그 분류** (2026-06-11): 네이버 가격비교가 채택한 "동일 규격끼리 묶고 그룹 안에서만 최저가" 방식. ①productType 버킷(1=가격비교 카탈로그, 4~12=중고/단종/판매예정 → 제외) ②인치×와트 시그니처 그룹핑(파이→인치 환산 포함) ③옵션묶음 제외(제목에 복수 인치/와트 → lprice=최저옵션 미끼) ④저가 아웃라이어 컷(타깃그룹 중앙값×0.5 미만이고 개수<3 또는 몰<2 → 제외, config.CATALOG). pipeline·recompute·검색어테스트가 공유. **SKU `spec`에 와트 기입 시 와트 불일치 제외 발동** → 분류 정밀도↑.
- `src/lib/pricing.ts` — **권장가 = ceil(시장기준가 × (1+마진율) / 1000) × 1000** (천원 올림). 기준 = 시장최저(low) 또는 인기중앙값(median). ⚠️ ver1 `round_to_thousand`(반올림) 복사 금지 — ceil 사용.
- `src/lib/match.ts` — 2단 깔때기: ①인치 명시 일치 regex(conf 1.0) ②애매건만 Haiku JSON. 게이트 0.80. Haiku 장애 시 conf=0 폴백. 게이트 통과분이 catalog.ts로 넘어가 최종 시세 표본이 결정됨.

## UI (2026-06-11 전면 개편)
- `layout.tsx` + `_components/Nav.tsx` — 공용 상단 내비(현재 경로 강조), 라이트 테마 고정, 푸터에 BUILD_ID.
- `/` — 요약 카드(품목/마진침해/시세급락/평균격차) + 격차 테이블.
- `/products` — CRUD 전면 개편: 검색·카테고리 필터, 인라인 활성 토글, 복제, 마진 컬럼, 모달 폼 섹션화. **"검색어 테스트(라이브)"** 버튼 = 저장 전 네이버 실검색(키워드당 1페이지)→필터→분류 통과량·그룹 분포·시세 미리보기 (`actions.ts testSearchKeywords`).
- `/product/[sku]` — 수집 표본을 **다나와식 그룹 아코디언**으로 표시: 그룹별 최저/중앙값/반영수, "내 규격" 배지, productType 배지(가격비교/일반/중고), 제외 사유 칩, 표본 삭제→즉시 재계산.
- `scripts/recompute-latest.ts` — 최신 run 전 SKU를 현재 알고리즘으로 재계산 (`node --env-file=.env.local --import tsx scripts/recompute-latest.ts`).

## DB (전용 Supabase 프로젝트 umakukswpneejlcmietc, RLS anon 차단, service_role 전용)
6 테이블 (모두 `naver_` 접두어): `naver_my_products`(매입가/판매가/search_keywords[]) `naver_listings`(source_sku_id=검색origin, 매칭 아님) `naver_product_matches` `naver_price_snapshots`(시계열) `naver_price_gap_reports`(주산출물) `naver_run_logs`(멱등 run_id=YYYYMMDD-HHmmss). 전 테이블 UNIQUE(run_id,sku_id...) + upsert. 마이그레이션은 `_combined_for_dashboard.sql`을 대시보드 SQL Editor에서 실행 완료됨.

## 현재 상태: LIVE 검증 완료 ✅
.env.local에 실제 크레덴셜 모두 연결됨(Supabase URL+service_role, 네이버, Claude, Telegram, CRON_SECRET). 프로덕션 HTTP 경로 전체 실증:
cron/scan(200,enqueue)→scan-chunk(80 API호출, Haiku 495매칭, 4 SKU 분석/저장)→finalize 인라인(status=done)→Telegram 경보+Haiku 요약 발송. 대시보드 4품목 렌더 확인.
- 카탈로그 분류 적용 후 재계산(2026-06-11): LDS-D-11 시장최저 4700→4900(옵션묶음 미끼 제외), LDS-D-10 2800 노이즈 해소→4120. 표본 정제 예: 155→63.

## 환경변수 (.env.local)
- ✅ `NAVER_CLIENT_ID/SECRET`(ver1 값), `NEXT_PUBLIC_SUPABASE_URL`, `CRON_SECRET` — 입력됨
- ⚠️ **사용자 입력 필요**: `SUPABASE_SERVICE_ROLE_KEY`(Supabase>Settings>API), `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN/CHAT_ID`(선택), `QSTASH_TOKEN`(선택)

## 셋업 절차
1. `.env.local`에 SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY 입력
2. Supabase SQL Editor에서 `supabase/migrations/0001_init.sql` → `0002_seed.sql` 실행
3. `npm run dev` → http://localhost:3000
4. 스캔: `curl -H "x-cron-secret: <CRON_SECRET>" -X POST localhost:3000/api/cron/scan`
5. ⚠️ `0002_seed.sql`의 `purchase_price`(매입가)는 placeholder — **실제 매입가로 교체** 필요.

## 검증 (될 때까지)
- `npm test` — 37 단위테스트(pricing 룰 + ver1 필터 회귀 + catalog 분류) ✅
- `npm run test:collect` — 라이브 네이버 API+필터+**다나와식 분류**+분포(DB 불필요) ✅ 구최저 4800(미끼)→신최저 4900, 권장가 8000원 유지
- `npm run test:flow` — e2e(service_role 필요)
- `npm run typecheck`(✅ clean) / `npm run build`(✅ 성공)

## 배포
GitHub push(sungki1972 SSH) → Vercel import. 환경변수 등록. `vercel.json` 주간 cron 등록됨. Vercel tier 무관(chunk 설계).

## 함정
- **Telegram + Node fetch**: WSL2 등 IPv6 끊김 환경에서 api.telegram.org가 ETIMEDOUT. 또 Next.js가 global fetch를 패치해 dispatcher 옵션을 무시함 → `telegram.ts`는 **undici의 fetch를 직접 import**해 IPv4 Agent 강제. (Vercel에선 무해)
- **finalize는 scan-chunk에서 인라인 호출**(self-chain fetch 아님) — localhost self-hop이 WSL2에서 ETIMEDOUT. `triggerFinalize`(queue.ts)는 QStash 경로용으로만 잔존.
- 검색 API 최저가는 전체 셀러 미포함(부분 커버리지). sample_count로 표기.
- 네이버 원시 lprice 노이즈 심함(옵션묶음/타공/타인치) → naver-filter + catalog.ts 분류 필수.
- ~~LDS-D-10(6인치) 시장최저 2800원 노이즈~~ → **catalog.ts 분류로 해소됨**(2026-06-11 재계산 4120원). 옵션묶음 lprice = 최저 옵션 미끼가가 주범이었음.
- 검색어 테스트 액션은 키워드당 라이브 API 1콜 소모(최대 5키워드). 일일한도 25,000이라 부담 없음.
- 매입가(purchase_price)는 시드 placeholder — 실제 값 입력 필요(마진 계산 정확도 직결).
- 데이터랩 신규품목 발굴·pgvector 의미매칭은 미구현(향후 Phase).
