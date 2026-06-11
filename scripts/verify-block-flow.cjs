/* eslint-disable @typescript-eslint/no-require-imports */
// 표본 삭제→영구 차단→해제 UI 실측 (puppeteer는 6-4-url-list 설치본 재사용)
// 실행: node scripts/verify-block-flow.cjs <baseUrl> <block|unblock> [sku]
const { createRequire } = require("module");
const req = createRequire("/home/gihwaja/apps/6-4-url-list/node_modules/");
const puppeteer = req("puppeteer");

const BASE = process.argv[2] || "http://localhost:3000";
const MODE = process.argv[3] || "block";
const SKU = process.argv[4] || "LDS-D-13";

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/product/${SKU}`, { waitUntil: "networkidle0", timeout: 60000 });

  if (MODE === "block") {
    // 1) 썸네일 렌더 확인
    const thumbs = await page.evaluate(
      () => [...document.querySelectorAll("tbody img")].filter((i) => i.src.startsWith("http")).length,
    );
    if (!thumbs) throw new Error("FAIL: 썸네일 이미지 0개 (스캔 후 image 컬럼 미수집?)");
    console.log(`✓ 썸네일 ${thumbs}개 렌더`);

    // 2) 첫 표본 행 클릭 → 인라인 상세
    await page.evaluate(() => {
      document.querySelector("tbody tr").click();
    });
    await page.waitForFunction(
      () => document.body.textContent.includes("삭제 + 영구 차단"),
      { timeout: 10000 },
    );
    const inline = await page.evaluate(() => ({
      bigImg: !!document.querySelector("td[colspan] img"),
      naverLink: !!([...document.querySelectorAll("a")].find((a) => a.textContent.includes("네이버에서 보기"))),
      detail: document.body.textContent.includes("판매처:"),
    }));
    if (!inline.detail) throw new Error("FAIL: 인라인 상세 미표시");
    console.log(`✓ 행 클릭 → 인라인 상세 (큰이미지=${inline.bigImg}, 네이버링크=${inline.naverLink}) — 사이트 이동 없음`);

    // 3) 인라인 패널의 "삭제 + 영구 차단" 클릭
    const blockedTitle = await page.evaluate(() => {
      const panel = document.querySelector("td[colspan]");
      const title = panel.querySelector("p.font-medium").textContent;
      [...panel.querySelectorAll("button")].find((b) => b.textContent.includes("영구 차단")).click();
      return title;
    });
    await page.waitForFunction(
      () => document.body.textContent.includes("차단된 상품"),
      { timeout: 30000 },
    );
    console.log(`✓ 삭제+차단 완료 → "차단된 상품" 섹션 표시 ("${blockedTitle.slice(0, 40)}…")`);
    console.log("✅ PASS(block)");
  } else {
    // 해제: 차단 섹션 펼치고 해제 클릭 → 섹션 소멸
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => b.textContent.includes("차단된 상품")).click();
    });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "해제"), { timeout: 10000 });
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "해제").click();
    });
    await page.waitForFunction(
      () => !document.body.textContent.includes("차단된 상품"),
      { timeout: 30000 },
    );
    console.log("✅ PASS(unblock): 차단 해제 → 섹션 사라짐 (다음 스캔부터 재수집)");
  }
  await browser.close();
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
