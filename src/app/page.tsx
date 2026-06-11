import { dbConfigured, latestRunId, reportsForRun } from "@/lib/dashboard";
import { ALERT } from "@/lib/config";
import { ReportTable } from "./_components/ReportTable";
import { SetupBanner } from "./_components/SetupBanner";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!dbConfigured()) return <SetupBanner />;

  let runId: string | null = null;
  let reports: Awaited<ReturnType<typeof reportsForRun>> = [];
  let err: string | null = null;
  try {
    runId = await latestRunId();
    if (runId) reports = await reportsForRun(runId);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const breaches = reports.filter((r) => r.margin_breach).length;
  const drops = reports.filter((r) => (r.price_drop_pct ?? 0) <= ALERT.priceDropPct).length;
  const gaps = reports.map((r) => r.gap_pct).filter((g): g is number => g != null);
  const avgGap = gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null;
  const samples = reports.reduce((a, r) => a + r.sample_count, 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">시세 격차 리포트</h1>
        <p className="text-sm text-slate-500">
          내 판매가 vs 네이버 시세 — 다나와식 카탈로그 분류로 동일 규격 제품만 비교
          {runId && <> · 최근 실행 <span className="font-mono">{runId}</span></>}
        </p>
      </header>

      {err && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          DB 조회 오류: {err}
        </div>
      )}

      {!runId && !err && (
        <div className="rounded border border-amber-200 bg-amber-50 p-6 text-amber-800">
          아직 실행 기록이 없습니다. 마이그레이션 적용 + 시드 후{" "}
          <code className="rounded bg-amber-100 px-1">/api/cron/scan</code>을 트리거하세요.
        </div>
      )}

      {runId && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="리포트 품목" value={`${reports.length}개`} />
            <SummaryCard label="마진 침해" value={`${breaches}건`} danger={breaches > 0} />
            <SummaryCard label={`시세 급락 (≤${ALERT.priceDropPct}%)`} value={`${drops}건`} danger={drops > 0} />
            <SummaryCard label="평균 격차 / 총 표본" value={`${avgGap == null ? "—" : `${avgGap > 0 ? "+" : ""}${avgGap}%`} · ${samples}건`} />
          </div>
          <ReportTable rows={reports} />
        </>
      )}
    </main>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${danger ? "border-red-200" : "border-slate-200"}`}>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-bold ${danger ? "text-red-600" : "text-slate-800"}`}>{value}</div>
    </div>
  );
}
