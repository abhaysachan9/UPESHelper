# How to Index Just One Page

Quick guide for indexing a single page without touching the rest.

## 🎯 Three Methods

### Method 1: Index Single New Page (Recommended)

**Use when:** Adding a brand new page that's not indexed yet.

```bash
# 1. Add page to config
# Edit scripts/dynamic-pages-config.js
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/your-new-page",
];

# 2. Crawl just that page
npm run crawl:dynamic

# 3. Index just that page
npm run index:single -- https://www.upes.ac.in/your-new-page
```

**Result:** Only that one page is indexed (2-20 chunks typically).

---

### Method 2: Re-index Existing Page

**Use when:** Page content has changed and you want to update it.

```bash
npm run reindex -- https://www.upes.ac.in/existing-page
```

**What it does:**
1. Re-crawls the page
2. Deletes old vectors
3. Uploads new vectors
4. Updates pages.json

**Note:** Uses more write operations (delete + insert).

---

### Method 3: Manual Crawl + Index

**Use when:** You want full control.

```bash
# 1. Crawl just that page
npm run crawl:dynamic

# 2. Index just that page
npm run index:single -- https://www.upes.ac.in/your-page
```

---

## 📊 Comparison

| Method | Write Ops | Use Case |
|--------|-----------|----------|
| `index:single` | ~2-20 | New page |
| `reindex` | ~4-40 | Update existing |
| `index:new` | Varies | Multiple new pages |
| `index` | All | Full re-index |

---

## 🚀 Step-by-Step Example

### Scenario: Add One New Dynamic Page

```bash
# Step 1: Edit config
nano scripts/dynamic-pages-config.js

# Add your page:
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/admissions/fee-structure",
  "https://www.upes.ac.in/new-page",  # ← Add this
];

# Step 2: Crawl just the new page
npm run crawl:dynamic

# Step 3: Check it was crawled
cat crawled-data/pages-dynamic.json | grep "new-page"

# Step 4: Index just that page
npm run index:single -- https://www.upes.ac.in/new-page

# Done! ✅
```

---

## 💡 Tips

### Check if Page is Already Indexed

```bash
npm run index:single -- https://www.upes.ac.in/your-page
```

If already indexed, it will tell you:
```
ℹ️  This page is already indexed.
```

### Count Chunks Before Indexing

```bash
node -e "
const fs = require('fs');
const pages = JSON.parse(fs.readFileSync('crawled-data/pages-dynamic.json'));
const page = pages.find(p => p.url === 'https://www.upes.ac.in/your-page');
if (page) {
  const chunks = Math.ceil(page.text.length / 1000);
  console.log('Estimated chunks:', chunks);
}
"
```

### Verify After Indexing

```bash
npm run index:status
```

---

## 🐛 Troubleshooting

### "Page not found in crawled data"

**Solution:** Crawl the page first:
```bash
npm run crawl:dynamic
```

### "Already indexed"

**Solution:** 
- If content unchanged: Nothing to do!
- If content changed: Use `reindex` instead:
  ```bash
  npm run reindex -- https://www.upes.ac.in/your-page
  ```

### "Exceeded daily write limit"

**Solution:** Wait until tomorrow, or:
1. Upgrade Upstash plan
2. Use a different index for testing
3. Index fewer pages per day

---

## 📝 Quick Reference

```bash
# Index one new page
npm run index:single -- <URL>

# Re-index existing page
npm run reindex -- <URL>

# Index all new pages
npm run index:new

# Check status
npm run index:status
```

---

## 🎯 When to Use Each Command

```
New page?
    │
    ▼
   YES ──→ index:single
    │
    NO
    │
    ▼
Content changed?
    │
    ▼
   YES ──→ reindex
    │
    NO
    │
    ▼
Nothing to do!
```

---

## 💾 Write Operations

Understanding write operations helps manage your Upstash limits:

### index:single (New Page)
- **Writes:** 1 per chunk (typically 2-20)
- **Example:** 10 chunks = 10 writes

### reindex (Update Page)
- **Writes:** 1 delete + 1 insert per chunk
- **Example:** 10 chunks = 20 writes

### index:new (Multiple Pages)
- **Writes:** Sum of all new page chunks
- **Example:** 5 pages × 10 chunks = 50 writes

### index (Full Re-index)
- **Writes:** All chunks (can be 10,000+)
- **Use sparingly!**

---

## 🔗 Related Docs

- [INCREMENTAL-INDEXING.md](INCREMENTAL-INDEXING.md) - Full incremental guide
- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Command cheat sheet
- [FAQ.md](FAQ.md) - Common questions

---

## ✅ Summary

**To index just one new page:**

```bash
# 1. Add to config
# 2. Crawl
npm run crawl:dynamic

# 3. Index
npm run index:single -- https://www.upes.ac.in/your-page
```

**That's it!** Only that one page is indexed. 🎉
