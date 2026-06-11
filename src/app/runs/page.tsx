import { dbConfigured, recentRuns } from "@/lib/dashboard";
import { SetupBanner } from "@/app/_components/SetupBanner";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-700",
  running: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export default async function RunsPage() {
  if (!dbConfigured()) return <SetupBanner />;
  const runs = await recentRuns();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">실행 이력</h1>
      <p className="mb-4 text-sm text-slate-500">주간 스캔 실행 로그 (최근 20건)</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Run ID</th>
              <th className="px-3 py-2 text-center">상태</th>
              <th className="px-3 py-2 text-right">SKU</th>
              <th className="px-3 py-2 text-right">청크</th>
              <th className="px-3 py-2 text-right">API호출</th>
              <th className="px-3 py-2 text-right">매칭</th>
              <th className="px-3 py-2 text-right">오류</th>
              <th className="px-3 py-2 text-left">시작</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.run_id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-mono text-xs">{r.run_id}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[r.status] ?? "bg-slate-100"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{r.sku_count}</td>
                <td className="px-3 py-2 text-right">{r.chunk_done}/{r.chunk_total}</td>
                <td className="px-3 py-2 text-right">{r.api_calls}</td>
                <td className="px-3 py-2 text-right">{r.matched_count}</td>
                <td className="px-3 py-2 text-right">{r.error_count}</td>
                <td className="px-3 py-2 text-xs text-slate-400">
                  {r.started_at ? new Date(r.started_at).toLocaleString("ko-KR") : "—"}
                </td>
              </tr>
            ))}
            {!runs.length && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">실행 기록 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
