# Dynamic Crawling FAQ

## General Questions

### Q: What's the difference between static and dynamic crawling?

**Static crawling** fetches HTML and parses it directly. It's fast but can't see content loaded by JavaScript.

**Dynamic crawling** uses a real browser (Chrome) to render JavaScript before extracting content. It's slower but captures everything.

### Q: Do I need to use dynamic crawling?

Only if you have pages where:
- Content loads after the page loads (via AJAX/fetch)
- The page is a Single-Page Application (React, Vue, Angular)
- Important content is hidden until JavaScript runs

Most traditional websites work fine with static crawling.

### Q: Can I use both crawlers?

Yes! That's the recommended approach. Use static for most pages and dynamic only for JavaScript-heavy pages.

### Q: Will this slow down my crawling?

Dynamic crawling is slower (~2-5 pages/min vs ~20 pages/min for static), but since you only use it for specific pages, the overall impact is minimal.

---

## Setup Questions

### Q: How do I install Puppeteer?

```bash
npm install
```

That's it! Puppeteer will download automatically.

### Q: The Puppeteer download is huge. Can I skip it?

Yes, use your system Chrome:

```bash
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

Then set the path:
```bash
export PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### Q: How do I test if Puppeteer is working?

```bash
npm run test:dynamic
```

If you see "✅ Test complete!", you're good to go.

### Q: Do I need to configure anything?

Just add your dynamic pages to `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/your-page",
];
```

---

## Usage Questions

### Q: How do I know if a page needs dynamic crawling?

Try static crawling first. If the content is missing or incomplete, use dynamic crawling.

Signs a page needs dynamic crawling:
- You see "Loading..." or spinners
- Content appears after a delay
- The URL contains `/app/`, `/portal/`, `/dashboard/`
- View source shows minimal HTML

### Q: Can I crawl pages that require login?

Yes, but you'll need to modify `scripts/crawlDynamic.js` to handle authentication:

```javascript
// Before navigating to pages
await page.goto('https://example.com/login');
await page.type('#username', 'your-username');
await page.type('#password', 'your-password');
await page.click('#login-button');
await page.waitForNavigation();
```

### Q: How do I crawl just one dynamic page for testing?

Edit `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/test-page",  // Just one page
];
```

Then run:
```bash
npm run crawl:dynamic
```

### Q: Can I see what the browser is doing?

Yes! Run with visible browser:

```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

---

## Configuration Questions

### Q: What are URL patterns and when should I use them?

Patterns automatically identify dynamic pages:

```javascript
export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,      // Matches any URL with /portal
  /\/dashboard/,   // Matches any URL with /dashboard
];
```

Use patterns when you have many similar URLs (e.g., all portal pages).

### Q: Can I exclude specific pages from dynamic crawling?

Yes, just don't add them to `DYNAMIC_PAGES` or make sure they don't match your patterns.

### Q: How do I crawl a subdomain?

Add the full URL:

```javascript
export const DYNAMIC_PAGES = [
  "https://portal.upes.ac.in/dashboard",
];
```

Or use a pattern:
```javascript
export const DYNAMIC_PAGE_PATTERNS = [
  /^https:\/\/portal\.upes\.ac\.in/,
];
```

---

## Troubleshooting Questions

### Q: The crawler times out on some pages. What do I do?

Increase the timeout in `scripts/crawlDynamic.js`:

```javascript
const PAGE_TIMEOUT = 60_000; // 60 seconds
```

### Q: Content is still missing after dynamic crawling. Why?

The page might need more time to load. Increase the wait time:

```javascript
const WAIT_FOR_CONTENT = 5000; // 5 seconds
```

Or wait for a specific element:
```javascript
await page.waitForSelector('.content-loaded');
```

### Q: I'm getting "Browser not found" errors.

Reinstall Puppeteer:

```bash
npm uninstall puppeteer
npm install puppeteer
```

### Q: The crawler is using too much memory.

Increase Node's memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:dynamic
```

### Q: Can I crawl multiple pages in parallel?

The dynamic crawler runs sequentially by default to avoid overwhelming servers. To enable parallel crawling, modify `scripts/crawlDynamic.js`:

```javascript
// Process in batches of 3
const CONCURRENCY = 3;
for (let i = 0; i < DYNAMIC_PAGES.length; i += CONCURRENCY) {
  const batch = DYNAMIC_PAGES.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(url => scrapeDynamicPage(browser, url)));
}
```

---

## Integration Questions

### Q: How does the indexer know about dynamic pages?

The indexer (`scripts/index.js`) automatically reads both `pages.json` and `pages-dynamic.json` and combines them.

### Q: Are dynamic pages marked differently in the database?

Yes, they have `dynamic: true` in their metadata:

```javascript
{
  url: "...",
  title: "...",
  dynamic: true,  // This flag
  crawledAt: "..."
}
```

### Q: Can I re-crawl just dynamic pages without re-crawling static pages?

Yes:

```bash
npm run crawl:dynamic  # Only crawls dynamic pages
npm run index          # Re-indexes everything
```

The indexer combines both files, so you don't lose static pages.

### Q: What happens if I run the static crawler after adding dynamic pages?

The static crawler will skip them automatically (via `isDynamicPage()` check).

---

## Performance Questions

### Q: How much slower is dynamic crawling?

Roughly 4-10x slower than static crawling:
- Static: ~20 pages/min
- Dynamic: ~2-5 pages/min

### Q: Can I speed up dynamic crawling?

Yes, several ways:

1. **Block unnecessary resources:**
```javascript
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
    req.abort();
  } else {
    req.continue();
  }
});
```

2. **Reduce wait time** (if content loads quickly):
```javascript
const WAIT_FOR_CONTENT = 1000; // 1 second
```

3. **Use faster network** (if possible)

### Q: How much disk space do I need?

- Puppeteer + Chromium: ~300MB
- Crawled data: Varies (typically 1-10MB per 100 pages)
- Node modules: ~200MB

Total: ~500MB minimum

---

## Best Practices Questions

### Q: Should I crawl all pages dynamically "just in case"?

No! Only use dynamic crawling for pages that actually need it. Static crawling is faster and uses fewer resources.

### Q: How often should I re-crawl?

Depends on how often content changes:
- Static content: Weekly or monthly
- Dynamic content: Daily or weekly
- News/updates: Daily

### Q: Should I commit crawled data to Git?

No, add `crawled-data/` to `.gitignore` (already done). Crawled data should be regenerated, not versioned.

### Q: Can I use this for other websites?

Yes! Just update the URLs in your config. Be respectful:
- Check `robots.txt`
- Add delays between requests
- Don't crawl too aggressively

---

## Advanced Questions

### Q: Can I customize what content is extracted?

Yes, edit the `extractPageContent()` function in `scripts/crawlDynamic.js`:

```javascript
async function extractPageContent(page) {
  return await page.evaluate(() => {
    // Your custom extraction logic here
    return {
      title: document.title,
      text: document.querySelector('.main-content').innerText,
    };
  });
}
```

### Q: Can I take screenshots of pages?

Yes, add to `scripts/crawlDynamic.js`:

```javascript
await page.screenshot({ 
  path: `screenshots/${encodeURIComponent(url)}.png`,
  fullPage: true 
});
```

### Q: Can I interact with the page (click buttons, fill forms)?

Yes:

```javascript
await page.click('#load-more-button');
await page.waitForTimeout(2000);
await page.type('#search-input', 'query');
await page.keyboard.press('Enter');
```

### Q: Can I extract structured data (JSON-LD, microdata)?

Yes:

```javascript
const structuredData = await page.evaluate(() => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  return Array.from(scripts).map(s => JSON.parse(s.textContent));
});
```

---

## Error Messages

### Q: "Error: Failed to launch the browser process"

**Solution:** Install Chrome or set `PUPPETEER_EXECUTABLE_PATH`

### Q: "TimeoutError: Navigation timeout of 30000 ms exceeded"

**Solution:** Increase `PAGE_TIMEOUT` or check your internet connection

### Q: "Error: Cannot find module 'puppeteer'"

**Solution:** Run `npm install puppeteer`

### Q: "Error: ENOENT: no such file or directory, open 'crawled-data/pages-dynamic.json'"

**Solution:** This is normal if you haven't run `npm run crawl:dynamic` yet. The indexer will skip it.

---

## Still Have Questions?

1. Check the documentation:
   - `SETUP-DYNAMIC-CRAWLING.md` - Setup guide
   - `scripts/CRAWLING.md` - Detailed crawling docs
   - `ARCHITECTURE.md` - System architecture
   - `MIGRATION-GUIDE.md` - Upgrade guide

2. Test your setup:
   ```bash
   npm run test:dynamic
   ```

3. Debug with visible browser:
   ```bash
   PUPPETEER_HEADLESS=false npm run crawl:dynamic
   ```

4. Check Puppeteer docs: https://pptr.dev/

5. Review the code - it's well-commented!
