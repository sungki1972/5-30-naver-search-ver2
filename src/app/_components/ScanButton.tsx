"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startScan } from "@/app/actions";

// 수동 스캔 트리거 버튼 (cron을 기다리지 않고 즉시 시세 수집)
export function ScanButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onClick() {
    if (!confirm("지금 전체 활성 품목 시세 스캔을 시작할까요?\n(네이버 API 수집 + Haiku 매칭이 실행됩니다)")) return;
    setMsg(null);
    start(async () => {
      const r = await startScan();
      if (r.ok) {
        setMsg({ ok: true, text: `스캔 시작됨 — ${r.runId} (${r.skuCount}개 품목 / ${r.chunkTotal} chunk)` });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-slate-800 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
      >
        {pending ? "시작 중…" : "▶ 수동 스캔"}
      </button>
      {msg && (
        <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>
          {msg.text}
          {msg.ok && (
            <>
              {" · "}
              <Link href="/runs" className="underline">진행 확인 →</Link>
            </>
          )}
        </span>
      )}
    </div>
  );
}
