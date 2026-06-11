import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { loadActiveProducts, createRun, makeRunId } from "@/lib/db";
import { enqueueChunk, chunk } from "@/lib/queue";
import { COLLECT } from "@/lib/config";

export const maxDuration = 60; // 오케스트레이터는 enqueue만 — 가벼움

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const products = await loadActiveProducts();
  if (!products.length) {
    return NextResponse.json({ error: "no active products" }, { status: 200 });
  }
  const runId = makeRunId();
  const chunks = chunk(products.map((p) => p.sku_id), COLLECT.chunkSize);
  await createRun(runId, products.length, chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    await enqueueChunk(runId, chunks[i], i);
  }

  return NextResponse.json({
    runId, sku_count: products.length, chunk_total: chunks.length, status: "enqueued",
  });
}
