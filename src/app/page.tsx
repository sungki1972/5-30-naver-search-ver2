import { dbConfigured, latestRunId, reportsForRun } from "@/lib/dashboard";
import { ReportTable } from "./_components/ReportTable";
import { SetupBanner } from "./_components/SetupBanner";
import { ScanButton } from "./_components/ScanButton";

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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">시세 격차 리포트</h1>
          <p className="text-sm text-slate-500">
            내 판매가 vs 네이버 시세 — 다나와식 카탈로그 분류로 동일 규격 제품만 비교
            {runId && <> · 최근 실행 <span className="font-mono">{runId}</span></>}
          </p>
        </div>
        <ScanButton />
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

      {runId && <ReportTable rows={reports} />}
    </main>
  );
}
