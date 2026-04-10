# Crawling Documentation

This project supports two types of web crawling:

## 1. Static Crawling (Default)

Uses `cheerio` to fetch and parse HTML pages. Fast and efficient for standard web pages.

```bash
npm run crawl
```

**Output:** `crawled-data/pages.json`

## 2. Dynamic Crawling (JavaScript-heavy pages)

Uses `puppeteer` to render JavaScript content before extracting text. Ideal for React/Vue/Angular apps or pages with dynamic content.

```bash
npm run crawl:dynamic
```

**Output:** `crawled-data/pages-dynamic.json`

## 3. Crawl Everything

Run both crawlers sequentially:

```bash
npm run crawl:all
```

---

## Configuration

### Adding Dynamic Pages

Edit `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/student-portal",
  "https://www.upes.ac.in/interactive-dashboard",
];
```

### Pattern-based Exclusion

You can also define URL patterns to automatically identify dynamic pages:

```javascript
export const DYNAMIC_PAGE_PATTERNS = [
  /\/dashboard/,
  /\/portal/,
  /\/app\//,
];
```

Pages matching these patterns will be:
- Excluded from static crawling
- Available for dynamic crawling

---

## How It Works

1. **Static Crawler** (`scripts/crawl.js`)
   - Fetches pages from sitemap or URL list
   - Filters out dynamic pages using `isDynamicPage()`
   - Saves to `pages.json`

2. **Dynamic Crawler** (`scripts/crawlDynamic.js`)
   - Launches headless Chrome via Puppeteer
   - Loads each page and waits for JavaScript to render
   - Extracts content after DOM is fully loaded
   - Saves to `pages-dynamic.json`

3. **Indexer** (`scripts/index.js`)
   - Reads both `pages.json` and `pages-dynamic.json`
   - Combines them and uploads to Upstash Vector DB
   - Marks dynamic pages with `dynamic: true` metadata

---

## Environment Variables

Add to `.env` if needed:

```bash
# Disable headless mode for debugging
PUPPETEER_HEADLESS=false
```

---

## Workflow

```bash
# 1. Configure dynamic pages
# Edit scripts/dynamic-pages-config.js

# 2. Run crawlers
npm run crawl:all

# 3. Index everything
npm run index

# 4. Check status
npm run index:status
```

---

## Troubleshooting

### Puppeteer Installation Issues

If Puppeteer fails to install:

```bash
# Install dependencies first
npm install

# If Chrome download fails, use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

### Memory Issues

For large crawls, increase Node memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:dynamic
```

### Debugging Dynamic Pages

Run with visible browser:

```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

---

## Best Practices

1. **Start with static crawling** - It's faster and uses fewer resources
2. **Only use dynamic crawling for pages that need it** - JavaScript rendering is slower
3. **Test dynamic pages individually** - Add one URL at a time to verify it works
4. **Monitor resource usage** - Puppeteer can be memory-intensive
5. **Use patterns wisely** - Broad patterns may exclude too many pages from static crawling
