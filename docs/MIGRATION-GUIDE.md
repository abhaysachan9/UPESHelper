# Migration Guide - Adding Dynamic Crawling

If you already have the UPES Helper project running, follow these steps to add dynamic crawling capability.

## Step 1: Update Dependencies

```bash
npm install puppeteer@^23.0.0
```

This will download Puppeteer and Chromium (~300MB).

## Step 2: Update package.json Scripts

Your `package.json` scripts section should now include:

```json
"scripts": {
  "crawl": "node scripts/crawl.js",
  "crawl:dynamic": "node scripts/crawlDynamic.js",
  "crawl:all": "npm run crawl && npm run crawl:dynamic",
  "test:dynamic": "node scripts/testDynamic.js",
  "index": "node scripts/index.js",
  ...
}
```

## Step 3: Add New Files

Create these new files in your project:

1. **scripts/dynamic-pages-config.js** - Configuration for dynamic pages
2. **scripts/crawlDynamic.js** - Puppeteer-based crawler
3. **scripts/testDynamic.js** - Test script

(Copy content from the repository or use the files provided)

## Step 4: Update Existing Files

### scripts/crawl.js

Add import at the top:
```javascript
import { isDynamicPage } from "./dynamic-pages-config.js";
```

Add filter in the sitemap section (after `afterRouteFilter`):
```javascript
const afterDynamicFilter = afterRouteFilter.filter((u) => !isDynamicPage(u));
console.log(`   After dynamic page filter: ${afterDynamicFilter.length}`);

targetUrls = afterDynamicFilter.slice(0, MAX_PAGES);
```

### scripts/index.js

Add constant:
```javascript
const DYNAMIC_INPUT_FILE = path.join(rootDir, 'crawled-data', 'pages-dynamic.json');
```

Update the `index()` function to load and combine both files:
```javascript
const pages = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

// Load dynamic pages if they exist
let dynamicPages = [];
if (fs.existsSync(DYNAMIC_INPUT_FILE)) {
    dynamicPages = JSON.parse(fs.readFileSync(DYNAMIC_INPUT_FILE, 'utf-8'));
}

// Combine static and dynamic pages
const allPages = [...pages, ...dynamicPages];
```

Update metadata to include dynamic flag:
```javascript
metadata: {
    url: page.url,
    title: page.title,
    chunkIndex: i,
    totalChunks: textChunks.length,
    crawledAt: page.crawledAt,
    dynamic: page.dynamic || false,  // Add this line
},
```

## Step 5: Test Your Setup

```bash
# Test Puppeteer installation
npm run test:dynamic

# If successful, you should see:
# ✅ Test complete! Puppeteer is working correctly.
```

## Step 6: Configure Dynamic Pages

Edit `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  // Add your JavaScript-heavy pages here
  "https://www.upes.ac.in/your-dynamic-page",
];
```

## Step 7: Run Crawlers

```bash
# Crawl static pages (existing behavior)
npm run crawl

# Crawl dynamic pages (new)
npm run crawl:dynamic

# Or crawl everything at once
npm run crawl:all
```

## Step 8: Index Content

```bash
npm run index
```

The indexer will automatically combine both static and dynamic pages.

## Verification Checklist

- [ ] Puppeteer installed successfully
- [ ] Test script passes: `npm run test:dynamic`
- [ ] New scripts added to package.json
- [ ] dynamic-pages-config.js created
- [ ] crawlDynamic.js created
- [ ] crawl.js updated with isDynamicPage filter
- [ ] index.js updated to handle both file types
- [ ] Test crawl works: `npm run crawl:all`
- [ ] Indexing works: `npm run index`

## Rollback (If Needed)

If you encounter issues and want to revert:

```bash
# Uninstall Puppeteer
npm uninstall puppeteer

# Remove new files
rm scripts/crawlDynamic.js
rm scripts/dynamic-pages-config.js
rm scripts/testDynamic.js

# Revert changes to crawl.js and index.js
git checkout scripts/crawl.js scripts/index.js

# Or manually remove the added lines
```

## Backward Compatibility

✅ **Existing functionality is preserved:**
- Static crawler works exactly as before
- If no dynamic pages are configured, nothing changes
- Existing `pages.json` format is unchanged
- Indexer works with or without `pages-dynamic.json`

## Common Issues

### Puppeteer Installation Fails

```bash
# Use system Chrome instead
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

### Import Error in crawl.js

Make sure `dynamic-pages-config.js` exists and exports the required function:
```javascript
export function isDynamicPage(url) { ... }
```

### Dynamic Pages Not Being Excluded

Check that:
1. URLs in `DYNAMIC_PAGES` match exactly (including trailing slashes)
2. Patterns in `DYNAMIC_PAGE_PATTERNS` are valid regex
3. Import statement is correct in `crawl.js`

## Need Help?

- Check `SETUP-DYNAMIC-CRAWLING.md` for detailed setup
- Review `scripts/CRAWLING.md` for crawling documentation
- See `DYNAMIC-CRAWLING-SUMMARY.md` for quick reference

## Summary

```bash
# Quick migration
npm install puppeteer
# Add new files (crawlDynamic.js, dynamic-pages-config.js, testDynamic.js)
# Update crawl.js and index.js
npm run test:dynamic
npm run crawl:all
npm run index
```

You're all set! 🚀
