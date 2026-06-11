/* eslint-disable @typescript-eslint/no-require-imports */
// 수동 스캔 버튼 실측: 클릭 → run 생성 확인 → /runs에서 done까지 폴링
const { createRequire } = require("module");
const req = createRequire("/home/gihwaja/apps/6-4-url-list/node_modules/");
const puppeteer = req("puppeteer");
const BASE = process.argv[2] || "http://localhost:3000";

async function main() {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 60000 });

  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("수동 스캔"));
    if (!b) throw new Error("수동 스캔 버튼 없음");
    b.click();
  });
  await page.waitForFunction(() => document.body.textContent.includes("스캔 시작됨"), { timeout: 30000 });
  const runId = await page.evaluate(() => document.body.textContent.match(/스캔 시작됨 — (\S+)/)?.[1]);
  console.log(`✓ 버튼 클릭 → 스캔 시작: ${runId}`);

  // /runs에서 해당 run이 done 될 때까지 폴링 (최대 5분)
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    await page.goto(`${BASE}/runs`, { waitUntil: "networkidle0", timeout: 60000 });
    const status = await page.evaluate((runId) => {
      const row = [...document.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes(runId));
      return row ? row.querySelector("span")?.textContent.trim() : null;
    }, runId);
    process.stdout.write(`  status=${status}\n`);
    if (status === "done") {
      console.log(`✅ PASS: 수동 스캔 ${runId} 완료 (status=done)`);
      await browser.close();
      return;
    }
    if (status === "failed") throw new Error("FAIL: run failed");
  }
  throw new Error("FAIL: 5분 내 미완료");
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); });
