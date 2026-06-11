"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListing, unblockListing } from "@/app/actions";
import type { ListingRow, BlockedRow } from "@/lib/dashboard";

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
  const [expandedId, setExpandedId] = useState<number | null>(null); // 인라인 상세 (사이트 이동 없이 확인)

  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const counted = groups.reduce((a, g) => a + g.includedCount, 0);

  function onDelete(id: number, title: string) {
    if (!confirm(`이 표본을 삭제하고 영구 차단할까요?\n다음 스캔부터 이 상품은 수집되지 않으며, 시세가 즉시 재계산됩니다.\n\n${title.slice(0, 80)}`)) return;
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
        잘못된 표본은 삭제하면 <b>영구 차단</b>되어 다음 스캔부터 수집되지 않고, 시세·격차가 즉시 재계산됩니다.
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
                    <Row
                      key={r.id}
                      r={r}
                      expanded={expandedId === r.id}
                      onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                      onDelete={() => onDelete(r.id, r.title)}
                      busy={pending && busyId === r.id}
                    />
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

// 표본 한 행: 썸네일 + 클릭 시 인라인 상세 (사이트 이동 없이 삭제 전 확인)
function Row({
  r, expanded, onToggle, onDelete, busy,
}: {
  r: ViewListing; expanded: boolean; onToggle: () => void; onDelete: () => void; busy: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-t border-slate-100 ${r.included ? "hover:bg-slate-50" : "bg-slate-50 text-slate-400"} ${expanded ? "bg-emerald-50/40" : ""}`}
        title="클릭하면 상품 이미지·상세를 펼쳐 확인합니다"
      >
        <td className="w-12 py-1.5 pl-3">
          {r.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image} alt="" className="h-10 w-10 rounded border border-slate-200 object-cover" loading="lazy" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[9px] text-slate-300">no img</div>
          )}
        </td>
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
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={busy}
            className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {busy ? "…" : "삭제"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-emerald-100 bg-emerald-50/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-4">
              {r.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image} alt={r.title} className="h-44 w-44 rounded-lg border border-slate-200 bg-white object-contain" />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-300">
                  이미지 없음 (다음 스캔부터 수집)
                </div>
              )}
              <div className="min-w-60 flex-1 space-y-1 text-sm text-slate-700">
                <p className="font-medium">{r.title}</p>
                <p>판매처: <b>{r.mall_name || "—"}</b> · 가격: <b>{won(r.lprice)}</b></p>
                <p>유형: {r.bucketLabel} · 신뢰도: {r.confidence.toFixed(2)} {r.included ? "· ✅ 시세 반영 중" : `· ⛔ ${r.reason}`}</p>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    disabled={busy}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? "처리 중…" : "🚫 삭제 + 영구 차단"}
                  </button>
                  {r.link && (
                    <a
                      href={r.link} target="_blank" rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
                    >
                      네이버에서 보기 ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// 영구 차단 목록 — 다음 스캔부터 미수집. 실수 차단은 해제 가능.
export function BlockedList({ rows, skuId }: { rows: BlockedRow[]; skuId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!rows.length) return null;

  function onUnblock(id: number, title: string | null) {
    if (!confirm(`차단을 해제할까요? 다음 스캔부터 다시 수집됩니다.\n\n${(title ?? "").slice(0, 80)}`)) return;
    setMsg(null);
    start(async () => {
      const r = await unblockListing(id, skuId);
      if (r.ok) router.refresh(); else setMsg(r.error);
    });
  }

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-left">
        <span className="text-slate-400">{open ? "▾" : "▸"}</span>
        <h2 className="text-lg font-semibold text-slate-700">차단된 상품</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{rows.length}건 — 스캔에서 제외 중</span>
      </button>
      {msg && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-600">{msg}</p>}
      {open && (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 text-slate-500">
                <td className="w-12 py-1.5 pl-3">
                  {r.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image} alt="" className="h-10 w-10 rounded border border-slate-200 object-cover opacity-60" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 rounded border border-slate-200 bg-slate-50" />
                  )}
                </td>
                <td className="w-24 px-3 py-2 text-right whitespace-nowrap">{won(r.lprice)}</td>
                <td className="px-3 py-2">{r.title ?? r.product_id}</td>
                <td className="w-32 px-3 py-2 whitespace-nowrap">{r.mall_name || "—"}</td>
                <td className="w-28 px-3 py-2 text-xs whitespace-nowrap">{new Date(r.blocked_at).toLocaleDateString("ko-KR")}</td>
                <td className="w-20 px-3 py-2 text-center">
                  <button
                    onClick={() => onUnblock(r.id, r.title)}
                    disabled={pending}
                    className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 disabled:opacity-50"
                  >
                    해제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
