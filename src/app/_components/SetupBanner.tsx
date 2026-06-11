export function SetupBanner() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-4 text-2xl font-bold text-slate-800">⚙️ 설정 필요</h1>
      <p className="mb-4 text-slate-600">
        대시보드를 보려면 <code className="rounded bg-slate-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>가 필요합니다.
      </p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>Supabase 대시보드 → Settings → API → <b>service_role</b> 키 복사</li>
        <li><code className="rounded bg-slate-100 px-1">.env.local</code>의 <code>SUPABASE_SERVICE_ROLE_KEY</code>에 입력</li>
        <li>SQL Editor에서 <code className="rounded bg-slate-100 px-1">supabase/migrations/0001_init.sql</code>, <code>0002_seed.sql</code> 실행</li>
        <li><code className="rounded bg-slate-100 px-1">ANTHROPIC_API_KEY</code> 등 나머지 키 입력 후 재시작</li>
      </ol>
    </main>
  );
}
