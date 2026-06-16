import { collectForSku } from "./collect";
import { matchListings } from "./match";
import { classifyListings } from "./catalog";
import { MATCH_CONFIDENCE_THRESHOLD } from "./config";
import { analyze } from "./pricing";
import {
  loadProductChunk, saveListings, saveMatches, saveSnapshot, saveReport,
  prevSnapshotMedian, incrementRunProgress, loadBlockedPids,
} from "./db";

// 한 chunk(SKU 목록)를 처리: 수집→필터→매칭→분석→영속화. 멱등(upsert).
export async function processChunk(runId: string, skuIds: string[]) {
  const products = await loadProductChunk(skuIds);
  let apiCalls = 0;
  let matchedCount = 0;
  let errors = 0;

  for (const sku of products) {
    try {
      const blockedPids = await loadBlockedPids(sku.sku_id);
      const { listings, blocked, apiCalls: calls } = await collectForSku(sku, runId, blockedPids);
      apiCalls += calls;

      const listingIdByPid = await saveListings(listings);
      const matched = await matchListings(sku, listings);
      await saveMatches(runId, sku.sku_id, matched, listingIdByPid);

      // 다나와식 카탈로그 분류: 신뢰 매칭 → 규격(인치/와트/암페어) 그룹핑 → 규격 불일치·옵션묶음 제외
      const confident = matched.filter((m) => m._confidence >= MATCH_CONFIDENCE_THRESHOLD);
      const cls = classifyListings(sku, confident);
      const prices = cls.prices;
      matchedCount += prices.length;

      const prevMedian = await prevSnapshotMedian(sku.sku_id, runId);
      const { report, snapshot } = analyze({
        product: sku, marketPrices: prices, runId, prevSnapshotMedian: prevMedian,
      });
      await saveSnapshot(runId, sku.sku_id, snapshot);
      await saveReport(report);
      console.info(
        `[pipeline] ${sku.sku_id} ${sku.name}: 후보 ${listings.length} / 차단스킵 ${blocked} / 신뢰 ${confident.length} / 분류제외 ${cls.excludedCount} / 시세반영 ${prices.length} / 시장최저 ${snapshot.market_low ?? "-"}`,
      );
    } catch (e: unknown) {
      errors++;
      console.error(`[pipeline] SKU ${sku.sku_id} 실패:`, e instanceof Error ? e.message : e);
    }
  }

  await incrementRunProgress(runId, { apiCalls, matched: matchedCount, errors, chunkDone: 1 });
  return { processed: products.length, apiCalls, matchedCount, errors };
}
