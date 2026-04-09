/**
 * scripts/crawl.js
 * Crawler with two source modes:
 *   1. SITEMAP — reads a sitemap.xml URL and crawls listed pages
 *   2. URL_LIST — crawls an explicit array of URLs defined in crawl-config.js
 *
 * Usage:
 *   CRAWL_MODE=sitemap node scripts/crawl.js
 *   CRAWL_MODE=urllist node scripts/crawl.js
 *   node scripts/crawl.js          ← defaults to sitemap if SITEMAP_URL is set, else urllist
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

// ─── Load env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        const eq = t.indexOf('=');
        if (eq === -1) return;
        const k = t.slice(0, eq).trim();
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (k && !(k in process.env)) process.env[k] = v;
    });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CRAWL_MODE = process.env.CRAWL_MODE || (process.env.SITEMAP_URL ? 'sitemap' : 'urllist');
const SITEMAP_URL = process.env.SITEMAP_URL || 'https://www.upes.ac.in/sitemap.xml';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '100', 10);
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '1', 10));
const DELAY_MS = 1200;
const SITEMAP_TIMEOUT = 45_000;
const PAGE_TIMEOUT = 20_000;
const MAX_RETRIES = 3;
const OUTPUT_DIR = path.join(rootDir, 'crawled-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pages.json');

// ─── Explicit URL list (used when CRAWL_MODE=urllist) ─────────────────────────
// Edit this array to add/remove pages to index in the knowledge base.
const MANUAL_URLS = [
    'https://www.upes.ac.in',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FETCH_OPTS = {
    headers: { 'User-Agent': 'UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)' },
};

function normaliseUrl(url, base) {
    try {
        const u = new URL(url, base);
        u.hash = '';
        return u.href.replace(/\/$/, '');
    } catch { return null; }
}

function extractText($) {
    $('script, style, nav, footer, header, noscript, iframe, [class*="menu"], [class*="sidebar"], [class*="cookie"]').remove();
    return $('body').text().replace(/\s+/g, ' ').trim().slice(0, 10_000);
}

// ─── Mode 1: Sitemap ──────────────────────────────────────────────────────────

async function fetchWithRetry(url, opts, timeout = SITEMAP_TIMEOUT, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(timeout) });
            if (!res.ok) {
                console.warn(`   ⚠️  HTTP ${res.status} for ${url} (attempt ${attempt}/${retries})`);
                if (attempt < retries) { await sleep(2000 * attempt); continue; }
                return null;
            }
            return res;
        } catch (err) {
            console.warn(`   ⚠️  ${err.message} for ${url} (attempt ${attempt}/${retries})`);
            if (attempt < retries) { await sleep(2000 * attempt); continue; }
            return null;
        }
    }
    return null;
}

async function fetchUrlsFromSitemap(sitemapUrl, visited = new Set(), depth = 0) {
    if (depth > 4) return [];
    console.log(`   📄 Reading sitemap (depth ${depth}): ${sitemapUrl}`);

    const res = await fetchWithRetry(sitemapUrl, FETCH_OPTS);
    if (!res) return [];

    try {
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });

        const urls = [];

        // Sitemap index (nested sitemaps)
        $('sitemap loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc && !visited.has(loc)) { visited.add(loc); urls.push({ type: 'sitemap', url: loc }); }
        });

        // URL entries
        $('url loc').each((_, el) => {
            const loc = $(el).text().trim();
            if (loc) urls.push({ type: 'page', url: loc });
        });

        const subSitemaps = urls.filter(u => u.type === 'sitemap');
        const directPages = urls.filter(u => u.type === 'page').map(u => u.url);
        console.log(`   ↳ Found ${directPages.length} page URLs + ${subSitemaps.length} sub-sitemaps`);

        // Recursively fetch nested sitemaps
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

// ─── Page Scraper ─────────────────────────────────────────────────────────────

export async function scrapePage(url) {
    const res = await fetchWithRetry(url, FETCH_OPTS, PAGE_TIMEOUT, 2);
    if (!res) return null;

    try {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('html')) return null;

        const html = await res.text();
        const $ = cheerio.load(html);
        const title = $('title').text().trim() || url;
        const text = extractText($);

        if (text.length < 80) return null;
        return { url, title, text, crawledAt: new Date().toISOString() };
    } catch (err) {
        console.warn(`   ❌ ${url}: ${err.message}`);
        return null;
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function crawl() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`\n🕷️  Crawler starting — Mode: ${CRAWL_MODE.toUpperCase()}`);
    console.log(`   Max pages: ${MAX_PAGES}, Concurrency: ${CONCURRENCY}\n`);

    let targetUrls = [];

    if (CRAWL_MODE === 'sitemap') {
        console.log(`📡 Fetching sitemap from: ${SITEMAP_URL}`);
        const allUrls = await fetchUrlsFromSitemap(SITEMAP_URL);
        console.log(`\n   📊 Total URLs from sitemap: ${allUrls.length}`);

        const afterDomain = allUrls.filter(u => /upes\.ac\.in/i.test(u));
        console.log(`   After domain filter: ${afterDomain.length}`);

        const afterFileType = afterDomain.filter(u => !/\.(pdf|png|jpg|jpeg|gif|svg|zip|docx?|pptx?|mp4|webp)$/i.test(u));
        console.log(`   After file-type filter: ${afterFileType.length}`);

        const afterRouteFilter = afterFileType.filter(u => !/login|logout|register|cart|checkout|wp-admin/i.test(u));
        console.log(`   After route filter: ${afterRouteFilter.length}`);

        targetUrls = afterRouteFilter.slice(0, MAX_PAGES);
        console.log(`   After MAX_PAGES cap (${MAX_PAGES}): ${targetUrls.length}\n`);
    } else {
        console.log(`📋 Using manual URL list (${MANUAL_URLS.length} URLs)\n`);
        targetUrls = MANUAL_URLS.slice(0, MAX_PAGES);
    }

    if (targetUrls.length === 0) {
        console.error('❌ No URLs to crawl. Check your sitemap URL or MANUAL_URLS list.');
        process.exit(1);
    }

    // Deduplicate
    targetUrls = [...new Set(targetUrls)];

    const pages = [];
    for (let i = 0; i < targetUrls.length; i += CONCURRENCY) {
        const batch = targetUrls.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (url, j) => {
            const idx = i + j + 1;
            console.log(`[${idx}/${targetUrls.length}] Scraping: ${url}`);
            const page = await scrapePage(url);
            if (page) {
                console.log(`   ✅ "${page.title.slice(0, 60)}" (${page.text.length} chars)`);
            } else {
                console.log('   ⏭️  Skipped (no content or error)');
            }
            return page;
        }));
        pages.push(...results.filter(Boolean));

        if (i + CONCURRENCY < targetUrls.length) await sleep(DELAY_MS);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pages, null, 2), 'utf-8');
    console.log(`\n✅ Crawl complete! ${pages.length} pages saved to: ${OUTPUT_FILE}`);
    console.log('   Run "npm run index" to upload to Upstash.\n');
}

// Only run crawl when executed directly (not when imported)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    crawl().catch(err => {
        console.error('Crawler failed:', err);
        process.exit(1);
    });
}
