import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { finalize } from "@/lib/finalize";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let runId: string | undefined;
  try {
    ({ runId } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!runId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await finalize(runId);
  return NextResponse.json({ runId, status: "finalized" });
}
