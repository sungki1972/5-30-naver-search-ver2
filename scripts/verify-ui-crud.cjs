/* eslint-disable @typescript-eslint/no-require-imports */
// 품목 CRUD UI 실측 검증 (puppeteer는 6-4-url-list 설치본 재사용; CJS 스크립트라 require 필요)
// 실행: node scripts/verify-ui-crud.cjs [baseUrl]
const { createRequire } = require("module");
const req = createRequire("/home/gihwaja/apps/6-4-url-list/node_modules/");
const puppeteer = req("puppeteer");

const BASE = process.argv[2] || "http://localhost:3057";
const NAME = `검증용 누전차단기 30A ${Date.now()}`;

async function fillByLabel(page, labelText, value) {
  const ok = await page.evaluate(
    (labelText, value) => {
      const labels = [...document.querySelectorAll("label")];
      const label = labels.find((l) => l.querySelector("span")?.textContent?.includes(labelText));
      if (!label) return false;
      const input = label.querySelector("input, textarea");
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(
        input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    },
    labelText,
    value,
  );
  if (!ok) throw new Error(`FAIL: 폼 필드 '${labelText}' 없음`);
}

async function clickByText(page, selector, text) {
  const ok = await page.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find((b) => b.textContent.trim().includes(text));
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`FAIL: '${text}' 버튼 없음`);
}

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());

  try {
    await page.goto(`${BASE}/products`, { waitUntil: "networkidle0", timeout: 60000 });

    // 1) 새 품목 폼 열기
    await clickByText(page, "button", "+ 새 품목");
    await page.waitForFunction(() => document.body.textContent.includes("새 품목 추가"));

    // 2) 삭제 대상 필드가 폼에 없는지 확인 (SKU/인치/카테고리/규격)
    const removed = await page.evaluate(() => {
      const labels = [...document.querySelectorAll("label span")].map((s) => s.textContent);
      return ["SKU", "인치", "카테고리", "규격"].filter((f) => labels.some((l) => l && l.startsWith(f)));
    });
    if (removed.length) throw new Error(`FAIL: 삭제됐어야 할 필드 잔존: ${removed.join(",")}`);
    console.log("✓ 폼에 SKU/인치/카테고리/규격 필드 없음");

    // 3) 입력 후 저장
    await fillByLabel(page, "품명", NAME);
    await fillByLabel(page, "매입가", "5000");
    await fillByLabel(page, "내 판매가", "8000");
    await fillByLabel(page, "검색어", "남영 누전차단기 30A");
    await clickByText(page, "button", "저장");

    // 4) 목록에 자동 생성 코드와 함께 나타나는지
    await page.waitForFunction(
      (name) => document.body.textContent.includes(name),
      { timeout: 30000 },
      NAME,
    );
    const code = await page.evaluate((name) => {
      const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(name));
      return row?.querySelector("td")?.textContent ?? null;
    }, NAME);
    if (!/^P-\d{6}-\d{6}$/.test(code ?? "")) throw new Error(`FAIL: 자동 코드 형식 불일치: ${code}`);
    console.log(`✓ 저장 성공, 자동 코드 생성: ${code} (마진 3,000원 표시 확인용 행 존재)`);

    // 5) UI 삭제로 정리 (dialog 자동 accept)
    await page.evaluate((name) => {
      const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(name));
      [...row.querySelectorAll("button")].find((b) => b.textContent.includes("삭제")).click();
    }, NAME);
    await page.waitForFunction(
      (name) => !document.body.textContent.includes(name),
      { timeout: 30000 },
      NAME,
    );
    console.log("✓ 삭제 성공 (목록에서 제거 확인)");

    console.log("\n✅ PASS: 새 품목 자동코드 생성 → 저장 → 삭제 CRUD 실측 완료");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
