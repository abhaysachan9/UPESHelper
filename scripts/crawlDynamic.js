/**
 * scripts/crawlDynamic.js
 * Dynamic crawler using Puppeteer for JavaScript-heavy pages
 * 
 * Usage:
 *   node scripts/crawlDynamic.js
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
const OUTPUT_DIR = path.join(rootDir, "crawled-data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pages-dynamic.json");
const PAGE_TIMEOUT = 30_000;
const WAIT_FOR_CONTENT = 3000; // Wait for JS to render
const MAX_TEXT_LENGTH = 25_000;
const HEADLESS = process.env.PUPPETEER_HEADLESS !== "false";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract structured text from a rendered page
 */
async function extractPageContent(page) {
  return await page.evaluate((maxLength) => {
    // Remove noise elements
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

    // Get title
    const title = document.title || "";

    // Get meta description
    const metaDesc =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "";

    // Find main content area
    let contentEl =
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector("article") ||
      document.querySelector(".content") ||
      document.querySelector(".page-content") ||
      document.querySelector("#content") ||
      document.querySelector("#main-content") ||
      document.body;

    // Convert tables to text
    contentEl.querySelectorAll("table").forEach((table) => {
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((cell) => {
          const text = cell.textContent.replace(/\s+/g, " ").trim();
          if (text) cells.push(text);
        });
        if (cells.length > 0) rows.push(cells.join(" | "));
      });
      if (rows.length > 0) {
        const tableText = document.createTextNode("\n" + rows.join("\n") + "\n");
        table.replaceWith(tableText);
      }
    });

    // Preserve heading hierarchy
    contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
      const level = parseInt(heading.tagName[1], 10);
      const prefix = "#".repeat(level);
      const text = heading.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        const headingText = document.createTextNode(`\n${prefix} ${text}\n`);
        heading.replaceWith(headingText);
      }
    });

    // Extract text
    let rawText = contentEl.textContent || "";

    // Normalize whitespace
    const cleaned = rawText
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Prepend meta description
    const parts = [];
    if (metaDesc) {
      parts.push(`Summary: ${metaDesc}`);
    }
    parts.push(cleaned);

    const finalText = parts.join("\n\n").slice(0, maxLength);

    return {
      title,
      metaDescription: metaDesc,
      text: finalText,
    };
  }, MAX_TEXT_LENGTH);
}

/**
 * Scrape a single page with Puppeteer
 */
async function scrapeDynamicPage(browser, url) {
  const page = await browser.newPage();

  try {
    console.log(`   🌐 Loading: ${url}`);

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)"
    );

    // Navigate to page
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PAGE_TIMEOUT,
    });

    // Wait for dynamic content to render
    await sleep(WAIT_FOR_CONTENT);

    // Extract content
    const content = await extractPageContent(page);

    if (!content.text || content.text.length < 80) {
      console.log("   ⏭️  Skipped (insufficient content)");
      return null;
    }

    console.log(
      `   ✅ "${content.title.slice(0, 60)}" (${content.text.length} chars)`
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function crawlDynamic() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("\n🕷️  Dynamic Crawler starting (Puppeteer)\n");
  console.log(`   Pages to crawl: ${DYNAMIC_PAGES.length}`);
  console.log(`   Headless mode: ${HEADLESS}\n`);

  if (DYNAMIC_PAGES.length === 0) {
    console.log(
      "⚠️  No dynamic pages configured. Add URLs to scripts/dynamic-pages-config.js"
    );
    console.log("   Example:");
    console.log('   export const DYNAMIC_PAGES = [');
    console.log('     "https://www.upes.ac.in/your-dynamic-page",');
    console.log('   ];\n');
    process.exit(0);
  }

  // Launch browser
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
    // Crawl each page sequentially (to avoid overwhelming the server)
    for (let i = 0; i < DYNAMIC_PAGES.length; i++) {
      const url = DYNAMIC_PAGES[i];
      console.log(`\n[${i + 1}/${DYNAMIC_PAGES.length}] Processing: ${url}`);

      const pageData = await scrapeDynamicPage(browser, url);
      if (pageData) {
        pages.push(pageData);
      }

      // Small delay between pages
      if (i < DYNAMIC_PAGES.length - 1) {
        await sleep(1000);
      }
    }
  } finally {
    await browser.close();
    console.log("\n🔒 Browser closed");
  }

  // Save results
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pages, null, 2), "utf-8");

  console.log(
    `\n✅ Dynamic crawl complete! ${pages.length} pages saved to: ${OUTPUT_FILE}`
  );
  console.log('   Run "npm run index" to upload to Upstash.\n');
}

// Run crawler
crawlDynamic().catch((err) => {
  console.error("Dynamic crawler failed:", err);
  process.exit(1);
});
