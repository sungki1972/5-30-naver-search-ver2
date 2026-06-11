"use client";

// 카테고리 탭 바: 품목이 많아질 때 1차 분류. 가로 스크롤 + 품목 수 뱃지.
// 탭 = 카테고리 (미지정 품목은 "미분류" 탭).

export const UNCATEGORIZED = "미분류";

export interface CategoryTab {
  key: string; // "" = 전체
  label: string;
  count: number;
}

// 카테고리 목록 → 탭 배열 (전체 + 카테고리들 + 미분류)
export function buildTabs(categories: (string | null | undefined)[]): CategoryTab[] {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const key = c?.trim() || UNCATEGORIZED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const named = [...counts.entries()]
    .filter(([k]) => k !== UNCATEGORIZED)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ key: label, label, count }));
  const tabs: CategoryTab[] = [{ key: "", label: "전체", count: categories.length }, ...named];
  if (counts.has(UNCATEGORIZED))
    tabs.push({ key: UNCATEGORIZED, label: UNCATEGORIZED, count: counts.get(UNCATEGORIZED)! });
  return tabs;
}

export function matchesTab(category: string | null | undefined, tabKey: string): boolean {
  if (!tabKey) return true;
  return (category?.trim() || UNCATEGORIZED) === tabKey;
}

export function CategoryTabs({
  tabs, active, onSelect,
}: {
  tabs: CategoryTab[]; active: string; onSelect: (key: string) => void;
}) {
  if (tabs.length <= 2) return null; // 전체 + 1개뿐이면 탭 무의미
  return (
    <div className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`shrink-0 rounded-t-md border-b-2 px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
            active === t.key
              ? "border-emerald-600 bg-emerald-50 font-semibold text-emerald-800"
              : "border-transparent text-slate-500 hover:bg-slate-100"
          }`}
        >
          {t.label}
          <span className={`ml-1.5 rounded-full px-1.5 text-xs ${active === t.key ? "bg-emerald-200/70 text-emerald-800" : "bg-slate-100 text-slate-400"}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
  );
}
