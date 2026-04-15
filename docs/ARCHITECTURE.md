# Crawling Architecture

## Overview

The project now supports two parallel crawling pipelines that merge at the indexing stage.

```
┌─────────────────────────────────────────────────────────────┐
│                     CRAWLING PHASE                          │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐
│   Static Crawler     │         │  Dynamic Crawler     │
│   (crawl.js)         │         │  (crawlDynamic.js)   │
│                      │         │                      │
│  • Fetch HTML        │         │  • Launch Chrome     │
│  • Parse with        │         │  • Wait for JS       │
│    Cheerio           │         │  • Extract DOM       │
│  • Fast & efficient  │         │  • Slower but        │
│                      │         │    complete          │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           │ Excludes dynamic pages         │
           │ via isDynamicPage()            │
           │                                │
           ▼                                ▼
┌──────────────────────┐         ┌──────────────────────┐
│   pages.json         │         │ pages-dynamic.json   │
│                      │         │                      │
│  [                   │         │  [                   │
│    {                 │         │    {                 │
│      url: "...",     │         │      url: "...",     │
│      title: "...",   │         │      title: "...",   │
│      text: "...",    │         │      text: "...",    │
│      crawledAt: ...  │         │      crawledAt: ..., │
│    }                 │         │      dynamic: true   │
│  ]                   │         │    }                 │
│                      │         │  ]                   │
└──────────┬───────────┘         └──────────┬───────────┘
           │                                │
           └────────────┬───────────────────┘
                        │
                        │ Combined by index.js
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     INDEXING PHASE                          │
│                     (index.js)                              │
│                                                             │
│  1. Load pages.json + pages-dynamic.json                    │
│  2. Combine into single array                               │
│  3. Chunk text content                                      │
│  4. Generate embeddings (via Upstash)                       │
│  5. Upsert to Vector DB                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  UPSTASH VECTOR DB                          │
│                                                             │
│  Chunks with metadata:                                      │
│  • url                                                      │
│  • title                                                    │
│  • chunkIndex                                               │
│  • crawledAt                                                │
│  • dynamic (true/false)                                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Queried at runtime
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CHAT INTERFACE                           │
│                                                             │
│  User Question → Vector Search → Gemini → Answer            │
└─────────────────────────────────────────────────────────────┘
```

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│          dynamic-pages-config.js                            │
│                                                             │
│  export const DYNAMIC_PAGES = [                             │
│    "https://example.com/spa-page",                          │
│  ];                                                         │
│                                                             │
│  export const DYNAMIC_PAGE_PATTERNS = [                     │
│    /\/dashboard/,                                           │
│  ];                                                         │
│                                                             │
│  export function isDynamicPage(url) { ... }                 │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Imported by
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  crawl.js    │  │crawlDynamic  │  │  Your code   │
│              │  │    .js       │  │              │
│ Excludes     │  │ Includes     │  │ Check if URL │
│ dynamic      │  │ only         │  │ is dynamic   │
│ pages        │  │ dynamic      │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Data Flow Example

### Static Page (e.g., About Us)

```
1. Sitemap lists: https://www.upes.ac.in/about
2. isDynamicPage() returns false
3. crawl.js fetches and parses
4. Saved to pages.json
5. Indexed to Upstash
6. Available for RAG queries
```

### Dynamic Page (e.g., Student Portal)

```
1. Added to DYNAMIC_PAGES config
2. isDynamicPage() returns true
3. crawl.js skips this URL
4. crawlDynamic.js processes with Puppeteer
5. Saved to pages-dynamic.json with dynamic: true
6. Indexed to Upstash
7. Available for RAG queries
```

## File Dependencies

```
scripts/
├── dynamic-pages-config.js
│   └── Exports: DYNAMIC_PAGES, DYNAMIC_PAGE_PATTERNS, isDynamicPage()
│
├── crawl.js
│   ├── Imports: isDynamicPage from dynamic-pages-config.js
│   └── Outputs: crawled-data/pages.json
│
├── crawlDynamic.js
│   ├── Imports: DYNAMIC_PAGES from dynamic-pages-config.js
│   └── Outputs: crawled-data/pages-dynamic.json
│
├── index.js
│   ├── Reads: pages.json + pages-dynamic.json
│   └── Outputs: Data to Upstash Vector DB
│
└── testDynamic.js
    └── Tests: Puppeteer setup
```

## Execution Order

### Option 1: Sequential (Recommended)

```bash
npm run crawl          # Static pages first
npm run crawl:dynamic  # Then dynamic pages
npm run index          # Finally index everything
```

### Option 2: Combined

```bash
npm run crawl:all      # Runs both crawlers
npm run index          # Index everything
```

### Option 3: Selective

```bash
npm run crawl          # Only static pages
npm run index          # Index static only

# Later, add dynamic pages
npm run crawl:dynamic  # Crawl dynamic pages
npm run index          # Re-index (combines both)
```

## Performance Comparison

| Aspect | Static Crawler | Dynamic Crawler |
|--------|---------------|-----------------|
| Speed | ~20 pages/min | ~2-5 pages/min |
| Memory | Low (~50MB) | High (~500MB) |
| CPU | Low | Medium-High |
| Accuracy | Good for static HTML | Perfect for JS content |
| Use Case | Most pages | SPAs, dynamic content |

## Decision Tree

```
                    Need to crawl a page?
                            │
                            ▼
                    Does it use JavaScript
                    to load main content?
                            │
                ┌───────────┴───────────┐
                │                       │
               NO                      YES
                │                       │
                ▼                       ▼
        Use Static Crawler      Use Dynamic Crawler
        (crawl.js)              (crawlDynamic.js)
                │                       │
                ▼                       ▼
        Fast, efficient         Slower, complete
        Good for most pages     For SPAs, portals
```

## Troubleshooting Flow

```
                    Problem?
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
    Content         Crawler         Performance
    missing         fails           issues
        │               │               │
        ▼               ▼               ▼
    Try dynamic     Check           Use static
    crawler         Puppeteer       for more pages
                    setup
```

## Summary

- **Two crawlers, one database**: Both pipelines feed into the same vector DB
- **Automatic exclusion**: Static crawler skips dynamic pages
- **Flexible configuration**: Add pages via exact URLs or patterns
- **Unified indexing**: Single command indexes both types
- **Metadata tracking**: `dynamic` flag identifies source

This architecture ensures you get the best of both worlds: speed for static content and accuracy for dynamic content.
