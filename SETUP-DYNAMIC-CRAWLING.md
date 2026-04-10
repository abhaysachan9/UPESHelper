# Dynamic Crawling Setup Guide

This guide will help you set up and use the dynamic crawler for JavaScript-heavy pages.

## Prerequisites

Make sure you have Node.js installed (v18 or higher recommended).

## Installation

### 1. Install Puppeteer

```bash
npm install
```

This will install Puppeteer and download Chromium automatically.

### 2. Test Your Setup

Run the test script to verify Puppeteer is working:

```bash
npm run test:dynamic
```

Or test with a specific URL:

```bash
npm run test:dynamic https://www.upes.ac.in
```

If you see "✅ Test complete!", you're ready to go!

---

## Configuration

### 1. Identify Dynamic Pages

Dynamic pages are those that:
- Load content via JavaScript after page load
- Are built with React, Vue, Angular, or similar frameworks
- Show loading spinners or skeleton screens
- Have URLs like `/app/*`, `/portal/*`, `/dashboard/*`

### 2. Configure Dynamic Pages List

Edit `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/student-portal",
  "https://www.upes.ac.in/courses/search",
];
```

### 3. (Optional) Add URL Patterns

For automatic detection, add patterns:

```javascript
export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,      // Matches any URL with /portal
  /\/dashboard/,   // Matches any URL with /dashboard
  /^https:\/\/app\./, // Matches app.* subdomain
];
```

---

## Usage

### Crawl Dynamic Pages Only

```bash
npm run crawl:dynamic
```

Output: `crawled-data/pages-dynamic.json`

### Crawl Everything (Static + Dynamic)

```bash
npm run crawl:all
```

This runs:
1. Static crawler → `pages.json`
2. Dynamic crawler → `pages-dynamic.json`

### Index All Content

```bash
npm run index
```

This automatically combines both files and uploads to Upstash.

---

## Workflow Example

```bash
# 1. Test Puppeteer setup
npm run test:dynamic

# 2. Add dynamic pages to config
# Edit scripts/dynamic-pages-config.js

# 3. Run both crawlers
npm run crawl:all

# 4. Index everything
npm run index

# 5. Start the server
npm start
```

---

## Troubleshooting

### Puppeteer Installation Failed

**Problem:** Chrome download fails during `npm install`

**Solution 1:** Use system Chrome
```bash
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

**Solution 2:** Install Chrome manually
- Download Chrome from https://www.google.com/chrome/
- Set environment variable:
```bash
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

### "Browser Not Found" Error

**Problem:** Puppeteer can't find Chrome

**Solution:** Reinstall Puppeteer
```bash
npm uninstall puppeteer
npm install puppeteer
```

### Pages Timing Out

**Problem:** Dynamic pages take too long to load

**Solution:** Increase timeout in `scripts/crawlDynamic.js`:
```javascript
const PAGE_TIMEOUT = 60_000; // Increase to 60 seconds
```

### Memory Issues

**Problem:** Node runs out of memory

**Solution:** Increase memory limit
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:dynamic
```

### Content Not Rendering

**Problem:** Page loads but content is missing

**Solution 1:** Increase wait time in `scripts/crawlDynamic.js`:
```javascript
const WAIT_FOR_CONTENT = 5000; // Wait 5 seconds
```

**Solution 2:** Debug with visible browser
```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

This opens Chrome so you can see what's happening.

---

## Advanced Configuration

### Custom Wait Conditions

Edit `scripts/crawlDynamic.js` to wait for specific elements:

```javascript
// Wait for a specific element to appear
await page.waitForSelector('.content-loaded', { timeout: 10000 });

// Wait for network to be idle
await page.goto(url, { waitUntil: 'networkidle0' });

// Wait for a custom condition
await page.waitForFunction(() => {
  return document.querySelector('.data-loaded') !== null;
});
```

### Custom Viewport Size

Change viewport in `scripts/crawlDynamic.js`:

```javascript
await page.setViewport({ 
  width: 1920, 
  height: 1080,
  deviceScaleFactor: 1,
});
```

### Block Resources (Faster Crawling)

Block images, fonts, etc. to speed up crawling:

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

---

## Performance Tips

1. **Crawl static pages first** - They're much faster
2. **Limit dynamic pages** - Only add pages that truly need JavaScript
3. **Use patterns wisely** - Overly broad patterns may exclude too many static pages
4. **Run during off-peak hours** - Be respectful of server load
5. **Monitor memory usage** - Close browser between batches if needed

---

## Best Practices

✅ **DO:**
- Test individual pages before bulk crawling
- Use static crawler for most pages
- Add only JavaScript-dependent pages to dynamic list
- Monitor crawl progress with visible browser first
- Respect robots.txt and rate limits

❌ **DON'T:**
- Add all pages to dynamic crawler (it's slower)
- Run multiple dynamic crawlers simultaneously
- Crawl too aggressively (respect the server)
- Forget to test after configuration changes

---

## Need Help?

1. Check the test script output: `npm run test:dynamic`
2. Review logs in the console
3. Try with visible browser: `PUPPETEER_HEADLESS=false npm run crawl:dynamic`
4. Check [Puppeteer documentation](https://pptr.dev/)

---

## Summary

```bash
# Quick start
npm install
npm run test:dynamic
# Edit scripts/dynamic-pages-config.js
npm run crawl:all
npm run index
npm start
```

That's it! Your dynamic crawler is ready to handle JavaScript-heavy pages. 🚀
