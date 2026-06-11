"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListing } from "@/app/actions";
import type { ListingRow } from "@/lib/dashboard";

export interface ViewListing extends ListingRow {
  included: boolean; // 시세 계산 반영
  reason: string; // 제외 사유
  bucket: string; // productType 버킷 (catalog/normal/...)
  bucketLabel: string;
}

export interface ViewGroup {
  key: string;
  label: string; // "5인치 · 15W"
  isTarget: boolean; // 내 규격 그룹
  low: number | null;
  median: number | null;
  includedCount: number;
  items: ViewListing[];
}

function won(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR") + "원";
}

const BUCKET_STYLE: Record<string, string> = {
  catalog: "bg-blue-100 text-blue-700", // 네이버 가격비교(카탈로그) — 신뢰 높음
  matched: "bg-sky-100 text-sky-700",
  normal: "bg-slate-100 text-slate-500",
  secondhand: "bg-amber-100 text-amber-700",
  discontinued: "bg-amber-100 text-amber-700",
  preorder: "bg-amber-100 text-amber-700",
  unknown: "bg-slate-100 text-slate-400",
};

export function Listings({ groups, runId, skuId }: { groups: ViewGroup[]; runId: string; skuId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map((g) => [g.key, g.isTarget])),
  );

  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const counted = groups.reduce((a, g) => a + g.includedCount, 0);

  function onDelete(id: number, title: string) {
    if (!confirm(`이 표본을 삭제할까요? 시세가 재계산됩니다.\n\n${title.slice(0, 80)}`)) return;
    setBusyId(id); setMsg(null);
    start(async () => {
      const r = await deleteListing(id, runId, skuId);
      setBusyId(null);
      if (r.ok) router.refresh();
      else setMsg(r.error);
    });
  }

  if (!total) return <p className="text-sm text-slate-400">이 실행에서 수집된 표본이 없습니다.</p>;

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        총 {total}건 → 시세 반영 <span className="font-semibold text-emerald-700">{counted}건</span>.
        잘못된 표본은 삭제하면 시세·격차가 즉시 재계산됩니다.
      </p>
      {msg && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-600">{msg}</p>}

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.key} className={`overflow-hidden rounded-lg border ${g.isTarget ? "border-emerald-300" : "border-slate-200"}`}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))}
              className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${g.isTarget ? "bg-emerald-50" : "bg-slate-50"}`}
            >
              <span className="text-slate-400">{open[g.key] ? "▾" : "▸"}</span>
              <span className="font-semibold text-slate-700">{g.label}</span>
              {g.isTarget && (
                <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">내 규격 — 시세 반영</span>
              )}
              <span className="ml-auto text-xs text-slate-500">
                표본 {g.items.length} · 반영 {g.includedCount}
                {g.low != null && <> · 최저 <b>{won(g.low)}</b> · 중앙값 {won(g.median)}</>}
              </span>
            </button>

            {open[g.key] && (
              <table className="w-full text-sm">
                <tbody>
                  {g.items.map((r) => (
                    <tr key={r.id} className={`border-t border-slate-100 ${r.included ? "" : "bg-slate-50 text-slate-400"}`}>
                      <td className="w-24 px-3 py-2 text-right font-medium whitespace-nowrap">{won(r.lprice)}</td>
                      <td className="px-3 py-2">
                        {r.title}
                        <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${BUCKET_STYLE[r.bucket] ?? BUCKET_STYLE.unknown}`}>
                          {r.bucketLabel}
                        </span>
                        {!r.included && r.reason && (
                          <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700" title="시세 계산에서 제외된 사유">
                            제외: {r.reason}
                          </span>
                        )}
                      </td>
                      <td className="w-32 px-3 py-2 text-slate-500 whitespace-nowrap">{r.mall_name || "—"}</td>
                      <td className="w-14 px-3 py-2 text-center text-xs">{r.confidence.toFixed(2)}</td>
                      <td className="w-16 px-3 py-2 text-center">
                        <button
                          onClick={() => onDelete(r.id, r.title)}
                          disabled={pending && busyId === r.id}
                          className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          {pending && busyId === r.id ? "…" : "삭제"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
