import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";

const target = process.argv[2];
const cases = {
  regression: {
    url: "http://127.0.0.1:8000/tests/regression.html",
    expected: "68/68 件成功",
    timeout: 45_000,
  },
  durability: {
    url: "http://127.0.0.1:8000/tests/durability.html",
    expected: "PASS: 耐久テスト完了",
    timeout: 180_000,
  },
  selfplay: {
    url: "http://127.0.0.1:8000/tests/self-play.html?games=500&maxPlies=600",
    expected: '"games": 500',
    timeout: 300_000,
  },
};

if (!cases[target]) {
  throw new Error("Usage: node tests/run-browser-test.mjs <regression|durability|selfplay>");
}

const test = cases[target];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(test.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(
    expected => document.body.innerText.includes(expected),
    test.expected,
    { timeout: test.timeout },
  );
  const text = await page.locator("body").innerText();
  await writeFile(`${target}.html`, await page.content(), "utf8");
  await page.screenshot({ path: `${target}.png`, fullPage: true });
  console.log(text);
} catch (error) {
  const pages = browser.contexts().flatMap(context => context.pages());
  const page = pages.at(-1);
  if (page) {
    await writeFile(`${target}.html`, await page.content(), "utf8").catch(() => {});
    await page.screenshot({ path: `${target}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
