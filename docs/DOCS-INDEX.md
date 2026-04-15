# Documentation Index

Complete guide to dynamic crawling documentation. Start here to find what you need.

## 🚀 Getting Started

**New to dynamic crawling?** Start here:

1. **[GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md)** ⭐ START HERE
   - 5-minute quick start guide
   - Step-by-step setup
   - Common workflows
   - Quick reference card

2. **[SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md)**
   - Comprehensive setup guide
   - Installation instructions
   - Configuration details
   - Troubleshooting

3. **[CHECKLIST.md](CHECKLIST.md)**
   - Verify your setup
   - Step-by-step validation
   - Success criteria
   - Testing procedures

## 📚 Core Documentation

### Understanding the System

- **[ARCHITECTURE.md](ARCHITECTURE.md)**
  - System architecture diagrams
  - Data flow visualization
  - Component relationships
  - Decision trees

- **[README.md](../README.md)**
  - Project overview
  - Main features
  - API endpoints
  - Quick start for the entire project

### Detailed Guides

- **[scripts/CRAWLING.md](../scripts/CRAWLING.md)**
  - Crawling modes explained
  - Configuration options
  - Performance comparison
  - Best practices

- **[FAQ.md](FAQ.md)**
  - Common questions answered
  - Troubleshooting tips
  - Usage examples
  - Advanced techniques

## 🔧 Configuration

### Config Files

- **[scripts/dynamic-pages-config.js](../scripts/dynamic-pages-config.js)**
  - Main configuration file
  - Define dynamic pages
  - URL patterns
  - Helper functions

- **[scripts/dynamic-pages-config.example.js](../scripts/dynamic-pages-config.example.js)**
  - Example configuration
  - Usage patterns
  - Best practices

### Environment Variables

- **[.env.example](../.env.example)**
  - Environment template
  - Required variables
  - Optional settings

## 🛠️ Scripts

### Crawler Scripts

- **[scripts/crawl.js](../scripts/crawl.js)**
  - Static crawler (Cheerio)
  - Sitemap parsing
  - HTML extraction

- **[scripts/crawlDynamic.js](../scripts/crawlDynamic.js)**
  - Dynamic crawler (Puppeteer)
  - JavaScript rendering
  - Browser automation

- **[scripts/testDynamic.js](../scripts/testDynamic.js)**
  - Test Puppeteer setup
  - Verify installation
  - Quick diagnostics

### Indexing Scripts

- **[scripts/index.js](../scripts/index.js)**
  - Combine crawled data
  - Chunk content
  - Upload to Upstash

## 📖 Reference Guides

### Quick References

- **[DYNAMIC-CRAWLING-SUMMARY.md](DYNAMIC-CRAWLING-SUMMARY.md)**
  - What was added
  - New commands
  - Quick start
  - Common use cases

- **[MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)**
  - Upgrade existing projects
  - Step-by-step migration
  - Backward compatibility
  - Rollback instructions

## 🎯 By Use Case

### I want to...

#### Set up dynamic crawling for the first time
1. [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md)
2. [CHECKLIST.md](CHECKLIST.md)
3. [FAQ.md](FAQ.md) (if issues arise)

#### Understand how it works
1. [ARCHITECTURE.md](ARCHITECTURE.md)
2. [scripts/CRAWLING.md](../scripts/CRAWLING.md)
3. [README.md](../README.md)

#### Upgrade an existing project
1. [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)
2. [CHECKLIST.md](CHECKLIST.md)
3. [SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md)

#### Troubleshoot issues
1. [FAQ.md](FAQ.md)
2. [SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md) (Troubleshooting section)
3. [CHECKLIST.md](CHECKLIST.md) (verify setup)

#### Configure dynamic pages
1. [scripts/dynamic-pages-config.example.js](../scripts/dynamic-pages-config.example.js)
2. [scripts/CRAWLING.md](../scripts/CRAWLING.md) (Configuration section)
3. [FAQ.md](FAQ.md) (Configuration questions)

#### Optimize performance
1. [scripts/CRAWLING.md](../scripts/CRAWLING.md) (Performance section)
2. [FAQ.md](FAQ.md) (Performance questions)
3. [ARCHITECTURE.md](ARCHITECTURE.md) (Performance comparison)

#### Learn advanced techniques
1. [FAQ.md](FAQ.md) (Advanced questions)
2. [scripts/crawlDynamic.js](../scripts/crawlDynamic.js) (code examples)
3. [SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md) (Advanced configuration)

## 📊 Documentation by Level

### Beginner (Just Starting)
- ⭐ [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md)
- [SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md)
- [CHECKLIST.md](CHECKLIST.md)
- [DYNAMIC-CRAWLING-SUMMARY.md](DYNAMIC-CRAWLING-SUMMARY.md)

### Intermediate (Understanding the System)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [scripts/CRAWLING.md](../scripts/CRAWLING.md)
- [FAQ.md](FAQ.md)
- [README.md](../README.md)

### Advanced (Customization & Optimization)
- [scripts/crawlDynamic.js](../scripts/crawlDynamic.js) (source code)
- [scripts/crawl.js](../scripts/crawl.js) (source code)
- [scripts/index.js](../scripts/index.js) (source code)
- [FAQ.md](FAQ.md) (Advanced section)

## 🔍 Quick Lookup

### Commands
```bash
npm run test:dynamic      # Test Puppeteer
npm run crawl            # Static crawling
npm run crawl:dynamic    # Dynamic crawling
npm run crawl:all        # Both crawlers
npm run index            # Index content
npm start                # Start server
```

See: [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md#commands-reference)

### Files
```
scripts/
├── crawl.js                    # Static crawler
├── crawlDynamic.js             # Dynamic crawler
├── dynamic-pages-config.js     # Configuration
├── testDynamic.js              # Test script
└── index.js                    # Indexer

crawled-data/
├── pages.json                  # Static pages
└── pages-dynamic.json          # Dynamic pages
```

See: [ARCHITECTURE.md](ARCHITECTURE.md)

### Configuration
```javascript
// scripts/dynamic-pages-config.js
export const DYNAMIC_PAGES = [ /* URLs */ ];
export const DYNAMIC_PAGE_PATTERNS = [ /* Regex */ ];
```

See: [scripts/CRAWLING.md](../scripts/CRAWLING.md#configuration)

## 🆘 Troubleshooting

### Common Issues

| Issue | See |
|-------|-----|
| Installation fails | [SETUP-DYNAMIC-CRAWLING.md](SETUP-DYNAMIC-CRAWLING.md#troubleshooting) |
| Test fails | [FAQ.md](FAQ.md#setup-questions) |
| Content missing | [FAQ.md](FAQ.md#usage-questions) |
| Timeout errors | [FAQ.md](FAQ.md#troubleshooting-questions) |
| Memory issues | [FAQ.md](FAQ.md#performance-questions) |
| Configuration errors | [FAQ.md](FAQ.md#configuration-questions) |

### Debug Commands
```bash
# Test Puppeteer
npm run test:dynamic

# Run with visible browser
PUPPETEER_HEADLESS=false npm run crawl:dynamic

# Check files
ls -la crawled-data/

# Verify config
node -e "import('./scripts/dynamic-pages-config.js').then(m => console.log('OK'))"
```

See: [CHECKLIST.md](CHECKLIST.md)

## 📝 Document Summaries

### One-Sentence Summaries

| Document | Summary |
|----------|---------|
| GETTING-STARTED-DYNAMIC.md | 5-minute quick start guide |
| SETUP-DYNAMIC-CRAWLING.md | Comprehensive setup instructions |
| ARCHITECTURE.md | System design and data flow |
| FAQ.md | Common questions and answers |
| CHECKLIST.md | Setup verification steps |
| scripts/CRAWLING.md | Detailed crawling documentation |
| MIGRATION-GUIDE.md | Upgrade existing projects |
| DYNAMIC-CRAWLING-SUMMARY.md | What's new and how to use it |
| README.md | Main project documentation |

## 🎓 Learning Path

### Path 1: Quick Start (30 minutes)
1. Read: [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md) (10 min)
2. Follow: Setup steps (15 min)
3. Verify: [CHECKLIST.md](CHECKLIST.md) (5 min)

### Path 2: Deep Understanding (2 hours)
1. Quick start (30 min)
2. Read: [ARCHITECTURE.md](ARCHITECTURE.md) (30 min)
3. Read: [scripts/CRAWLING.md](../scripts/CRAWLING.md) (30 min)
4. Read: [FAQ.md](FAQ.md) (30 min)

### Path 3: Expert Level (4+ hours)
1. Deep understanding (2 hours)
2. Study: Source code (1 hour)
3. Experiment: Custom configurations (1 hour)
4. Practice: Advanced techniques (ongoing)

## 🔗 External Resources

### Puppeteer
- Official docs: https://pptr.dev/
- API reference: https://pptr.dev/api
- Examples: https://github.com/puppeteer/puppeteer/tree/main/examples

### Related Technologies
- Cheerio: https://cheerio.js.org/
- Upstash: https://upstash.com/docs
- Gemini AI: https://ai.google.dev/

## 📅 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| GETTING-STARTED-DYNAMIC.md | ✅ Complete | Current |
| SETUP-DYNAMIC-CRAWLING.md | ✅ Complete | Current |
| ARCHITECTURE.md | ✅ Complete | Current |
| FAQ.md | ✅ Complete | Current |
| CHECKLIST.md | ✅ Complete | Current |
| scripts/CRAWLING.md | ✅ Complete | Current |
| MIGRATION-GUIDE.md | ✅ Complete | Current |
| DYNAMIC-CRAWLING-SUMMARY.md | ✅ Complete | Current |

## 🤝 Contributing

Found an issue or want to improve the docs?

1. Check existing documentation first
2. Review [FAQ.md](FAQ.md) for common questions
3. Update relevant documentation
4. Test your changes
5. Submit improvements

## 📞 Support

1. **Check documentation** - Most answers are here
2. **Run diagnostics** - `npm run test:dynamic`
3. **Review logs** - Console output is helpful
4. **Debug visually** - `PUPPETEER_HEADLESS=false`

---

## 🎯 Start Here

**New user?** → [GETTING-STARTED-DYNAMIC.md](GETTING-STARTED-DYNAMIC.md)

**Upgrading?** → [MIGRATION-GUIDE.md](MIGRATION-GUIDE.md)

**Having issues?** → [FAQ.md](FAQ.md)

**Want to understand?** → [ARCHITECTURE.md](ARCHITECTURE.md)

**Need to verify?** → [CHECKLIST.md](CHECKLIST.md)

---

**Happy crawling!** 🕷️✨
