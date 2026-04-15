# Dynamic Crawling Setup Checklist

Use this checklist to verify your dynamic crawling setup is complete and working.

## ✅ Installation

- [ ] Node.js installed (v18 or higher)
- [ ] Project dependencies installed: `npm install`
- [ ] Puppeteer installed successfully (check for ~300MB download)
- [ ] No installation errors in console

**Test command:**
```bash
npm list puppeteer
```
Should show: `puppeteer@23.0.0` or similar

---

## ✅ Files Created

- [ ] `scripts/crawlDynamic.js` exists
- [ ] `scripts/dynamic-pages-config.js` exists
- [ ] `scripts/testDynamic.js` exists
- [ ] `scripts/CRAWLING.md` exists (documentation)

**Test command:**
```bash
ls -la scripts/*.js | grep -E "(crawlDynamic|dynamic-pages-config|testDynamic)"
```

---

## ✅ Files Modified

- [ ] `package.json` includes Puppeteer dependency
- [ ] `package.json` includes new scripts (crawl:dynamic, crawl:all, test:dynamic)
- [ ] `scripts/crawl.js` imports `isDynamicPage`
- [ ] `scripts/crawl.js` filters out dynamic pages
- [ ] `scripts/index.js` reads both pages.json and pages-dynamic.json
- [ ] `scripts/index.js` includes `dynamic` flag in metadata

**Test command:**
```bash
grep -q "puppeteer" package.json && echo "✅ Puppeteer in package.json"
grep -q "crawl:dynamic" package.json && echo "✅ Scripts added"
grep -q "isDynamicPage" scripts/crawl.js && echo "✅ crawl.js updated"
grep -q "pages-dynamic.json" scripts/index.js && echo "✅ index.js updated"
```

---

## ✅ Configuration

- [ ] `scripts/dynamic-pages-config.js` has correct exports
- [ ] `DYNAMIC_PAGES` array is defined (can be empty)
- [ ] `DYNAMIC_PAGE_PATTERNS` array is defined (can be empty)
- [ ] `isDynamicPage()` function is exported

**Test command:**
```bash
node -e "import('./scripts/dynamic-pages-config.js').then(m => console.log('✅ Config valid'))"
```

---

## ✅ Puppeteer Test

- [ ] Test script runs without errors: `npm run test:dynamic`
- [ ] Browser launches successfully
- [ ] Test page loads
- [ ] Content is extracted
- [ ] Browser closes cleanly

**Test command:**
```bash
npm run test:dynamic
```

**Expected output:**
```
🧪 Testing Puppeteer setup...
🚀 Launching browser...
📄 Loading page...
✅ Page loaded successfully!
✅ Test complete! Puppeteer is working correctly.
```

---

## ✅ Static Crawler Integration

- [ ] Static crawler runs: `npm run crawl`
- [ ] No errors about missing imports
- [ ] Console shows "After dynamic page filter" line
- [ ] `pages.json` is created in `crawled-data/`

**Test command:**
```bash
npm run crawl 2>&1 | grep -q "dynamic page filter" && echo "✅ Filter working"
```

---

## ✅ Dynamic Crawler

- [ ] Dynamic pages configured in `dynamic-pages-config.js`
- [ ] Dynamic crawler runs: `npm run crawl:dynamic`
- [ ] Browser launches (or runs headless)
- [ ] Pages are scraped successfully
- [ ] `pages-dynamic.json` is created in `crawled-data/`
- [ ] JSON file contains valid data

**Test command:**
```bash
npm run crawl:dynamic
# Then check:
test -f crawled-data/pages-dynamic.json && echo "✅ Dynamic pages file created"
```

---

## ✅ Combined Crawling

- [ ] Combined crawler runs: `npm run crawl:all`
- [ ] Both `pages.json` and `pages-dynamic.json` are created
- [ ] No errors during execution
- [ ] Both files contain valid JSON

**Test command:**
```bash
npm run crawl:all
# Then check:
test -f crawled-data/pages.json && test -f crawled-data/pages-dynamic.json && echo "✅ Both files created"
```

---

## ✅ Indexing

- [ ] Indexer runs: `npm run index`
- [ ] Both static and dynamic pages are loaded
- [ ] Console shows total page count (static + dynamic)
- [ ] No errors during indexing
- [ ] Data uploaded to Upstash successfully

**Test command:**
```bash
npm run index 2>&1 | grep -q "Total pages to index" && echo "✅ Indexer combines both sources"
```

---

## ✅ Metadata

- [ ] Indexed chunks include `dynamic` flag
- [ ] Static pages have `dynamic: false`
- [ ] Dynamic pages have `dynamic: true`
- [ ] All other metadata fields present (url, title, chunkIndex, etc.)

**Verification:**
Check Upstash console or query the vector DB to verify metadata.

---

## ✅ Documentation

- [ ] `README.md` mentions dynamic crawling
- [ ] `scripts/CRAWLING.md` exists and is complete
- [ ] `SETUP-DYNAMIC-CRAWLING.md` exists
- [ ] `ARCHITECTURE.md` exists
- [ ] `FAQ.md` exists
- [ ] `MIGRATION-GUIDE.md` exists (if upgrading)

**Test command:**
```bash
ls -la *.md | grep -E "(SETUP|ARCHITECTURE|FAQ|MIGRATION)"
```

---

## ✅ Environment Variables (Optional)

- [ ] `.env` file exists
- [ ] `PUPPETEER_HEADLESS` set (if needed for debugging)
- [ ] Other required variables set (GEMINI_API_KEY, UPSTASH_*, etc.)

**Test command:**
```bash
test -f .env && echo "✅ .env file exists"
```

---

## ✅ Functionality Tests

### Test 1: Static Page Exclusion
- [ ] Add a URL to `DYNAMIC_PAGES`
- [ ] Run static crawler
- [ ] Verify URL is NOT in `pages.json`
- [ ] Verify console shows it was filtered out

### Test 2: Dynamic Page Inclusion
- [ ] Add a URL to `DYNAMIC_PAGES`
- [ ] Run dynamic crawler
- [ ] Verify URL IS in `pages-dynamic.json`
- [ ] Verify content is extracted correctly

### Test 3: Pattern Matching
- [ ] Add a pattern to `DYNAMIC_PAGE_PATTERNS`
- [ ] Run static crawler
- [ ] Verify matching URLs are excluded
- [ ] Run dynamic crawler with matching URL
- [ ] Verify it's included in `pages-dynamic.json`

### Test 4: Combined Indexing
- [ ] Have both `pages.json` and `pages-dynamic.json`
- [ ] Run indexer
- [ ] Verify both are processed
- [ ] Check Upstash for both types of pages

---

## ✅ Performance Checks

- [ ] Static crawler completes in reasonable time
- [ ] Dynamic crawler completes (slower is expected)
- [ ] No memory errors during crawling
- [ ] No timeout errors (or acceptable number)
- [ ] Indexing completes successfully

---

## ✅ Error Handling

- [ ] Invalid URLs are handled gracefully
- [ ] Timeout errors don't crash the crawler
- [ ] Missing files don't crash the indexer
- [ ] Network errors are caught and logged

---

## ✅ Cleanup

- [ ] `crawled-data/` is in `.gitignore`
- [ ] No sensitive data in config files
- [ ] No hardcoded credentials
- [ ] Documentation is up to date

---

## 🎯 Final Verification

Run this complete workflow:

```bash
# 1. Test Puppeteer
npm run test:dynamic

# 2. Configure dynamic pages
# Edit scripts/dynamic-pages-config.js

# 3. Crawl everything
npm run crawl:all

# 4. Verify files
ls -la crawled-data/

# 5. Index
npm run index

# 6. Start server
npm start

# 7. Test chatbot
# Visit http://localhost:3000 and ask a question
```

---

## ✅ Success Criteria

You've successfully set up dynamic crawling if:

1. ✅ All tests pass
2. ✅ Both crawlers run without errors
3. ✅ Files are created in `crawled-data/`
4. ✅ Indexer combines both sources
5. ✅ Chatbot can answer questions from both static and dynamic pages
6. ✅ No console errors during normal operation

---

## 🚨 Common Issues

If any checks fail, see:
- `FAQ.md` for troubleshooting
- `SETUP-DYNAMIC-CRAWLING.md` for detailed setup
- `MIGRATION-GUIDE.md` if upgrading existing project

---

## 📊 Checklist Summary

Count your checkmarks:

- **0-10 checked:** Just getting started
- **11-20 checked:** Making progress
- **21-30 checked:** Almost there
- **31-40 checked:** Nearly complete
- **41+ checked:** Fully set up! 🎉

---

## Next Steps

Once all checks pass:

1. Add your actual dynamic pages to the config
2. Run a full crawl: `npm run crawl:all`
3. Index everything: `npm run index`
4. Test your chatbot thoroughly
5. Set up automated re-crawling (cron job, etc.)
6. Monitor performance and adjust as needed

**Congratulations! Your dynamic crawling setup is complete.** 🚀
