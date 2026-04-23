/**
 * scripts/crawlSitemap.js
 * Primary crawler for the UPES site. Reads URLs from sitemap.xml and renders
 * each page with Puppeteer (so JS-heavy pages produce real content), then
 * writes the result to crawled-data/pages.json.
 *
 * Maintains crawl progress in crawled-data/crawl-progress.json so an
 * interrupted run can be resumed without re-fetching everything.
 *
 * The interactive fee-structure SPA is intentionally skipped here — it's
 * handled by `npm run crawl:fees` which enumerates every (school × level ×
 * course) combination. Crawling it generically would only capture the
 * default Petroleum view and pollute search results.
 *
 * Usage:
 *   node scripts/crawlSitemap.js                  ← crawl from sitemap (resumable)
 *   node scripts/crawlSitemap.js --fresh          ← discard progress, start over
 *   CRAWL_MODE=urllist node scripts/crawlSitemap.js  ← crawl MANUAL_URLS instead
 *
 * Env vars:
 *   SITEMAP_URL            — default https://www.upes.ac.in/sitemap.xml
 *   MAX_PAGES              — cap on URLs (default 100)
 *   DYNAMIC_CONCURRENCY    — parallel browser tabs (default 10)
 *   PUPPETEER_HEADLESS     — "false" to run with a visible browser
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

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
const CRAWL_MODE =
  process.env.CRAWL_MODE || (process.env.SITEMAP_URL ? "sitemap" : "urllist");
const SITEMAP_URL =
  process.env.SITEMAP_URL || "https://www.upes.ac.in/sitemap.xml";
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "100", 10);
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.DYNAMIC_CONCURRENCY || "10", 10),
);
const DELAY_MS = 2000;
const SITEMAP_TIMEOUT = 45_000;
const PAGE_TIMEOUT = 30_000;
const WAIT_FOR_CONTENT = 3000;
const MAX_RETRIES = 3;
const MAX_TEXT_LENGTH = 25_000;
const HEADLESS = process.env.PUPPETEER_HEADLESS !== "false";

const OUTPUT_DIR = path.join(rootDir, "crawled-data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pages.json");
const PROGRESS_FILE = path.join(OUTPUT_DIR, "crawl-progress.json");

// URLs we never want this generic crawler to touch — they have a dedicated
// crawler that captures their dynamic state properly.
const SKIP_URL_PATTERNS = [
  /^https?:\/\/(www\.)?upes\.ac\.in\/admissions\/fee-structure\/?$/i,
];

const FRESH = process.argv.includes("--fresh");

// Manual list used when CRAWL_MODE=urllist.
const MANUAL_URLS = ["https://www.upes.ac.in"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FETCH_OPTS = {
  headers: {
    "User-Agent":
      "UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)",
  },
};

// ─── Progress helpers ─────────────────────────────────────────────────────────

function loadProgress() {
  if (FRESH || !fs.existsSync(PROGRESS_FILE)) {
    return { crawledUrls: new Set(), pages: [] };
  }
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    return {
      crawledUrls: new Set(data.crawledUrls || []),
      pages: data.pages || [],
    };
  } catch {
    return { crawledUrls: new Set(), pages: [] };
  }
}

function saveProgress(crawledUrls, pages) {
  const data = {
    crawledUrls: [...crawledUrls],
    pages,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function clearProgress() {
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

// ─── Sitemap fetching ────────────────────────────────────────────────────────

async function fetchWithRetry(
  url,
  opts,
  timeout = SITEMAP_TIMEOUT,
  retries = MAX_RETRIES,
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...opts,
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        console.warn(
          `   ⚠️  HTTP ${res.status} for ${url} (attempt ${attempt}/${retries})`,
        );
        if (attempt < retries) {
          await sleep(2000 * attempt);
          continue;
        }
        return null;
      }
      return res;
    } catch (err) {
      console.warn(
        `   ⚠️  ${err.message} for ${url} (attempt ${attempt}/${retries})`,
      );
      if (attempt < retries) {
        await sleep(2000 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function fetchUrlsFromSitemap(
  sitemapUrl,
  visited = new Set(),
  depth = 0,
) {
  if (depth > 4) return [];
  console.log(`   📄 Reading sitemap (depth ${depth}): ${sitemapUrl}`);

  const res = await fetchWithRetry(sitemapUrl, FETCH_OPTS);
  if (!res) return [];

  try {
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    const urls = [];

    $("sitemap loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc && !visited.has(loc)) {
        visited.add(loc);
        urls.push({ type: "sitemap", url: loc });
      }
    });

    $("url loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) urls.push({ type: "page", url: loc });
    });

    const subSitemaps = urls.filter((u) => u.type === "sitemap");
    const directPages = urls.filter((u) => u.type === "page").map((u) => u.url);
    console.log(
      `   ↳ Found ${directPages.length} page URLs + ${subSitemaps.length} sub-sitemaps`,
    );

    const pages = [...directPages];
    for (const item of subSitemaps) {
      const nested = await fetchUrlsFromSitemap(item.url, visited, depth + 1);
      pages.push(...nested);
    }
    return pages;
  } catch (err) {
    console.warn(`   ❌ Sitemap parse error: ${err.message}`);
    return [];
  }
}

// ─── Puppeteer page scraper ───────────────────────────────────────────────────

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
      const rows = [];
      let headerCount = 0;
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        const isHeader = tr.querySelectorAll("th").length > 0;
        tr.querySelectorAll("th, td").forEach((cell) => {
          cells.push(cell.textContent.replace(/\s+/g, " ").trim());
        });
        if (cells.some((c) => c.length > 0)) {
          rows.push({ cells, isHeader });
          if (isHeader) headerCount++;
        }
      });

      if (rows.length === 0) return;
      const colCount = Math.max(...rows.map((r) => r.cells.length));
      const pad = (arr) => {
        while (arr.length < colCount) arr.push("");
        return arr;
      };

      const lines = [];
      lines.push("| " + pad(rows[0].cells).join(" | ") + " |");
      lines.push("| " + Array(colCount).fill("---").join(" | ") + " |");
      for (let i = 1; i < rows.length; i++) {
        lines.push("| " + pad(rows[i].cells).join(" | ") + " |");
      }

      const tableText = document.createTextNode("\n" + lines.join("\n") + "\n");
      table.replaceWith(tableText);
    });

    contentEl.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
      const level = parseInt(heading.tagName[1], 10);
      const prefix = "#".repeat(level);
      const text = heading.textContent.replace(/\s+/g, " ").trim();
      if (text) {
        heading.replaceWith(document.createTextNode(`\n${prefix} ${text}\n`));
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

    return {
      title,
      metaDescription: metaDesc,
      text: parts.join("\n\n").slice(0, maxLength),
    };
  }, MAX_TEXT_LENGTH);
}

async function scrapeWithBrowser(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)",
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: PAGE_TIMEOUT });
    await sleep(WAIT_FOR_CONTENT);

    const content = await extractPageContent(page);

    if (!content.text || content.text.length < 80) {
      return null;
    }

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

/**
 * One-shot scraper for callers that want a single page (e.g. reindexPage.js).
 * Launches its own short-lived browser.
 */
export async function scrapeSinglePage(url) {
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
  try {
    return await scrapeWithBrowser(browser, url);
  } finally {
    await browser.close();
  }
}

// ─── Content Dedup ────────────────────────────────────────────────────────────

function deduplicatePages(pages) {
  const seen = new Map();
  const unique = [];
  for (const page of pages) {
    const fingerprint = page.text.slice(200, 700).replace(/\s+/g, " ").trim();
    if (seen.has(fingerprint)) {
      console.log(
        `   🔁 Skipping duplicate: ${page.url} (same content as ${seen.get(fingerprint)})`,
      );
      continue;
    }
    seen.set(fingerprint, page.url);
    unique.push(page);
  }
  return unique;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function crawlSitemap() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🕷️  Sitemap Crawler starting (Puppeteer)`);
  console.log(`   Mode: ${CRAWL_MODE.toUpperCase()}`);
  console.log(`   Max pages: ${MAX_PAGES}, Concurrency: ${CONCURRENCY}`);
  console.log(`   Headless: ${HEADLESS}\n`);

  let targetUrls = [];

  if (CRAWL_MODE === "sitemap") {
    console.log(`📡 Fetching sitemap from: ${SITEMAP_URL}`);
    const allUrls = await fetchUrlsFromSitemap(SITEMAP_URL);
    console.log(`\n   📊 Total URLs from sitemap: ${allUrls.length}`);

    const afterDomain = allUrls.filter((u) => /upes\.ac\.in/i.test(u));
    console.log(`   After domain filter: ${afterDomain.length}`);

    const afterFileType = afterDomain.filter(
      (u) => !/\.(pdf|png|jpg|jpeg|gif|svg|zip|docx?|pptx?|mp4|webp)$/i.test(u),
    );
    console.log(`   After file-type filter: ${afterFileType.length}`);

    const afterRouteFilter = afterFileType.filter(
      (u) => !/login|logout|register|cart|checkout|wp-admin/i.test(u),
    );
    console.log(`   After route filter: ${afterRouteFilter.length}`);

    const afterSkip = afterRouteFilter.filter(
      (u) => !SKIP_URL_PATTERNS.some((p) => p.test(u)),
    );
    if (afterSkip.length !== afterRouteFilter.length) {
      console.log(
        `   After skip-list filter: ${afterSkip.length} (dropped ${afterRouteFilter.length - afterSkip.length} — fee-structure SPA is handled by crawl:fees)`,
      );
    }

    targetUrls = afterSkip.slice(0, MAX_PAGES);
    console.log(
      `   After MAX_PAGES cap (${MAX_PAGES}): ${targetUrls.length}\n`,
    );
  } else {
    console.log(`📋 Using manual URL list (${MANUAL_URLS.length} URLs)\n`);
    targetUrls = MANUAL_URLS.slice(0, MAX_PAGES);
  }

  if (targetUrls.length === 0) {
    console.error(
      "❌ No URLs to crawl. Check your sitemap URL or MANUAL_URLS list.",
    );
    process.exit(1);
  }

  targetUrls = [...new Set(targetUrls.map((u) => u.replace(/\/$/, "")))];

  const progress = loadProgress();
  const alreadyCrawled = progress.crawledUrls;
  const pages = [...progress.pages];

  const remaining = targetUrls.filter((u) => !alreadyCrawled.has(u));

  if (alreadyCrawled.size > 0 && !FRESH) {
    console.log(`📂 Resuming previous crawl`);
    console.log(`   Already crawled: ${alreadyCrawled.size}`);
    console.log(`   Remaining: ${remaining.length}\n`);
  }

  if (remaining.length === 0) {
    console.log("✅ All URLs already crawled! Use --fresh to re-crawl.");
    const uniquePages = deduplicatePages(pages);
    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(uniquePages, null, 2),
      "utf-8",
    );
    console.log(`   ${uniquePages.length} pages saved to: ${OUTPUT_FILE}\n`);
    clearProgress();
    return;
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

  try {
    for (let i = 0; i < remaining.length; i += CONCURRENCY) {
      const batch = remaining.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (url, j) => {
          const idx = alreadyCrawled.size + i + j + 1;
          const total = alreadyCrawled.size + remaining.length;
          console.log(`[${idx}/${total}] Scraping: ${url}`);
          const page = await scrapeWithBrowser(browser, url);
          if (page) {
            console.log(
              `   ✅ "${page.title.slice(0, 60)}" (${page.text.length} chars)`,
            );
          } else {
            console.log("   ⏭️  Skipped (no content or error)");
          }
          return { url, page };
        }),
      );

      for (const { url, page } of results) {
        alreadyCrawled.add(url);
        if (page) pages.push(page);
      }

      saveProgress(alreadyCrawled, pages);
      console.log(
        `   💾 Progress saved (${alreadyCrawled.size}/${alreadyCrawled.size + remaining.length - i - batch.length} crawled)`,
      );

      if (i + CONCURRENCY < remaining.length) await sleep(DELAY_MS);
    }
  } catch (err) {
    console.error(`\n⚠️  Crawl interrupted: ${err.message}`);
    saveProgress(alreadyCrawled, pages);
    console.log(
      `   💾 Progress saved! ${alreadyCrawled.size} URLs crawled so far.`,
    );
    console.log(
      "   Run the command again to resume from where you left off.\n",
    );
    await browser.close();
    process.exit(1);
  }

  await browser.close();
  console.log("\n🔒 Browser closed");

  const uniquePages = deduplicatePages(pages);
  if (uniquePages.length < pages.length) {
    console.log(
      `\n   🔁 Removed ${pages.length - uniquePages.length} duplicate pages`,
    );
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniquePages, null, 2), "utf-8");
  console.log(
    `\n✅ Sitemap crawl complete! ${uniquePages.length} pages saved to: ${OUTPUT_FILE}`,
  );
  console.log(
    '   Tip: "npm run crawl:sitemap" also runs "npm run crawl:fees" automatically.\n',
  );

  clearProgress();
}

// Only run when invoked directly, not when imported (e.g. by reindexPage.js).
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("crawlSitemap.js");

if (invokedDirectly) {
  crawlSitemap().catch((err) => {
    console.error("Sitemap crawler failed:", err);
    process.exit(1);
  });
}
