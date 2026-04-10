# Getting Started with Dynamic Crawling

Welcome! This guide will get you up and running with dynamic crawling in 5 minutes.

## 🎯 What You'll Achieve

By the end of this guide, you'll be able to:
- Crawl JavaScript-heavy pages that static crawlers can't handle
- Automatically exclude dynamic pages from static crawling
- Index both static and dynamic content together
- Have a fully functional RAG chatbot with complete content coverage

## 📋 Prerequisites

- Node.js v18+ installed
- Basic familiarity with terminal/command line
- The UPES Helper project set up

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Puppeteer (1 min)

```bash
npm install
```

This downloads Puppeteer and Chromium (~300MB). Grab a coffee! ☕

### Step 2: Test Your Setup (30 seconds)

```bash
npm run test:dynamic
```

✅ If you see "Test complete!", you're ready to go!

❌ If it fails, see [Troubleshooting](#troubleshooting) below.

### Step 3: Configure Dynamic Pages (1 min)

Edit `scripts/dynamic-pages-config.js`:

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/your-dynamic-page",
];
```

**How do I know which pages are dynamic?**
- Pages that show "Loading..." spinners
- Single-page applications (React, Vue, Angular)
- Pages where content appears after the page loads
- URLs like `/portal/`, `/dashboard/`, `/app/`

**Not sure?** Start with an empty array and add pages as needed.

### Step 4: Crawl Everything (2 min)

```bash
npm run crawl:all
```

This runs both crawlers:
1. Static crawler (fast) → `pages.json`
2. Dynamic crawler (slower) → `pages-dynamic.json`

### Step 5: Index Content (1 min)

```bash
npm run index
```

This uploads everything to Upstash Vector DB.

### Step 6: Test It! (30 seconds)

```bash
npm start
```

Visit http://localhost:3000 and ask questions!

## 🎉 Done!

You now have dynamic crawling set up. Your chatbot can answer questions from both static and dynamic pages.

---

## 📚 What Just Happened?

### Before Dynamic Crawling

```
Static Crawler → pages.json → Upstash → Chatbot
                    ↓
            Missing JS content ❌
```

### After Dynamic Crawling

```
Static Crawler  → pages.json         ↘
                                      → Combined → Upstash → Chatbot
Dynamic Crawler → pages-dynamic.json ↗
                    ↓
            Complete content ✅
```

---

## 🔧 Configuration Options

### Option 1: Exact URLs (Simple)

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/page1",
  "https://www.upes.ac.in/page2",
];
```

**Use when:** You have a few specific pages.

### Option 2: URL Patterns (Advanced)

```javascript
export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,      // Matches any URL with /portal
  /\/dashboard/,   // Matches any URL with /dashboard
];
```

**Use when:** You have many similar URLs.

### Option 3: Both (Flexible)

```javascript
export const DYNAMIC_PAGES = [
  "https://www.upes.ac.in/special-page",
];

export const DYNAMIC_PAGE_PATTERNS = [
  /\/portal/,
];
```

**Use when:** You have both specific pages and patterns.

---

## 🎮 Commands Reference

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `npm run test:dynamic` | Test Puppeteer setup | First time, troubleshooting |
| `npm run crawl` | Crawl static pages only | Regular crawling |
| `npm run crawl:dynamic` | Crawl dynamic pages only | After adding new dynamic pages |
| `npm run crawl:all` | Crawl both types | Full refresh |
| `npm run index` | Upload to Upstash | After any crawling |
| `npm start` | Start the server | Testing, production |

---

## 🐛 Troubleshooting

### Test Fails: "Browser not found"

**Fix:**
```bash
npm uninstall puppeteer
npm install puppeteer
```

### Test Fails: "Download failed"

**Fix:** Use system Chrome:
```bash
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
npm install puppeteer
```

### Dynamic Crawler Times Out

**Fix:** Increase timeout in `scripts/crawlDynamic.js`:
```javascript
const PAGE_TIMEOUT = 60_000; // 60 seconds
```

### Content Still Missing

**Fix:** Increase wait time in `scripts/crawlDynamic.js`:
```javascript
const WAIT_FOR_CONTENT = 5000; // 5 seconds
```

### Want to See What's Happening?

**Fix:** Run with visible browser:
```bash
PUPPETEER_HEADLESS=false npm run crawl:dynamic
```

---

## 💡 Tips & Best Practices

### ✅ DO:

1. **Start small** - Add one dynamic page, test it, then add more
2. **Test first** - Always run `npm run test:dynamic` after setup
3. **Use static for most pages** - It's much faster
4. **Monitor progress** - Watch the console output
5. **Re-crawl regularly** - Content changes over time

### ❌ DON'T:

1. **Don't add all pages to dynamic** - Only use it when needed
2. **Don't skip testing** - Catch issues early
3. **Don't ignore errors** - They tell you what's wrong
4. **Don't crawl too aggressively** - Respect the server
5. **Don't forget to index** - Crawling alone doesn't update the chatbot

---

## 📖 Learn More

### Quick References
- **Commands:** See [Commands Reference](#commands-reference) above
- **Config:** See [Configuration Options](#configuration-options) above
- **Errors:** See [Troubleshooting](#troubleshooting) above

### Detailed Guides
- **Setup:** `SETUP-DYNAMIC-CRAWLING.md` - Comprehensive setup guide
- **Architecture:** `ARCHITECTURE.md` - How it all works
- **FAQ:** `FAQ.md` - Common questions answered
- **Checklist:** `CHECKLIST.md` - Verify your setup

### Technical Docs
- **Crawling:** `scripts/CRAWLING.md` - Detailed crawling documentation
- **Migration:** `MIGRATION-GUIDE.md` - Upgrading existing projects

---

## 🎯 Common Workflows

### Workflow 1: Adding a New Dynamic Page

```bash
# 1. Add URL to config
# Edit scripts/dynamic-pages-config.js

# 2. Test with one page first
npm run crawl:dynamic

# 3. Check the output
cat crawled-data/pages-dynamic.json

# 4. If good, index it
npm run index

# 5. Test in chatbot
npm start
```

### Workflow 2: Full Refresh

```bash
# 1. Crawl everything
npm run crawl:all

# 2. Index everything
npm run index

# 3. Restart server
npm start
```

### Workflow 3: Debugging a Problem Page

```bash
# 1. Add just that page to config
# Edit scripts/dynamic-pages-config.js

# 2. Run with visible browser
PUPPETEER_HEADLESS=false npm run crawl:dynamic

# 3. Watch what happens
# Browser will open and you can see the page load

# 4. Adjust wait times if needed
# Edit scripts/crawlDynamic.js
```

---

## 🚀 Next Steps

Now that you have dynamic crawling set up:

1. **Identify your dynamic pages** - Which pages need JavaScript?
2. **Add them to the config** - Update `dynamic-pages-config.js`
3. **Run a full crawl** - `npm run crawl:all`
4. **Test thoroughly** - Ask questions in the chatbot
5. **Automate** - Set up cron jobs for regular re-crawling
6. **Monitor** - Keep an eye on performance and errors
7. **Optimize** - Adjust timeouts and wait times as needed

---

## 🆘 Need Help?

1. **Check the FAQ:** `FAQ.md` has answers to common questions
2. **Run the test:** `npm run test:dynamic` to verify setup
3. **Check logs:** Console output shows what's happening
4. **Debug visually:** `PUPPETEER_HEADLESS=false npm run crawl:dynamic`
5. **Review docs:** See [Learn More](#learn-more) section

---

## ✨ Success!

If you've made it this far, you should have:
- ✅ Puppeteer installed and tested
- ✅ Dynamic pages configured
- ✅ Both crawlers running
- ✅ Content indexed in Upstash
- ✅ Chatbot answering questions from all pages

**Congratulations!** You're now crawling like a pro. 🎉

---

## 📊 Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  DYNAMIC CRAWLING QUICK REFERENCE                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Setup:                                                 │
│    npm install                                          │
│    npm run test:dynamic                                 │
│                                                         │
│  Configure:                                             │
│    Edit scripts/dynamic-pages-config.js                 │
│                                                         │
│  Crawl:                                                 │
│    npm run crawl:all                                    │
│                                                         │
│  Index:                                                 │
│    npm run index                                        │
│                                                         │
│  Run:                                                   │
│    npm start                                            │
│                                                         │
│  Debug:                                                 │
│    PUPPETEER_HEADLESS=false npm run crawl:dynamic       │
│                                                         │
│  Files:                                                 │
│    crawled-data/pages.json          (static)            │
│    crawled-data/pages-dynamic.json  (dynamic)           │
│                                                         │
│  Docs:                                                  │
│    SETUP-DYNAMIC-CRAWLING.md  (setup guide)             │
│    FAQ.md                     (questions)               │
│    ARCHITECTURE.md            (how it works)            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Save this for quick reference!

---

**Happy crawling!** 🕷️✨
