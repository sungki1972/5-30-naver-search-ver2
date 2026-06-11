import { env } from "./config";

// QStash가 있으면 큐로, 없으면 self-chain(fetch fire-and-forget)으로 chunk 작업 디스패치.
export async function enqueueChunk(runId: string, skuIds: string[], chunkIndex: number) {
  const base = normalizeUrl(env.appUrl());
  const target = `${base}/api/jobs/scan-chunk`;
  const body = { runId, skuIds, chunkIndex };
  const qstashToken = env.qstashToken();

  if (qstashToken) {
    const res = await fetch(`https://qstash.upstash.io/v2/publish/${target}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Retries": "3",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`QStash publish 실패: ${res.status} ${await res.text()}`);
    return;
  }

  // 폴백: self-chain. 응답을 기다리지 않음(fire-and-forget).
  void fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": env.cronSecret() },
    body: JSON.stringify(body),
  }).catch((e) => console.error("[queue] self-chain 실패:", e));
}

export async function triggerFinalize(runId: string) {
  const base = normalizeUrl(env.appUrl());
  void fetch(`${base}/api/jobs/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": env.cronSecret() },
    body: JSON.stringify({ runId }),
  }).catch((e) => console.error("[queue] finalize 트리거 실패:", e));
}

function normalizeUrl(u: string): string {
  if (u.startsWith("http")) return u.replace(/\/$/, "");
  return `https://${u}`.replace(/\/$/, "");
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
