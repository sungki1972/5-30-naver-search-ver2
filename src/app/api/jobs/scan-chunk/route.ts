import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { processChunk } from "@/lib/pipeline";
import { isRunComplete } from "@/lib/db";
import { finalize } from "@/lib/finalize";

export const maxDuration = 300; // chunk(25 SKU) 처리 — tier 최대값

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { runId?: string; skuIds?: unknown; chunkIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { runId, skuIds, chunkIndex } = body;
  if (!runId || !Array.isArray(skuIds)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const result = await processChunk(runId, skuIds as string[]);

  // 모든 chunk 완료 시 finalize 인라인 실행 (self-hop 제거로 안정성↑)
  if (await isRunComplete(runId)) {
    await finalize(runId);
  }

  return NextResponse.json({ runId, chunkIndex: Number(chunkIndex) || 0, ...result });
}
