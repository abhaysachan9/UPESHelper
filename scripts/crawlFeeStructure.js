/**
 * scripts/crawlFeeStructure.js
 * Specialized crawler for the UPES Fee Structure page.
 *
 * The fee-structure page is an SPA that swaps content based on three
 * dependent selectors that never change the URL:
 *   1. School      (7 options, exposed as role="tab" or as a "Select School" dropdown)
 *   2. Programme   (Undergraduate / Postgraduate, role="radio")
 *   3. Course      (N options per school+level, role="radio")
 *
 * A generic crawler only captures whatever combination is selected by
 * default (Adv Engg + UG + B.Tech Petroleum), so RAG can only answer
 * petroleum fee questions.
 *
 * This script enumerates every (school × level × course) combination,
 * captures the visible fee block for each, and writes one synthetic
 * "page" per combination to crawled-data/pages-fees.json. Each entry
 * gets a unique URL fragment + a search-friendly title so the indexer
 * stores it as its own retrievable document.
 *
 * Env vars:
 *   FEE_PAGE_URL        — default https://www.upes.ac.in/admissions/fee-structure
 *   FEE_SCHOOLS         — comma-separated subset of school names to crawl (default = all detected)
 *   FEE_LEVELS          — comma-separated subset of programme levels (default = all detected per-school,
 *                         e.g. Undergraduate, Postgraduate, Integrated)
 *   PUPPETEER_HEADLESS  — "false" to run with visible browser
 *   FEE_DEBUG           — "1" to log extra detail per click
 *
 * Usage:
 *   node scripts/crawlFeeStructure.js
 *   FEE_LEVELS=Undergraduate node scripts/crawlFeeStructure.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

// ─── Load env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const eq = t.indexOf("=");
      if (eq === -1) return;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (k && !(k in process.env)) process.env[k] = v;
    });
}

// ─── Config ───────────────────────────────────────────────────────────────────
const FEE_PAGE_URL =
  process.env.FEE_PAGE_URL || "https://www.upes.ac.in/admissions/fee-structure";
const HEADLESS = process.env.PUPPETEER_HEADLESS !== "false";
const DEBUG = process.env.FEE_DEBUG === "1";
const PAGE_TIMEOUT = 45_000;
const VIEWPORT = { width: 1920, height: 1080 };
const STATE_CHANGE_TIMEOUT = 4_000;
const POST_LOAD_WAIT = 2_500;
const OUTPUT_DIR = path.join(rootDir, "crawled-data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "pages-fees.json");

const FILTER_LEVELS = (process.env.FEE_LEVELS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FILTER_SCHOOLS = (process.env.FEE_SCHOOLS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[()&/.,]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function log(...args) {
  console.log(...args);
}
function debug(...args) {
  if (DEBUG) console.log("   [debug]", ...args);
}

/**
 * Click the radio button in the group `groupName` whose `value` attribute
 * matches `value` exactly. Triggers click on the associated <label> if one
 * exists (UPES wraps each radio with a `label[for="<id>"]`), then dispatches
 * a `change` event for safety. Verifies the radio is actually `.checked`
 * after the click.
 *
 * Returns { ok, found, checked }.
 */
async function clickRadioInGroup(page, groupName, value) {
  return await page.evaluate(
    ({ groupName, value }) => {
      const candidates = Array.from(
        document.querySelectorAll(`input[type="radio"][name="${groupName}"]`)
      );
      const radio = candidates.find((r) => r.getAttribute("value") === value);
      if (!radio) return { ok: false, found: false, checked: false, total: candidates.length };

      try {
        radio.scrollIntoView({ block: "center" });
      } catch (_) {}

      // Prefer clicking the associated label – many CSS frameworks (incl.
      // Bootstrap form-check) hide the underlying input visually.
      const label = radio.id
        ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`)
        : null;
      const target = label || radio.closest("label") || radio;
      target.click();

      // Defensive: ensure the input is checked and that change handlers fire
      if (!radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
      }

      return { ok: true, found: true, checked: radio.checked, total: candidates.length };
    },
    { groupName, value }
  );
}

/**
 * Click a school tab by its accessible name.
 */
async function clickSchoolTab(page, schoolName) {
  return await page.evaluate((name) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const tab = tabs.find(
      (t) => norm(t.getAttribute("aria-label") || t.textContent) === name
    );
    if (!tab) return { ok: false, attempted: tabs.length };
    try {
      tab.scrollIntoView({ block: "center" });
    } catch (_) {}
    tab.click();
    return { ok: true, attempted: tabs.length };
  }, schoolName);
}

/**
 * Discover the list of school tab names currently in the DOM.
 * The fee page exposes them as role="tab" with the school's full name.
 */
async function getSchoolNames(page) {
  return await page.evaluate(() => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
    const names = tabs
      .map((t) => norm(t.getAttribute("aria-label") || t.textContent))
      .filter((n) => /^School of /i.test(n));
    return [...new Set(names)];
  });
}

/**
 * Discover programme levels for the currently selected school by reading
 * radios in the `programe` group (UPES's spelling). Most schools expose
 * Undergraduate + Postgraduate; School of Business additionally exposes
 * Integrated.
 */
async function getLevelNames(page) {
  return await page.evaluate(() => {
    const radios = Array.from(
      document.querySelectorAll('input[type="radio"][name="programe"]')
    );
    return [...new Set(radios.map((r) => r.getAttribute("value")).filter(Boolean))];
  });
}

/**
 * Discover course names available for the currently selected school+level
 * by reading radios in the `courses` group. Programme-level radios live in
 * a separate group (`programe`) and are guaranteed not to leak in.
 */
async function getCourseNames(page) {
  return await page.evaluate(() => {
    const radios = Array.from(
      document.querySelectorAll('input[type="radio"][name="courses"]')
    );
    return [...new Set(radios.map((r) => r.getAttribute("value")).filter(Boolean))];
  });
}

/**
 * Read the currently displayed course-title in the fee panel.
 * The page renders the selected course name as a sub-heading right above
 * the fee table (e.g. "B.Tech (Applied Petroleum Engineering)").
 *
 * Heuristic: find the heading just before the first visible <table> that
 * lives inside the main content region.
 */
async function getDisplayedCourseTitle(page) {
  return await page.evaluate(() => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const tables = Array.from(document.querySelectorAll("table"));
    // Find the first visible table containing fee-like content
    const visibleTable = tables.find((t) => {
      if (!t.offsetParent && t.getClientRects().length === 0) return false;
      const txt = (t.textContent || "").toLowerCase();
      return /tuition|semester|fee|category/.test(txt);
    });
    if (!visibleTable) return "";
    // Walk up + back to find the nearest preceding heading or text node
    let node = visibleTable;
    for (let i = 0; i < 6 && node; i++) {
      let prev = node.previousElementSibling;
      while (prev) {
        const t = norm(prev.textContent);
        if (t && t.length < 200 && !/select|filter/i.test(t)) return t;
        prev = prev.previousElementSibling;
      }
      node = node.parentElement;
    }
    return "";
  });
}

/**
 * Extract the visible fee block for the currently selected combination.
 * Returns { courseTitle, markdown } where markdown contains the fee table
 * (converted to GFM markdown) plus any surrounding descriptive text.
 */
async function extractFeeBlock(page) {
  return await page.evaluate(() => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

    // Convert a <table> to GFM markdown
    const tableToMarkdown = (table) => {
      const rows = [];
      table.querySelectorAll("tr").forEach((tr) => {
        const cells = [];
        tr.querySelectorAll("th, td").forEach((c) =>
          cells.push(norm(c.textContent))
        );
        if (cells.some((c) => c.length > 0)) rows.push(cells);
      });
      if (rows.length === 0) return "";
      const colCount = Math.max(...rows.map((r) => r.length));
      const pad = (a) => {
        while (a.length < colCount) a.push("");
        return a;
      };
      const lines = [];
      lines.push("| " + pad(rows[0]).join(" | ") + " |");
      lines.push("| " + Array(colCount).fill("---").join(" | ") + " |");
      for (let i = 1; i < rows.length; i++) {
        lines.push("| " + pad(rows[i]).join(" | ") + " |");
      }
      return lines.join("\n");
    };

    const isVisible = (el) => {
      if (!el) return false;
      const r = el.getClientRects();
      if (r.length === 0) return false;
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return true;
    };

    // Find the first visible fee-like table
    const tables = Array.from(document.querySelectorAll("table")).filter(
      (t) => {
        if (!isVisible(t)) return false;
        const txt = (t.textContent || "").toLowerCase();
        return /tuition|semester|category|fee/.test(txt);
      }
    );

    if (tables.length === 0) return { courseTitle: "", markdown: "" };

    const feeTable = tables[0];

    // Find the displayed course title: nearest preceding non-empty heading-ish text
    let courseTitle = "";
    let walker = feeTable;
    outer: for (let depth = 0; depth < 8 && walker; depth++) {
      let prev = walker.previousElementSibling;
      while (prev) {
        const t = norm(prev.textContent);
        if (t && t.length < 250 && !/^select|^filter/i.test(t)) {
          courseTitle = t;
          break outer;
        }
        prev = prev.previousElementSibling;
      }
      walker = walker.parentElement;
    }

    // Climb to a section that contains both the title and the fee table,
    // then extract its full text. We stop climbing once we'd start including
    // unrelated sections (FINANCIAL AID, footer, etc.).
    let section = feeTable.parentElement;
    while (
      section &&
      section.parentElement &&
      !/financial aid|first step|other links|copyright/i.test(
        section.parentElement.textContent || ""
      ) &&
      section.parentElement.tagName !== "BODY"
    ) {
      section = section.parentElement;
      // Stop once section is large enough to contain the table + ~Other Fees
      if (section.textContent && section.textContent.length > 4000) break;
    }
    if (!section) section = feeTable.parentElement;

    // Replace tables with markdown placeholders, then collect text
    const clone = section.cloneNode(true);

    // Strip noise: nav, header, footer, scripts, forms, buttons unrelated to fee
    clone.querySelectorAll(
      "script, style, noscript, nav, footer, header, form, iframe, svg, [class*='cookie'], [id*='cookie']"
    ).forEach((el) => el.remove());

    // Convert tables in clone using corresponding live tables (positions match)
    const cloneTables = clone.querySelectorAll("table");
    const liveTables = section.querySelectorAll("table");
    cloneTables.forEach((ct, i) => {
      const live = liveTables[i] || ct;
      const md = tableToMarkdown(live);
      ct.replaceWith(document.createTextNode("\n" + md + "\n"));
    });

    // Convert headings to markdown
    clone.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
      const lvl = parseInt(h.tagName[1], 10);
      const t = norm(h.textContent);
      if (t)
        h.replaceWith(document.createTextNode(`\n${"#".repeat(lvl)} ${t}\n`));
    });

    // Convert list items
    clone.querySelectorAll("li").forEach((li) => {
      const t = norm(li.textContent);
      if (t) li.replaceWith(document.createTextNode(`\n- ${t}`));
    });

    let raw = clone.textContent || "";
    const cleaned = raw
      .split("\n")
      .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
      .filter((l) => l.trim().length > 0)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { courseTitle, markdown: cleaned };
  });
}

/**
 * Wait until the displayed course title differs from `prevTitle`,
 * or timeout is reached. Returns the latest displayed title.
 */
async function waitForCourseChange(page, prevTitle, timeout = STATE_CHANGE_TIMEOUT) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const t = await getDisplayedCourseTitle(page);
    if (t && t !== prevTitle) return t;
    await sleep(150);
  }
  return await getDisplayedCourseTitle(page);
}

/**
 * Click a school tab by name.
 */
async function selectSchool(page, schoolName) {
  const prev = await getDisplayedCourseTitle(page);
  const res = await clickSchoolTab(page, schoolName);
  if (!res.ok) {
    debug(`could not select school "${schoolName}" (${res.attempted} tabs in DOM)`);
    return false;
  }
  await waitForCourseChange(page, prev);
  await sleep(400);
  return true;
}

/**
 * Select a programme level (Undergraduate / Postgraduate / Integrated).
 * Verifies the radio actually became `.checked` and that the displayed
 * course title changed (or stayed put if the level was already selected).
 */
async function selectLevel(page, levelName) {
  const prev = await getDisplayedCourseTitle(page);
  const res = await clickRadioInGroup(page, "programe", levelName);
  if (!res.found) {
    debug(`level radio "${levelName}" not found (${res.total} programe radios)`);
    return false;
  }
  if (!res.checked) {
    debug(`level radio "${levelName}" did not become checked after click`);
    return false;
  }
  await waitForCourseChange(page, prev);
  await sleep(400);
  return true;
}

/**
 * Select a course radio. Verifies the radio became `.checked`.
 */
async function selectCourse(page, courseName) {
  const prev = await getDisplayedCourseTitle(page);
  const res = await clickRadioInGroup(page, "courses", courseName);
  if (!res.found) {
    debug(`course radio "${courseName}" not found (${res.total} courses radios)`);
    return false;
  }
  if (!res.checked) {
    debug(`course radio "${courseName}" did not become checked after click`);
    return false;
  }
  await waitForCourseChange(page, prev);
  await sleep(500);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function crawlFees() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  log("\nUPES Fee Structure Crawler");
  log("==========================");
  log(`URL:       ${FEE_PAGE_URL}`);
  log(`Headless:  ${HEADLESS}`);
  log(`Levels:    ${FILTER_LEVELS.length ? FILTER_LEVELS.join(", ") : "(all detected per-school)"}`);
  log(`Schools:   ${FILTER_SCHOOLS.length ? FILTER_SCHOOLS.join(", ") : "(all detected)"}`);
  log("");

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const results = [];
  const failures = [];

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.setUserAgent(
      "UPES-Helper-Bot/1.0 (educational; +https://github.com/upes-helper)"
    );

    log(`Loading ${FEE_PAGE_URL} ...`);
    await page.goto(FEE_PAGE_URL, {
      waitUntil: "networkidle2",
      timeout: PAGE_TIMEOUT,
    });
    await sleep(POST_LOAD_WAIT);

    // Try to dismiss any cookie banners or modals so they don't intercept clicks
    await page.evaluate(() => {
      document
        .querySelectorAll(
          "[class*='cookie'] button, [id*='cookie'] button, [class*='accept'] button"
        )
        .forEach((b) => {
          try {
            b.click();
          } catch (_) {}
        });
    });
    await sleep(300);

    let schools = await getSchoolNames(page);
    log(`Detected ${schools.length} schools: ${schools.join(" | ")}\n`);
    if (FILTER_SCHOOLS.length > 0) {
      schools = schools.filter((s) => FILTER_SCHOOLS.includes(s));
      log(`After FEE_SCHOOLS filter: ${schools.length}\n`);
    }

    if (schools.length === 0) {
      throw new Error(
        "No schools detected. The page layout may have changed; inspect with FEE_DEBUG=1 PUPPETEER_HEADLESS=false."
      );
    }

    const crawledAt = new Date().toISOString();
    const seenSlugs = new Set();

    for (const school of schools) {
      log(`\n[School] ${school}`);
      const ok = await selectSchool(page, school);
      if (!ok) {
        failures.push({ school, reason: "school select failed" });
        continue;
      }

      // Detect available levels for THIS school (Business has Integrated too)
      let levels = await getLevelNames(page);
      if (FILTER_LEVELS.length > 0) {
        levels = levels.filter((l) => FILTER_LEVELS.includes(l));
      }
      log(`   Levels detected: ${levels.join(", ") || "(none)"}`);

      for (const level of levels) {
        const lvlOk = await selectLevel(page, level);
        if (!lvlOk) {
          log(`   - ${level}: select failed, skipping`);
          failures.push({ school, level, reason: "level select failed" });
          continue;
        }

        const courses = await getCourseNames(page);
        if (courses.length === 0) {
          log(`   - ${level}: no courses detected`);
          failures.push({ school, level, reason: "no courses detected" });
          continue;
        }
        log(`   - ${level}: ${courses.length} course(s)`);

        for (const course of courses) {
          const courseOk = await selectCourse(page, course);
          if (!courseOk) {
            failures.push({ school, level, course, reason: "course select failed" });
            continue;
          }

          const { courseTitle, markdown } = await extractFeeBlock(page);
          if (!markdown || markdown.length < 80) {
            failures.push({
              school,
              level,
              course,
              reason: `empty extraction (md=${markdown?.length || 0})`,
            });
            log(`        x ${course}  (no fee block extracted)`);
            continue;
          }

          // Sanity check: the displayed title should reference the course
          // we asked for (best effort — UPES sometimes truncates names).
          const titleOk = courseTitle
            .toLowerCase()
            .includes(course.split(/[(/]/)[0].trim().toLowerCase());
          if (!titleOk) {
            debug(
              `displayed title "${courseTitle}" doesn't match course "${course}"`
            );
          }

          const slug = `school=${slugify(school)}&level=${slugify(level)}&course=${slugify(course)}`;
          if (seenSlugs.has(slug)) {
            debug(`duplicate slug ${slug}`);
            continue;
          }
          seenSlugs.add(slug);

          const url = `${FEE_PAGE_URL}#${slug}`;
          const title = `Fee Structure 2026-27 — ${school} — ${level} — ${course}`;
          const header = [
            `School: ${school}`,
            `Programme Level: ${level}`,
            `Course: ${course}`,
            `Displayed title: ${courseTitle || "(unknown)"}`,
            "",
          ].join("\n");

          results.push({
            url,
            title,
            metaDescription: `Fee structure for ${course} (${level}) at ${school}, UPES — academic year 2026-27.`,
            text: header + markdown,
            crawledAt,
            dynamic: true,
            feeCombo: { school, level, course },
          });

          log(`        + ${course}  (${markdown.length} chars)`);
        }
      }
    }
  } finally {
    await browser.close();
    log("\nBrowser closed.");
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf-8");

  log(`\nDone. ${results.length} fee combinations written to:`);
  log(`   ${OUTPUT_FILE}`);
  if (failures.length > 0) {
    log(`\n${failures.length} combination(s) failed:`);
    failures.forEach((f) => log(`   - ${JSON.stringify(f)}`));
  }
  log('\nRun "npm run index" to push these into Upstash.\n');
}

crawlFees().catch((err) => {
  console.error("Fee crawler failed:", err);
  process.exit(1);
});
