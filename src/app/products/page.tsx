import { dbConfigured, allProducts } from "@/lib/dashboard";
import { SetupBanner } from "@/app/_components/SetupBanner";
import { ProductManager } from "./_ProductManager";
import type { ProductInput } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  if (!dbConfigured()) return <SetupBanner />;
  const products = (await allProducts()) as ProductInput[];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">취급 품목 관리</h1>
        <p className="text-sm text-slate-500">
          시세 비교 대상 상품의 매입가·판매가·검색어를 관리합니다. 저장 전 “검색어 테스트”로 수집 품질을 미리 확인하세요.
        </p>
      </header>
      <ProductManager initial={products} />
    </main>
  );
}
