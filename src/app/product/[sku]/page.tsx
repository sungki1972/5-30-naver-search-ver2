import Link from "next/link";
import {
  dbConfigured, productById, snapshotsForSku, latestRunId, listingsForSku, reportsForRun,
  type ListingRow,
} from "@/lib/dashboard";
import {
  classifyListings, extractSignature, groupKeyOf, groupLabelOf, typeBucket, TYPE_BUCKET_LABEL,
} from "@/lib/catalog";
import { SetupBanner } from "@/app/_components/SetupBanner";
import { PriceChart } from "@/app/_components/PriceChart";
import { Listings, type ViewGroup, type ViewListing } from "./_Listings";

export const dynamic = "force-dynamic";

function won(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("ko-KR") + "원";
}

// 수집 표본을 다나와식 카탈로그 그룹 뷰로 변환 (파이프라인과 동일 분류 규칙)
function buildGroups(
  product: { inch: number | null; spec: string | null; name: string | null } | null,
  rows: ListingRow[],
): ViewGroup[] {
  const sku = product ?? { inch: null, spec: null, name: null };
  const counted = rows.filter((r) => r.counted);
  const cls = classifyListings(sku, counted);

  const viewByKey = new Map<string, ViewListing[]>();
  const push = (key: string, v: ViewListing) => {
    const arr = viewByKey.get(key) ?? [];
    arr.push(v);
    viewByKey.set(key, arr);
  };

  for (const c of cls.listings) {
    const r = c.item as ListingRow;
    push(c.groupKey, {
      ...r,
      included: c.included,
      reason: c.reason,
      bucketLabel: TYPE_BUCKET_LABEL[c.bucket],
      bucket: c.bucket,
    });
  }
  // 신뢰도 게이트 미달 표본도 해당 그룹에 제외 표시로 노출
  for (const r of rows.filter((x) => !x.counted)) {
    const sig = extractSignature(r.title);
    const bucket = typeBucket(r.product_type);
    push(groupKeyOf(sig, sku.inch), {
      ...r,
      included: false,
      reason: `신뢰도 미달 (${r.confidence.toFixed(2)})`,
      bucketLabel: TYPE_BUCKET_LABEL[bucket],
      bucket,
    });
  }

  const targetKeys = new Set(cls.groups.filter((g) => g.isTarget).map((g) => g.key));
  const statByKey = new Map(cls.groups.map((g) => [g.key, g]));

  const groups: ViewGroup[] = [...viewByKey.entries()].map(([key, items]) => {
    const stat = statByKey.get(key);
    return {
      key,
      label: groupLabelOf(key),
      isTarget: targetKeys.has(key) || (!stat && false),
      low: stat?.low ?? null,
      median: stat?.median ?? null,
      includedCount: stat?.includedCount ?? 0,
      items: items.sort((a, b) => (a.lprice ?? 0) - (b.lprice ?? 0)),
    };
  });
  groups.sort((a, b) =>
    a.isTarget !== b.isTarget ? (a.isTarget ? -1 : 1) : b.items.length - a.items.length,
  );
  return groups;
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  if (!dbConfigured()) return <SetupBanner />;
  const { sku } = await params;
  const product = await productById(sku);
  const snaps = await snapshotsForSku(sku);
  const runId = await latestRunId();
  const listings = runId ? await listingsForSku(runId, sku) : [];
  const reports = runId ? await reportsForRun(runId) : [];
  const report = reports.find((r) => r.sku_id === sku);
  const groups = buildGroups(product, listings);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-slate-400">
        <Link href="/" className="text-emerald-700 hover:underline">격차 리포트</Link>
        <span className="mx-1">/</span>
        <span>{sku}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{product?.name ?? sku}</h1>
          <p className="text-sm text-slate-500">
            {sku}{product?.spec ? ` · ${product.spec}` : ""} · 매입가 {won(product?.purchase_price)} · 판매가 {won(product?.current_price)}
          </p>
        </div>
        <Link href="/products" className="rounded-md bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
          품목 정보 수정 →
        </Link>
      </div>

      {report && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={`시장최저 (표본 ${report.sample_count})`} value={won(report.market_low)} />
          <Stat label="인기중앙값" value={won(report.market_median)} />
          <Stat label="권장가" value={won(report.recommended_price)} accent />
          <Stat label="격차" value={report.gap_pct == null ? "—" : `${report.gap_pct > 0 ? "+" : ""}${report.gap_pct}%`} danger={(report.gap_pct ?? 0) > 0} />
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-700">시세 추이</h2>
        <PriceChart data={snaps} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-slate-700">수집 표본 — 다나와식 제품 분류</h2>
        <p className="mb-3 text-xs text-slate-400">
          최근 실행 <span className="font-mono">{runId ?? "없음"}</span> · 동일 규격(인치×와트) 그룹끼리 묶고,
          내 규격 그룹에서만 시세를 계산합니다. 중고·단종·옵션묶음·저가 아웃라이어는 자동 제외.
        </p>
        {runId ? (
          <Listings groups={groups} runId={runId} skuId={sku} />
        ) : (
          <p className="text-sm text-slate-400">실행 기록이 없습니다.</p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-semibold ${accent ? "text-emerald-700" : danger ? "text-red-600" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}
