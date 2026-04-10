# Dynamic Crawling - Quick Reference

## What Was Added

✅ Puppeteer-based dynamic crawler for JavaScript-heavy pages
✅ Automatic exclusion of dynamic pages from static crawler
✅ Configuration file for managing dynamic pages
✅ Combined indexing of static and dynamic content
✅ Test script to verify Puppeteer setup
✅ Comprehensive documentation

## New Files

```
scripts/
├── crawlDynamic.js              # Puppeteer-based crawler
├── dynamic-pages-config.js      # List of dynamic pages
├── dynamic-pages-config.example.js  # Example configuration
├── testDynamic.js               # Test Puppeteer setup
├── CRAWLING.md                  # Detailed crawling docs
SETUP-DYNAMIC-CRAWLING.md        # Setup guide
```

## Modified Files

- `package.json` - Added Puppeteer dependency and new scripts
- `scripts/crawl.js` - Now excludes dynamic pages
- `scripts/index.js` - Combines static and dynamic pages
- `README.md` - Updated with dynamic crawling info

## New NPM Scripts

```bash
npm run crawl:dynamic    # Crawl JavaScript-heavy pages
npm run crawl:all        # Crawl static + dynamic
npm run test:dynamic     # Test Puppeteer setup
```

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Test Puppeteer:**
   ```bash
   npm run test:dynamic
   ```

3. **Configure dynamic pages:**
   Edit `scripts/dynamic-pages-config.js`:
   ```javascript
   export const DYNAMIC_PAGES = [
     "https://www.upes.ac.in/your-dynamic-page",
   ];
   ```

4. **Run crawlers:**
   ```bash
   npm run crawl:all
   ```

5. **Index content:**
   ```bash
   npm run index
   ```

## How It Works

### Static Crawler (crawl.js)
- Fetches HTML with `fetch()`
- Parses with Cheerio
- Fast and efficient
- **Now excludes pages in `DYNAMIC_PAGES`**

### Dynamic Crawler (crawlDynamic.js)
- Launches headless Chrome
- Waits for JavaScript to render
- Extracts content from DOM
- Saves to `pages-dynamic.json`

### Indexer (index.js)
- Reads both `pages.json` and `pages-dynamic.json`
- Combines them
- Uploads to Upstash with `dynamic: true` flag

## Configuration Options

### Environment Variables

```bash
# .env
PUPPETEER_HEADLESS=false  # Show browser (for debugging)
```

### Dynamic Pages Config

```javascript
// scripts/dynamic-pages-config.js

// Exact URLs
export const DYNAMIC_PAGES = [
  "https://example.com/page1",
  "https://example.com/page2",
];

// URL patterns (regex)
export const DYNAMIC_PAGE_PATTERNS = [
  /\/dashboard/,
  /\/portal/,
  /\/app\//,
];
```

## Output Files

```
crawled-data/
├── pages.json           # Static pages
├── pages-dynamic.json   # Dynamic pages
└── index-progress.json  # Indexing progress
```

## Common Use Cases

### 1. Single-Page Applications (SPAs)
Pages built with React, Vue, Angular that load content via JavaScript.

### 2. Infinite Scroll Pages
Pages that load more content as you scroll.

### 3. Dynamic Dashboards
Interactive dashboards with charts and data visualizations.

### 4. Search Results
Pages where results are loaded dynamically.

### 5. User Portals
Login-protected areas (configure authentication in crawlDynamic.js).

## Debugging

### See what's happening:
```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

### Test a single URL:
```bash
npm run test:dynamic https://www.upes.ac.in/your-page
```

### Check logs:
The crawler prints detailed progress to console.

## Performance

| Crawler | Speed | Use Case |
|---------|-------|----------|
| Static | Fast (20 pages/min) | Standard HTML pages |
| Dynamic | Slow (2-5 pages/min) | JavaScript-heavy pages |

**Recommendation:** Use static crawler for most pages, dynamic only when needed.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Puppeteer install fails | `export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` |
| Page timeout | Increase `PAGE_TIMEOUT` in crawlDynamic.js |
| Memory issues | `NODE_OPTIONS="--max-old-space-size=4096"` |
| Content not rendering | Increase `WAIT_FOR_CONTENT` delay |

## Documentation

- **Setup Guide:** `SETUP-DYNAMIC-CRAWLING.md`
- **Crawling Details:** `scripts/CRAWLING.md`
- **Main README:** `README.md`

## Next Steps

1. ✅ Install and test Puppeteer
2. ✅ Identify which pages need dynamic crawling
3. ✅ Add them to `dynamic-pages-config.js`
4. ✅ Run `npm run crawl:all`
5. ✅ Index with `npm run index`
6. ✅ Test your chatbot!

---

**Need help?** Check `SETUP-DYNAMIC-CRAWLING.md` for detailed troubleshooting.
