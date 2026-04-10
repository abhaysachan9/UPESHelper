# Incremental Indexing Guide

This guide explains how to index only newly added pages without re-indexing everything.

## 🎯 Use Cases

1. **Added new dynamic pages** - Index only the new pages
2. **Crawled additional URLs** - Index new content without touching existing
3. **Regular updates** - Add new pages incrementally
4. **Bandwidth saving** - Avoid re-uploading existing content

## 🚀 Quick Start

### Option 1: Index Only New Pages (Recommended)

```bash
# 1. Add new pages to config or crawl new URLs
# Edit scripts/dynamic-pages-config.js

# 2. Crawl the new pages
npm run crawl:dynamic

# 3. Index ONLY the new pages
npm run index:new
```

**Result:** Only pages not already in the vector DB are indexed.

### Option 2: Re-index a Single Page

```bash
# Re-crawl and re-index one specific page
npm run reindex -- https://www.upes.ac.in/your-page
```

**Result:** That specific page is re-crawled and re-indexed (old version deleted).

### Option 3: Full Re-index

```bash
# Re-index everything (use sparingly)
npm run index
```

**Result:** All pages are indexed (skips already-indexed chunks via progress tracking).

## 📊 How It Works

### Index New Pages (`npm run index:new`)

```
1. Read pages.json + pages-dynamic.json
2. Load index-progress.json (tracks indexed chunks)
3. Extract URLs from indexed chunks
4. Filter to only NEW pages (not in indexed URLs)
5. Index only those new pages
6. Update progress file
```

**Example:**
```bash
$ npm run index:new

📚  Indexing NEW pages only...
   Total pages available: 2278 (2277 static + 1 dynamic)
   Already indexed: 2277 pages (45540 chunks)
   🆕 New pages to index: 1
   
   Total new chunks to index: 20
   Upserting to Upstash...

✅  Indexing complete! 1 new pages (20 chunks) added.
   Total indexed: 2278 pages (45560 chunks)
```

### Re-index Single Page (`npm run reindex`)

```
1. Re-crawl the specific URL
2. Delete old vectors for that URL
3. Chunk new content
4. Upload new vectors
5. Update pages.json
```

**Example:**
```bash
$ npm run reindex -- https://www.upes.ac.in/about

🔄  Re-indexing single page: https://www.upes.ac.in/about

   📡 Scraping page...
   ✅ "About UPES" (5432 chars)
   📄 Found existing entry (12 old chunks)
   🗑️  Deleting 12 old vectors from Upstash...
   ✅ Old vectors deleted
   ☁️  Upserting 15 new vectors...
   ✅ New vectors indexed
   💾 pages.json updated

✅  Done! Page re-indexed
```

## 🔄 Common Workflows

### Workflow 1: Add One New Dynamic Page

```bash
# 1. Add URL to config
# Edit scripts/dynamic-pages-config.js
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/existing-page",
  "https://www.upes.ac.in/new-page",  # Add this
];

# 2. Crawl just the new page
npm run crawl:dynamic

# 3. Index only new pages
npm run index:new
```

**Time saved:** Indexes 1 page instead of 2278 pages!

### Workflow 2: Add Multiple New Pages

```bash
# 1. Add URLs to config
# Edit scripts/dynamic-pages-config.js

# 2. Crawl all dynamic pages
npm run crawl:dynamic

# 3. Index only new ones
npm run index:new
```

### Workflow 3: Update Existing Page Content

```bash
# Re-crawl and re-index specific page
npm run reindex -- https://www.upes.ac.in/updated-page
```

### Workflow 4: Regular Incremental Updates

```bash
# Daily/weekly update script
npm run crawl:all      # Crawl everything (includes new pages)
npm run index:new      # Index only new pages
```

### Workflow 5: Fresh Start

```bash
# Clear everything and start over
npm run clear          # Clear vector DB
rm crawled-data/*.json # Delete crawled data
npm run crawl:all      # Re-crawl
npm run index          # Re-index everything
```

## 📁 Progress Tracking

### index-progress.json

This file tracks which chunks are already indexed:

```json
[
  "https%3A%2F%2Fwww.upes.ac.in%2Fabout_chunk_0",
  "https%3A%2F%2Fwww.upes.ac.in%2Fabout_chunk_1",
  ...
]
```

**Location:** `crawled-data/index-progress.json`

**Purpose:** 
- Tracks indexed chunks
- Enables resume on failure
- Used by `index:new` to identify new pages

**When to delete:**
- After `npm run clear` (vector DB cleared)
- When starting fresh
- If you want to force re-index

## 🎯 Decision Tree

```
Need to index pages?
        │
        ▼
    New pages?
        │
    ┌───┴───┐
   YES     NO
    │       │
    ▼       ▼
index:new  Content
           changed?
            │
        ┌───┴───┐
       YES     NO
        │       │
        ▼       ▼
    reindex   Nothing
    (URL)     to do!
```

## 💡 Tips & Best Practices

### ✅ DO:

1. **Use `index:new` for incremental updates**
   - Faster
   - Saves bandwidth
   - Avoids duplicate work

2. **Use `reindex` for updated content**
   - Deletes old version
   - Uploads new version
   - Keeps DB clean

3. **Keep progress file**
   - Enables resume
   - Tracks what's indexed
   - Used by `index:new`

4. **Regular incremental updates**
   ```bash
   # Cron job or scheduled task
   npm run crawl:all && npm run index:new
   ```

### ❌ DON'T:

1. **Don't use `index` for small updates**
   - Processes all pages
   - Slower than `index:new`
   - Use only for full re-index

2. **Don't delete progress file unnecessarily**
   - Breaks incremental indexing
   - Forces full re-index
   - Only delete when clearing DB

3. **Don't forget to crawl first**
   - `index:new` only indexes what's in JSON files
   - Crawl new pages before indexing

## 📊 Performance Comparison

| Method      | Pages           | Time    | Use Case            |
| -------------| -----------------| ---------| ---------------------|
| `index`     | All (2278)      | ~30 min | Full re-index       |
| `index:new` | New only (1-10) | ~1 min  | Incremental updates |
| `reindex`   | Single (1)      | ~5 sec  | Update one page     |

**Recommendation:** Use `index:new` for regular updates.

## 🔍 Verification

### Check What's Indexed

```bash
npm run index:status
```

### Check Progress File

```bash
cat crawled-data/index-progress.json | wc -l
# Shows number of indexed chunks
```

### Count Indexed Pages

```bash
node -e "
const fs = require('fs');
const ids = JSON.parse(fs.readFileSync('crawled-data/index-progress.json'));
const urls = new Set();
ids.forEach(id => {
  const /www.upes.ac.in/updated-page
```

### Progress file out of sync

**Cause:** Vector DB cleared but progress file still exists.

**Solution:** Delete progress file:
```bash
rm crawled-data/index-progress.json
npm run index
```

### Want to force re-index

**Solution:** Delete progress file:
```bash
rm crawled-data/index-progress.json
npm run index
```

## 🔗 Related Commands

| Command                    | Purpose               |
| ----------------------------| -----------------------|
| `npm run crawl:dynamic`    | Crawl dynamic pages   |
| `npm run index:new`        | Index only new pages  |
| `npm run reindex -- <URL>` | Re-index one page     |
| `npm run index`            | Index all pages       |
| `npm run index:status`     | Check indexing status |
| `npm run clear`            | Clear vector DB       |

## 📚 Examples

### Example 1: Add 3 New Dynamic Pages

```bash
# 1. Edit config
cat >> scripts/dynamic-pages-config.js << 'EOF'
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/page1",
  "https://www.upes.ac.in/page2",
  "https://www.upes.ac.in/page3",
];
EOF

# 2. Crawl
npm run crawl:dynamic

# 3. Index only new
npm run indexnpm run index:new`  
**For updated pages:** Use `npm run reindex -- <URL>`  
**For full re-index:** Use `npm run index`

Incremental indexing saves time and bandwidth while keeping your vector DB up to date!

---

**See also:**
- [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md) - Setup guide
- [FAQ.md](FAQ.md) - Common questions
- [QUICK-REFERENCE.md](QUICK-REFERENCE.md) - Command reference
