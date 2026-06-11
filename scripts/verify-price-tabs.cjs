/* eslint-disable @typescript-eslint/no-require-imports */
// ① 판매가 수정 → 격차 리포트 즉시 반영 ② 카테고리 탭 ③ 요약 카드 삭제 실측
// 실행: node scripts/verify-price-tabs.cjs [baseUrl]
const { createRequire } = require("module");
const req = createRequire("/home/gihwaja/apps/6-4-url-list/node_modules/");
const puppeteer = req("puppeteer");
const BASE = process.argv[2] || "http://localhost:3000";
const SKU = "LDS-D-11";

async function editProduct(page, sku, patch) {
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate((sku) => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(sku));
    [...row.querySelectorAll("button")].find((b) => b.textContent.includes("수정")).click();
  }, sku);
  await page.waitForFunction(() => document.body.textContent.includes("품목 수정"));
  for (const [label, value] of Object.entries(patch)) {
    await page.evaluate((label, value) => {
      const lab = [...document.querySelectorAll("label")].find((l) => l.querySelector("span")?.textContent?.startsWith(label));
      const input = lab.querySelector("input");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, label, value);
  }
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "저장").click();
  });
  await page.waitForFunction(() => !document.body.textContent.includes("품목 수정"), { timeout: 30000 });
}

async function reportCell(page, sku) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 60000 });
  return page.evaluate((sku) => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(sku));
    if (!row) return null;
    const tds = [...row.querySelectorAll("td")].map((t) => t.textContent.trim());
    return { myPrice: tds[1], tabs: [...document.querySelectorAll("button")].filter((b) => b.textContent.includes("전체")).length };
  }, sku);
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());

  // 0) 요약 카드 삭제 확인
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 60000 });
  // "마진 침해만" 필터 체크박스는 남는 것이 정상 — 카드 고유 문구만 검사
  const hasCards = await page.evaluate(() =>
    ["리포트 품목", "평균 격차 / 총 표본", "시세 급락 (≤"].some((t) => document.body.textContent.includes(t)),
  );
  if (hasCards) throw new Error("FAIL: 요약 카드가 아직 남아있음");
  console.log("✓ 요약 카드 삭제됨");

  const before = await reportCell(page, SKU);
  console.log(`현재 리포트 내판매가: ${before.myPrice}`);

  // 1) 판매가 7,500 + 카테고리 '테스트탭'으로 수정
  await editProduct(page, SKU, { "내 판매가": "7500", "카테고리": "테스트탭" });
  const after = await reportCell(page, SKU);
  if (!after.myPrice.includes("7,500")) throw new Error(`FAIL: 리포트 내판매가 미반영 (${after.myPrice})`);
  console.log(`✓ 판매가 수정 → 격차 리포트 즉시 반영: ${after.myPrice}`);

  // 2) 카테고리 탭 (2종이 되었으니 탭 바 표시)
  const tabInfo = await page.evaluate(() => {
    const tabBtns = [...document.querySelectorAll("button")].map((b) => b.textContent.trim());
    return {
      all: tabBtns.some((t) => t.startsWith("전체")),
      test: tabBtns.some((t) => t.startsWith("테스트탭")),
    };
  });
  if (!tabInfo.all || !tabInfo.test) throw new Error("FAIL: 카테고리 탭 미표시");
  // 탭 클릭 → 리렌더 후 해당 카테고리만 필터되는지 (React 상태 갱신 대기)
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("테스트탭")).click();
  });
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1, { timeout: 5000 });
  console.log("✓ 카테고리 탭 표시 + 클릭 시 해당 품목만 필터");

  // 3) 원복 (판매가 7000, 카테고리 LED매입등)
  await editProduct(page, SKU, { "내 판매가": "7000", "카테고리": "LED매입등" });
  const restored = await reportCell(page, SKU);
  if (!restored.myPrice.includes("7,000")) throw new Error(`FAIL: 원복 실패 (${restored.myPrice})`);
  console.log(`✓ 원복 완료: ${restored.myPrice}`);

  console.log("\n✅ PASS: 판매가 즉시 반영 + 카테고리 탭 + 카드 삭제 실측 완료");
  await browser.close();
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
