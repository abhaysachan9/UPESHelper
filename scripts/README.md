# Scripts Directory

This directory contains all crawling, indexing, and utility scripts for the UPES Helper project.

## 📁 File Overview

### Crawling Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `crawl.js` | Static HTML crawler using Cheerio | `npm run crawl` |
| `crawlDynamic.js` | Dynamic crawler using Puppeteer | `npm run crawl:dynamic` |
| `dynamic-pages-config.js` | Configuration for dynamic pages | Edit to add pages |
| `dynamic-pages-config.example.js` | Example configuration | Reference |
| `testDynamic.js` | Test Puppeteer setup | `npm run test:dynamic` |

### Indexing Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `index.js` | Upload crawled data to Upstash | `npm run index` |
| `indexStatus.js` | Check indexing status | `npm run index:status` |
| `reindexPage.js` | Re-index specific page | `npm run reindex` |
| `clearIndex.js` | Clear all indexed data | `npm run clear` |

### Utility Scripts

| File | Purpose | Usage |
|------|---------|-------|
| `chunker.js` | Text chunking utilities | Used by index.js |
| `testCall.js` | Test API calls | `node scripts/testCall.js` |
| `testGeneration.js` | Test text generation | `node scripts/testGeneration.js` |
| `listModels.js` | List available models | `node scripts/listModels.js` |

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install dependencies
npm install

# 2. Test Puppeteer
npm run test:dynamic

# 3. Configure dynamic pages
# Edit scripts/dynamic-pages-config.js

# 4. Crawl everything
npm run crawl:all

# 5. Index content
npm run index
```

### Regular Usage

```bash
# Crawl and index
npm run crawl:all && npm run index

# Check status
npm run index:status
```

## 📝 Script Details

### crawl.js (Static Crawler)

**What it does:**
- Fetches pages from sitemap or URL list
- Parses HTML with Cheerio
- Extracts text content
- Filters out dynamic pages
- Saves to `crawled-data/pages.json`

**Configuration:**
```bash
# .env
CRAWL_MODE=sitemap          # or urllist
SITEMAP_URL=https://...
MAX_PAGES=100
CONCURRENCY=20
```

**Output:**
```json
[
  {
    "url": "https://...",
    "title": "Page Title",
    "metaDescription": "...",
    "text": "Page content...",
    "crawledAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### crawlDynamic.js (Dynamic Crawler)

**What it does:**
- Launches headless Chrome
- Renders JavaScript content
- Waits for dynamic content to load
- Extracts text from rendered DOM
- Saves to `crawled-data/pages-dynamic.json`

**Configuration:**
```javascript
// scripts/dynamic-pages-config.js
export const DYNAMIC_PAGES = [
  "https://example.com/page",
];
```

**Environment:**
```bash
PUPPETEER_HEADLESS=false  # Show browser
```

**Output:**
```json
[
  {
    "url": "https://...",
    "title": "Page Title",
    "metaDescription": "...",
    "text": "Page content...",
    "crawledAt": "2024-01-01T00:00:00.000Z",
    "dynamic": true
  }
]
```

### index.js (Indexer)

**What it does:**
- Reads `pages.json` and `pages-dynamic.json`
- Combines both sources
- Chunks text content
- Generates embeddings (via Upstash)
- Uploads to Vector DB
- Supports resume on failure

**Usage:**
```bash
npm run index
```

**Progress tracking:**
- Saves progress to `crawled-data/index-progress.json`
- Can resume if interrupted
- Automatically cleans up on completion

### dynamic-pages-config.js (Configuration)

**Purpose:** Define which pages need dynamic crawling

**Structure:**
```javascript
// Exact URLs
export const DYNAMIC_PAGES = [
  "https://example.com/page1",
  "https://example.com/page2",
];

// URL patterns (regex)
export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,
  /\/dashboard/,
];

// Helper function (don't modify)
export function isDynamicPage(url) {
  // Checks if URL matches DYNAMIC_PAGES or patterns
}
```

**When to add pages:**
- Single-page applications (React, Vue, Angular)
- Pages with AJAX-loaded content
- Interactive dashboards
- Pages that show loading spinners

### testDynamic.js (Test Script)

**Purpose:** Verify Puppeteer installation

**Usage:**
```bash
# Test default URL
npm run test:dynamic

# Test specific URL
npm run test:dynamic https://example.com
```

**What it checks:**
- Puppeteer installation
- Browser launch
- Page loading
- Content extraction
- Browser cleanup

## 🔧 Common Tasks

### Add a New Dynamic Page

1. Edit `scripts/dynamic-pages-config.js`:
```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/new-page",
];
```

2. Test it:
```bash
npm run crawl:dynamic
```

3. Check output:
```bash
cat crawled-data/pages-dynamic.json
```

4. Index it:
```bash
npm run index
```

### Debug a Problem Page

1. Run with visible browser:
```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

2. Watch the browser load the page

3. Adjust timeouts if needed in `crawlDynamic.js`

### Re-crawl Everything

```bash
# Remove old data
rm -rf crawled-data/*.json

# Crawl fresh
npm run crawl:all

# Re-index
npm run index
```

### Check What's Indexed

```bash
npm run index:status
```

### Clear and Start Over

```bash
# Clear vector DB
npm run clear

# Re-crawl
npm run crawl:all

# Re-index
npm run index
```

## 📊 Data Flow

```
┌─────────────────┐         ┌─────────────────┐
│   crawl.js      │         │ crawlDynamic.js │
│   (Static)      │         │   (Dynamic)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  pages.json     │         │pages-dynamic.json│
└────────┬────────┘         └────────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
            ┌────────────────┐
            │   index.js     │
            │   (Indexer)    │
            └────────┬───────┘
                     │
                     ▼
            ┌────────────────┐
            │ Upstash Vector │
            │      DB        │
            └────────────────┘
```

## 🐛 Troubleshooting

### Script Fails to Run

**Check:**
```bash
# Node version
node --version  # Should be v18+

# Dependencies installed
npm list puppeteer

# File exists
ls -la scripts/crawl.js
```

### Import Errors

**Fix:**
```bash
# Ensure package.json has "type": "module"
grep '"type": "module"' package.json
```

### Puppeteer Issues

**Fix:**
```bash
# Reinstall
npm uninstall puppeteer
npm install puppeteer

# Or use system Chrome
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

### Permission Errors

**Fix:**
```bash
# Make scripts executable
chmod +x scripts/*.js

# Or run with node explicitly
node scripts/crawl.js
```

## 📚 Documentation

- **Detailed crawling docs:** [CRAWLING.md](CRAWLING.md)
- **Setup guide:** [../docs/SETUP-DYNAMIC-CRAWLING.md](../docs/SETUP-DYNAMIC-CRAWLING.md)
- **FAQ:** [../docs/FAQ.md](../docs/FAQ.md)
- **Architecture:** [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

## 🎯 Best Practices

1. **Test before bulk crawling** - Use `test:dynamic` first
2. **Start with static** - Only use dynamic when needed
3. **Monitor progress** - Watch console output
4. **Handle errors gracefully** - Scripts continue on individual failures
5. **Re-crawl regularly** - Content changes over time
6. **Respect servers** - Don't crawl too aggressively
7. **Version control config** - Commit `dynamic-pages-config.js`
8. **Don't commit data** - Keep `crawled-data/` in `.gitignore`

## 🔗 Related Files

```
project/
├── scripts/              ← You are here
│   ├── crawl.js
│   ├── crawlDynamic.js
│   └── ...
├── crawled-data/        ← Output directory
│   ├── pages.json
│   └── pages-dynamic.json
├── server/
│   └── services/
│       └── vectorDb.js  ← Uses indexed data
└── .env                 ← Configuration
```

## 💡 Tips

- Use `npm run crawl:all` for convenience
- Check `crawled-data/` to verify output
- Run `index:status` to see what's indexed
- Use visible browser mode for debugging
- Increase timeouts for slow pages
- Use patterns for multiple similar URLs
- Test with one page before bulk crawling

---

**Need help?** Check [../docs/DOCS-INDEX.md](../docs/DOCS-INDEX.md) for complete documentation.
