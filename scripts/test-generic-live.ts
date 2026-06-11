// 비조명 범용 품목 라이브 검증: testSearchKeywords (수집→자동적응필터→분류)
import { testSearchKeywords } from "../src/app/actions";
async function main() {
  const r = await testSearchKeywords(["남영 누전차단기 30A"], "남영 누전차단기 30A");
  if (!r.ok) throw new Error(r.error);
  for (const k of r.results) {
    console.log(`"${k.keyword}": 수집 ${k.total} → 필터 ${k.passed} → 시세반영 ${k.priced} | 최저 ${k.low} 중앙값 ${k.median}`);
    console.log("  그룹:", k.groups.map(g => `${g.isTarget ? "★" : ""}${g.label}×${g.count}`).join(", "));
    console.log("  샘플:", k.samples[0]);
  }
  if (r.results[0].passed === 0) throw new Error("FAIL: 범용 필터가 전부 거름");
  console.log("✅ PASS: 비조명 범용 품목 라이브 수집·분류 동작");
}
main().catch(e => { console.error("❌", e.message); process.exit(1); });
