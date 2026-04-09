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
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '3', 10));
const DELAY_MS = 1200;
const SITEMAP_TIMEOUT = 45_000;
const PAGE_TIMEOUT = 20_000;
const MAX_RETRIES = 3;
const MAX_TEXT_LENGTH = 25_000;
const OUTPUT_DIR = path.join(rootDir, 'crawled-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'pages.json');

// ─── Explicit URL list (used when CRAWL_MODE=urllist) ─────────────────────────
const MANUAL_URLS = [
    'https://www.upes.ac.in',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const FETCH_OPTS = {
    headers: { 'User-Agent': 'UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)' },
};

/**
 * Extract metadata (description, OG tags) from the page.
 */
function extractMeta($) {
    const description = $('meta[name="description"]').attr('content')
        || $('meta[property="og:description"]').attr('content')
        || '';
    return description.trim();
}

/**
 * Convert a <table> element to readable plain text.
 */
function tableToText($, table) {
    const rows = [];
    $(table).find('tr').each((_, tr) => {
        const cells = [];
        $(tr).find('th, td').each((_, cell) => {
            cells.push($(cell).text().replace(/\s+/g, ' ').trim());
        });
        if (cells.some(c => c.length > 0)) {
            rows.push(cells.join(' | '));
        }
    });
    return rows.join('\n');
}

/**
 * Extract structured text content from a page.
 * Targets <main>/<article> first; preserves headings, handles tables,
 * prepends meta description if provided.
 */
function extractText($, metaDescription = '') {
    // Remove noise elements (but NOT <header> inside content areas)
    $('script, style, noscript, iframe, svg').remove();

    // Remove site-level navigation and chrome (more targeted than before)
    $('nav, footer').remove();
    $('body > header').remove();
    $('[role="navigation"]').remove();
    $('[class="cookie-banner"], [class="cookie-notice"], [id="cookie-banner"]').remove();
    $('[class="site-header"], [class="site-footer"], [class="site-nav"]').remove();

    // Try to find the main content area first
    let $content = $('main, [role="main"]');
    if ($content.length === 0) $content = $('article');
    if ($content.length === 0) $content = $('.content, .page-content, #content, #main-content');
    if ($content.length === 0) $content = $('body');

    const parts = [];

    // Prepend meta description as a summary line
    if (metaDescription) {
        parts.push(`Summary: ${metaDescription}`);
    }

    // Convert tables to structured text before extracting
    $content.find('table').each((_, table) => {
        const tableText = tableToText($, table);
        if (tableText) {
            $(table).replaceWith(`\n${tableText}\n`);
        }
    });

    // Preserve heading hierarchy
    $content.find('h1, h2, h3, h4, h5, h6').each((_, heading) => {
        const tag = heading.tagName.toLowerCase();
        const level = parseInt(tag[1], 10);
        const prefix = '#'.repeat(level);
        const text = $(heading).text().replace(/\s+/g, ' ').trim();
        if (text) {
            $(heading).replaceWith(`\n${prefix} ${text}\n`);
        }
    });

    // Extract the final text
    const rawText = $content.text();

    // Normalise whitespace while preserving intentional line breaks
    const cleaned = rawText
        .split('\n')
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(line => line.length > 0)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (parts.length > 0) {
        return (parts.join('\n') + '\n\n' + cleaned).slice(0, MAX_TEXT_LENGTH);
    }
    return cleaned.slice(0, MAX_TEXT_LENGTH);
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
        const metaDescription = extractMeta($);
        const text = extractText($, metaDescription);

        if (text.length < 80) return null;
        return { url, title, metaDescription, text, crawledAt: new Date().toISOString() };
    } catch (err) {
        console.warn(`   ❌ ${url}: ${err.message}`);
        return null;
    }
}

// ─── Content Dedup ────────────────────────────────────────────────────────────

function deduplicatePages(pages) {
    const seen = new Map();
    const unique = [];
    for (const page of pages) {
        // Fingerprint from char 200-700 to skip past the "Summary: ..." prefix
        const fingerprint = page.text.slice(200, 700).replace(/\s+/g, ' ').trim();
        if (seen.has(fingerprint)) {
            console.log(`   🔁 Skipping duplicate: ${page.url} (same content as ${seen.get(fingerprint)})`);
            continue;
        }
        seen.set(fingerprint, page.url);
        unique.push(page);
    }
    return unique;
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

    // Deduplicate URLs (normalise trailing slashes and query params)
    targetUrls = [...new Set(targetUrls.map(u => u.replace(/\/$/, '')))];

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

    // Deduplicate by content
    const uniquePages = deduplicatePages(pages);
    if (uniquePages.length < pages.length) {
        console.log(`\n   🔁 Removed ${pages.length - uniquePages.length} duplicate pages`);
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniquePages, null, 2), 'utf-8');
    console.log(`\n✅ Crawl complete! ${uniquePages.length} pages saved to: ${OUTPUT_FILE}`);
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
