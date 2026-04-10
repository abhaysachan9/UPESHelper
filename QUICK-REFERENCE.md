# Dynamic Crawling Quick Reference

## 🚀 Commands

```bash
# Setup
npm install                          # Install dependencies
npm run test:dynamic                 # Test Puppeteer

# Crawling
npm run crawl                        # Static pages only
npm run crawl:dynamic                # Dynamic pages only
npm run crawl:all                    # Both (recommended)

# Indexing
npm run index                        # Upload to Upstash
npm run index:status                 # Check status
npm run clear                        # Clear database

# Running
npm start                            # Start server
npm run dev                          # Dev mode with hot-reload

# Debugging
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

## 📁 Key Files

```
scripts/
├── crawl.js                    # Static crawler
├── crawlDynamic.js             # Dynamic crawler
├── dynamic-pages-config.js     # ⚙️ CONFIGURE HERE
├── testDynamic.js              # Test script
└── index.js                    # Indexer

crawled-data/
├── pages.json                  # Static output
└── pages-dynamic.json          # Dynamic output
```

## ⚙️ Configuration

Edit `scripts/dynamic-pages-config.js`:

```javascript
// Add exact URLs
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/portal",
  "https://www.upes.ac.in/dashboard",
];

// Or use patterns
export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,
  /\/dashboard/,
  /\/app\//,
];
```

## 🔍 Troubleshooting

| Problem | Solution |
|---------|----------|
| Test fails | `npm uninstall puppeteer && npm install puppeteer` |
| Timeout | Increase `PAGE_TIMEOUT` in `crawlDynamic.js` |
| Missing content | Increase `WAIT_FOR_CONTENT` in `crawlDynamic.js` |
| Memory error | `NODE_OPTIONS="--max-old-space-size=4096" npm run crawl:dynamic` |
| Can't see browser | `PUPPETEER_HEADLESS=false npm run crawl:dynamic` |

## 📊 Workflow

```
1. Configure → Edit dynamic-pages-config.js
2. Test      → npm run test:dynamic
3. Crawl     → npm run crawl:all
4. Index     → npm run index
5. Run       → npm start
```

## 📚 Documentation

| Doc | Purpose |
|-----|---------|
| [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md) | 5-min setup |
| [FAQ.md](FAQ.md) | Common questions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How it works |
| [CHECKLIST.md](CHECKLIST.md) | Verify setup |
| [DOCS-INDEX.md](DOCS-INDEX.md) | All docs |

## 🎯 Common Tasks

### Add a dynamic page
```javascript
// scripts/dynamic-pages-config.js
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/new-page",  // Add here
];
```

### Test one page
```bash
# Add just that page to config, then:
npm run crawl:dynamic
cat crawled-data/pages-dynamic.json
```

### Debug a page
```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
# Watch browser load the page
```

### Full refresh
```bash
rm -rf crawled-data/*.json
npm run crawl:all
npm run index
```

### Check what's indexed
```bash
npm run index:status
```

## 💡 Tips

- ✅ Use static crawler for most pages (faster)
- ✅ Only add pages that truly need JavaScript
- ✅ Test with one page before bulk crawling
- ✅ Watch console output for errors
- ✅ Re-crawl regularly (content changes)
- ❌ Don't add all pages to dynamic (slower)
- ❌ Don't skip testing (catch issues early)

## 🔗 Quick Links

- **Setup:** [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md)
- **Help:** [FAQ.md](FAQ.md)
- **Verify:** [CHECKLIST.md](CHECKLIST.md)
- **All Docs:** [DOCS-INDEX.md](DOCS-INDEX.md)

## 📞 Support

1. Check [FAQ.md](FAQ.md)
2. Run `npm run test:dynamic`
3. Check console logs
4. Debug with visible browser

---

**Print this page for quick reference!** 📄
