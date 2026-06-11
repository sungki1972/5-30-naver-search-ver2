"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveProduct, deleteProduct, toggleProductActive, testSearchKeywords,
  type ProductInput, type KeywordTestResult,
} from "@/app/actions";
import { CategoryTabs, buildTabs, matchesTab } from "@/app/_components/CategoryTabs";

const EMPTY: ProductInput = {
  sku_id: "", name: "", spec: "", inch: null, purchase_price: null, current_price: null,
  category: "", min_margin: 0.12, price_basis: "median", search_keywords: [], active: true,
};

function won(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

export function ProductManager({ initial }: { initial: ProductInput[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductInput | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const tabs = useMemo(() => buildTabs(initial.map((p) => p.category)), [initial]);
  const categories = useMemo(
    () => [...new Set(initial.map((p) => p.category?.trim()).filter((c): c is string => !!c))].sort(),
    [initial],
  );

  const filtered = useMemo(() => {
    let r = initial.filter((p) => matchesTab(p.category, tab));
    if (q) {
      const lq = q.toLowerCase();
      r = r.filter(
        (p) =>
          p.sku_id.toLowerCase().includes(lq) ||
          p.name.toLowerCase().includes(lq) ||
          (p.spec ?? "").toLowerCase().includes(lq) ||
          p.search_keywords.some((k) => k.toLowerCase().includes(lq)),
      );
    }
    if (!showInactive) r = r.filter((p) => p.active);
    return r;
  }, [initial, q, tab, showInactive]);

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); setMsg(null); }
  function openEdit(p: ProductInput) { setEditing({ ...p }); setIsNew(false); setMsg(null); }
  function openDuplicate(p: ProductInput) {
    // 고유코드는 저장 시 자동 생성되도록 비움
    setEditing({ ...p, sku_id: "", name: `${p.name} (복제)` });
    setIsNew(true);
    setMsg(null);
  }

  function onSave() {
    if (!editing) return;
    start(async () => {
      const r = await saveProduct(editing);
      if (r.ok) { setEditing(null); router.refresh(); }
      else setMsg(r.error);
    });
  }
  function onDelete(skuId: string) {
    if (!confirm(`'${skuId}' 품목을 삭제할까요? (관련 시세·리포트도 함께 삭제됩니다)`)) return;
    start(async () => {
      const r = await deleteProduct(skuId);
      if (r.ok) router.refresh(); else setMsg(r.error);
    });
  }
  function onToggle(p: ProductInput) {
    start(async () => {
      const r = await toggleProductActive(p.sku_id, !p.active);
      if (r.ok) router.refresh(); else setMsg(r.error);
    });
  }

  return (
    <div>
      <CategoryTabs tabs={tabs} active={tab} onSelect={setTab} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="코드 / 품명 / 검색어"
          className="w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          비활성 포함
        </label>
        <span className="text-xs text-slate-400">{filtered.length} / {initial.length}개</span>
        <button
          onClick={openNew}
          className="ml-auto rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          + 새 품목
        </button>
      </div>

      {msg && !editing && <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{msg}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2.5 text-left">코드</th>
              <th className="px-3 py-2.5 text-left">품명</th>
              <th className="px-3 py-2.5 text-right">매입가</th>
              <th className="px-3 py-2.5 text-right">판매가</th>
              <th className="px-3 py-2.5 text-right">마진</th>
              <th className="px-3 py-2.5 text-center">검색어</th>
              <th className="px-3 py-2.5 text-center">활성</th>
              <th className="px-3 py-2.5 text-center">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const margin =
                p.current_price != null && p.purchase_price != null
                  ? p.current_price - p.purchase_price
                  : null;
              const marginPct =
                margin != null && p.current_price ? Math.round((margin / p.current_price) * 1000) / 10 : null;
              return (
                <tr key={p.sku_id} className={`border-t border-slate-100 ${p.active ? "hover:bg-slate-50" : "bg-slate-50/60 text-slate-400"}`}>
                  <td className="px-3 py-2 font-mono text-xs">{p.sku_id}</td>
                  <td className="px-3 py-2">
                    <Link href={`/product/${p.sku_id}`} className="font-medium text-emerald-700 hover:underline">{p.name}</Link>
                    {p.inch != null && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500" title="품명·검색어에서 자동 인식된 규격">
                        {p.inch}인치 자동인식
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{won(p.purchase_price)}</td>
                  <td className="px-3 py-2 text-right font-medium">{won(p.current_price)}</td>
                  <td className={`px-3 py-2 text-right ${margin != null && margin <= 0 ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    {margin == null ? "—" : `${won(margin)}${marginPct != null ? ` (${marginPct}%)` : ""}`}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span title={p.search_keywords.join("\n")} className="cursor-help text-slate-400 underline decoration-dotted">
                      {p.search_keywords?.length ?? 0}개
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => onToggle(p)}
                      disabled={pending}
                      title={p.active ? "클릭하여 비활성화" : "클릭하여 활성화"}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.active ? "bg-emerald-500" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${p.active ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button onClick={() => openEdit(p)} className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200">수정</button>
                    <button onClick={() => openDuplicate(p)} className="ml-1 rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200" title="이 품목을 복제해 새 품목 작성">복제</button>
                    <button onClick={() => onDelete(p.sku_id)} className="ml-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">삭제</button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                {initial.length ? "조건에 맞는 품목이 없습니다." : "품목이 없습니다. “+ 새 품목”으로 추가하세요."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductForm
          value={editing} isNew={isNew} pending={pending} msg={msg} categories={categories}
          onChange={setEditing} onCancel={() => setEditing(null)} onSave={onSave}
        />
      )}
    </div>
  );
}

function ProductForm({
  value, isNew, pending, msg, categories, onChange, onCancel, onSave,
}: {
  value: ProductInput; isNew: boolean; pending: boolean; msg: string | null;
  categories: string[];
  onChange: (v: ProductInput) => void; onCancel: () => void; onSave: () => void;
}) {
  const set = (patch: Partial<ProductInput>) => onChange({ ...value, ...patch });
  const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState<KeywordTestResult[] | null>(null);
  const [testErr, setTestErr] = useState<string | null>(null);

  async function runTest() {
    if (!value.search_keywords.length) { setTestErr("검색어를 먼저 입력하세요."); return; }
    setTesting(true); setTestErr(null); setTestRes(null);
    const r = await testSearchKeywords(value.search_keywords, value.name);
    setTesting(false);
    if (r.ok) setTestRes(r.results); else setTestErr(r.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold text-slate-800">{isNew ? "새 품목 추가" : `품목 수정 — ${value.sku_id}`}</h2>
        {isNew && <p className="mb-3 text-xs text-slate-400">고유코드는 저장 시 자동 생성됩니다.</p>}

        <div className="mt-2 space-y-4 text-sm">
          <Section title="기본 정보">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="품명 *">
                  <input value={value.name} onChange={(e) => set({ name: e.target.value })}
                    placeholder="예: LDS 5인치 LED 다운라이트 / 남영 누전차단기 30A" className="w-full rounded border border-slate-300 px-2 py-1.5" />
                </Field>
              </div>
              <Field label="카테고리 (탭 분류)">
                <input value={value.category ?? ""} onChange={(e) => set({ category: e.target.value })}
                  list="category-options" placeholder="예: 다운라이트"
                  className="w-full rounded border border-slate-300 px-2 py-1.5" />
                <datalist id="category-options">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
            </div>
            <p className="text-xs text-slate-400">
              인치·와트 같은 규격이 품명이나 검색어에 있으면 자동 인식되어 동일 규격 제품끼리만 비교합니다.
              카테고리는 품목이 많아질 때 리포트·관리 화면의 탭으로 사용됩니다.
            </p>
          </Section>

          <Section title="가격 · 마진 (직접 입력)">
            <div className="grid grid-cols-3 gap-3">
              <Field label="매입가 (원)"><input type="number" value={value.purchase_price ?? ""} onChange={(e) => set({ purchase_price: numOrNull(e.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1.5" /></Field>
              <Field label="내 판매가 (원)"><input type="number" value={value.current_price ?? ""} onChange={(e) => set({ current_price: numOrNull(e.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1.5" /></Field>
              <Field label="최소마진율 (0.12 = 12%)"><input type="number" step="0.01" value={value.min_margin} onChange={(e) => set({ min_margin: Number(e.target.value) })} className="w-full rounded border border-slate-300 px-2 py-1.5" /></Field>
            </div>
            <Field label="권장가 기준">
              <select value={value.price_basis} onChange={(e) => set({ price_basis: e.target.value as "low" | "median" })} className="w-full rounded border border-slate-300 px-2 py-1.5">
                <option value="median">인기중앙값 (안정적)</option>
                <option value="low">시장최저 (공격적)</option>
              </select>
            </Field>
          </Section>

          <Section title="네이버 검색 설정">
            <Field label="검색어 (줄바꿈 구분, 1~5개)">
              <textarea rows={3} value={value.search_keywords.join("\n")}
                placeholder={"LDS 5인치 다운라이트\n남영 누전차단기 30A"}
                onChange={(e) => set({ search_keywords: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs" />
            </Field>
            <div className="flex items-center gap-3">
              <button onClick={runTest} disabled={testing || pending}
                className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                {testing ? "네이버 검색 중…" : "🔍 검색어 테스트 (라이브)"}
              </button>
              <span className="text-xs text-slate-400">저장 전에 필터·분류 통과량과 시세 분포를 미리 확인</span>
            </div>
            {testErr && <p className="rounded bg-red-50 p-2 text-xs text-red-600">{testErr}</p>}
            {testRes && <KeywordTestPanel results={testRes} />}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={value.active} onChange={(e) => set({ active: e.target.checked })} />
              <span>활성 (주간 스캔 대상)</span>
            </label>
          </Section>

          {msg && <p className="rounded bg-red-50 p-2 text-red-600">{msg}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={pending} className="rounded-md bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200">취소</button>
          <button onClick={onSave} disabled={pending} className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeywordTestPanel({ results }: { results: KeywordTestResult[] }) {
  return (
    <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      {results.map((r) => (
        <div key={r.keyword} className="text-xs">
          <div className="font-medium text-slate-700">
            “{r.keyword}” — 수집 {r.total} → 필터 통과 {r.passed} → 시세 반영 <span className="font-bold text-emerald-700">{r.priced}건</span>
            {r.low != null && (
              <span className="ml-2 text-slate-500">최저 {r.low.toLocaleString("ko-KR")}원 · 중앙값 {r.median?.toLocaleString("ko-KR")}원</span>
            )}
          </div>
          {r.groups.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.groups.map((g) => (
                <span key={g.label}
                  className={`rounded-full px-2 py-0.5 ${g.isTarget ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"}`}
                  title={g.isTarget ? "내 규격 그룹 (시세 반영)" : "다른 규격 그룹 (제외)"}>
                  {g.label} ×{g.count}{g.low != null ? ` · ${g.low.toLocaleString("ko-KR")}원~` : ""}
                </span>
              ))}
            </div>
          )}
          {r.samples.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-slate-400">
              {r.samples.map((s) => <li key={s} className="truncate">{s}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-xs font-semibold text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
