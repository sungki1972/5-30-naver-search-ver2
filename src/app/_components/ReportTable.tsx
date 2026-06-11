"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReportRow } from "@/lib/dashboard";
import { CategoryTabs, buildTabs, matchesTab } from "./CategoryTabs";

type SortKey = "sku_id" | "gap_pct" | "margin_pct" | "market_low" | "my_price";

function won(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("ko-KR") + "원";
}

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  const [q, setQ] = useState("");
  const [onlyBreach, setOnlyBreach] = useState(false);
  const [tab, setTab] = useState("");
  const [sort, setSort] = useState<SortKey>("gap_pct");
  const [dir, setDir] = useState<1 | -1>(-1);

  const tabs = useMemo(() => buildTabs(rows.map((r) => r.category)), [rows]);

  const filtered = useMemo(() => {
    let r = rows.filter((x) => matchesTab(x.category, tab));
    if (q) r = r.filter((x) => (x.name ?? "").includes(q) || x.sku_id.includes(q));
    if (onlyBreach) r = r.filter((x) => x.margin_breach);
    return [...r].sort((a, b) => {
      const av = a[sort] ?? -Infinity;
      const bv = b[sort] ?? -Infinity;
      if (typeof av === "string" || typeof bv === "string")
        return String(av).localeCompare(String(bv)) * dir;
      return (Number(av) - Number(bv)) * dir;
    });
  }, [rows, q, onlyBreach, tab, sort, dir]);

  const th = (key: SortKey, label: string) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-right hover:bg-slate-100"
      onClick={() => (sort === key ? setDir((d) => (d === 1 ? -1 : 1)) : (setSort(key), setDir(-1)))}
    >
      {label} {sort === key ? (dir === 1 ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <div>
      <CategoryTabs tabs={tabs} active={tab} onSelect={setTab} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="품명/SKU 검색"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={onlyBreach} onChange={(e) => setOnlyBreach(e.target.checked)} />
          마진 침해만
        </label>
        <span className="text-xs text-slate-400">{filtered.length}건</span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">품목</th>
              {th("my_price", "내 판매가")}
              {th("market_low", "시장최저")}
              <th className="px-3 py-2 text-right">중앙값</th>
              <th className="px-3 py-2 text-right">권장가</th>
              {th("gap_pct", "격차%")}
              {th("margin_pct", "마진%")}
              <th className="px-3 py-2 text-center">표본</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.sku_id}
                className={`border-t border-slate-100 ${r.margin_breach ? "bg-red-50" : "hover:bg-slate-50"}`}
              >
                <td className="px-3 py-2 text-left">
                  <Link href={`/product/${r.sku_id}`} className="font-medium text-blue-700 hover:underline">
                    {r.name ?? r.sku_id}
                  </Link>
                  <div className="text-xs text-slate-400">{r.sku_id}</div>
                </td>
                <td className="px-3 py-2 text-right">{won(r.my_price)}</td>
                <td className="px-3 py-2 text-right">{won(r.market_low)}</td>
                <td className="px-3 py-2 text-right text-slate-500">{won(r.market_median)}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-700">{won(r.recommended_price)}</td>
                <td className={`px-3 py-2 text-right ${(r.gap_pct ?? 0) > 0 ? "text-red-600" : "text-blue-600"}`}>
                  {r.gap_pct == null ? "—" : `${r.gap_pct > 0 ? "+" : ""}${r.gap_pct}%`}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.margin_pct == null ? "—" : `${r.margin_pct}%`}
                  {r.margin_breach && <span className="ml-1 text-red-600" title="마진 침해">⚠</span>}
                </td>
                <td className="px-3 py-2 text-center text-slate-400">{r.sample_count}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                  표시할 품목이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
