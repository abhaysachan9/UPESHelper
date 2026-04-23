/**
 * scripts/crawlDynamic.js
 * One-off crawler for a manually curated list of pages (DYNAMIC_PAGES in
 * scripts/dynamic-pages-config.js). Useful when you need to add a single
 * extra page without re-running the full sitemap crawl.
 *
 * Output: crawled-data/pages-list.json
 *
 * For the main bulk crawl, use:  npm run crawl:sitemap
 * For the fee-structure SPA, use: npm run crawl:fees
 *
 * Env vars:
 *   CONCURRENCY        — parallel browser tabs (default 4)
 *   PUPPETEER_HEADLESS — "false" to run with a visible browser
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import { DYNAMIC_PAGES } from "./dynamic-pages-config.js";

// ─── Load env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const eq = t.indexOf("=");
      if (eq === -1) return;
      const k = t.slice(0, eq).trim();
      const v = t
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (k && !(k in process.env)) process.env[k] = v;
    });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || "4", 10));
const OUTPUT_DIR = path.join(rootDir, "crawled-data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pages-list.json");
const PAGE_TIMEOUT = 30_000;
const WAIT_FOR_CONTENT = 3000;
const MAX_TEXT_LENGTH = 25_000;
const HEADLESS = process.env.PUPPETEER_HEADLESS !== "false";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function extractPageContent(page) {
  return await page.evaluate((maxLength) => {
    const removeSelectors = [
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "nav",
      "footer",
      "body > header",
      '[role="navigation"]',
      '[class*="cookie"]',
      '[id*="cookie"]',
      '[class*="site-header"]',
      '[class*="site-footer"]',
      '[class*="site-nav"]',
    ];

    removeSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => el.remove());
    });

    const title = document.title || "";

    const metaDesc =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "";

    let contentEl =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("article") ||
      document.querySelector(".content") ||
      document.querySelector(".page-content") ||
      document.querySelector("#content") ||
      document.querySelector("#main-content") ||
      document.body;

    contentEl.querySelectorAll("table").forEach((table) => {
      const allRows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          cells.push(cell.textContent.replace(/\s+/g, " ").trim());
        });
        if (cells.some((c) => c.length > 0)) allRows.push(cells);
      });

      if (allRows.length >= 1) {
        const colCount = Math.max(...allRows.map((r) => r.length));
        const pad = (arr) => {
          while (arr.length < colCount) arr.push("");
          return arr;
        };
        const lines = [];
        lines.push("| " + pad(allRows[0]).join(" | ") + " |");
        lines.push("| " + Array(colCount).fill("---").join(" | ") + " |");
        for (let i = 1; i < allRows.length; i++) {
          lines.push("| " + pad(allRows[i]).join(" | ") + " |");
        }
        const tableText = document.createTextNode(
          "\n" + lines.join("\n") + "\n",
        );
        table.replaceWith(tableText);
      }
    });

    contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
      const level = parseInt(heading.tagName[1], 10);
      const prefix = "#".repeat(level);
      const text = heading.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        const headingText = document.createTextNode(`\n${prefix} ${text}\n`);
        heading.replaceWith(headingText);
      }
    });

    let rawText = contentEl.textContent || "";

    const cleaned = rawText
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const parts = [];
    if (metaDesc) parts.push(`Summary: ${metaDesc}`);
    parts.push(cleaned);

    const finalText = parts.join("\n\n").slice(0, maxLength);

    return {
      title,
      metaDescription: metaDesc,
      text: finalText,
    };
  }, MAX_TEXT_LENGTH);
}

async function scrapeDynamicPage(browser, url) {
  const page = await browser.newPage();

  try {
    console.log(`   🌐 Loading: ${url}`);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)",
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PAGE_TIMEOUT,
    });

    await sleep(WAIT_FOR_CONTENT);

    const content = await extractPageContent(page);

    if (!content.text || content.text.length < 80) {
      console.log("   ⏭️  Skipped (insufficient content)");
      return null;
    }

    console.log(
      `   ✅ "${content.title.slice(0, 60)}" (${content.text.length} chars)`,
    );

    return {
      url,
      title: content.title || url,
      metaDescription: content.metaDescription,
      text: content.text,
      crawledAt: new Date().toISOString(),
      dynamic: true,
    };
  } catch (err) {
    console.warn(`   ❌ Error: ${err.message}`);
    return null;
  } finally {
    await page.close();
  }
}

function deduplicatePages(pages) {
  const seen = new Map();
  const unique = [];
  for (const page of pages) {
    const fingerprint = page.text.slice(200, 700).replace(/\s+/g, " ").trim();
    if (seen.has(fingerprint)) {
      console.log(`   🔁 Duplicate skipped: ${page.url}`);
      continue;
    }
    seen.set(fingerprint, page.url);
    unique.push(page);
  }
  return unique;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function crawlDynamic() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("\n🕷️  Dynamic Crawler — LIST mode (Puppeteer)\n");
  const targetUrls = [...DYNAMIC_PAGES];
  console.log(`   Pages to crawl: ${targetUrls.length}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Headless mode: ${HEADLESS}\n`);

  if (targetUrls.length === 0) {
    console.log(
      "⚠️  No URLs in DYNAMIC_PAGES (scripts/dynamic-pages-config.js).",
    );
    console.log("    For the bulk crawl, use:  npm run crawl:sitemap");
    console.log("    For fee structure, use:   npm run crawl:fees\n");
    process.exit(0);
  }

  console.log("🚀 Launching browser...");
  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
    ],
  });

  const pages = [];

  try {
    for (let i = 0; i < targetUrls.length; i += CONCURRENCY) {
      const batch = targetUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (url, j) => {
          const idx = i + j + 1;
          console.log(`[${idx}/${targetUrls.length}] Processing: ${url}`);
          return scrapeDynamicPage(browser, url);
        }),
      );
      pages.push(...results.filter(Boolean));

      if (i + CONCURRENCY < targetUrls.length) await sleep(1500);
    }
  } finally {
    await browser.close();
    console.log("\n🔒 Browser closed");
  }

  const uniquePages = deduplicatePages(pages);
  if (uniquePages.length < pages.length) {
    console.log(
      `\n   🔁 Removed ${pages.length - uniquePages.length} duplicate pages`,
    );
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniquePages, null, 2), "utf-8");

  console.log(
    `\n✅ Dynamic crawl complete! ${uniquePages.length} pages saved to: ${OUTPUT_FILE}`,
  );
  console.log('   Run "npm run index" to upload to Upstash.\n');
}

crawlDynamic().catch((err) => {
  console.error("Dynamic crawler failed:", err);
  process.exit(1);
});
