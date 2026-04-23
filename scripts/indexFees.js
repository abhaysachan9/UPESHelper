/**
 * scripts/indexFees.js
 * Indexes ONLY crawled-data/pages-fees.json into Upstash, leaving the rest of
 * the index untouched.
 *
 * Use this after re-running `npm run crawl:fees` so you don't have to re-index
 * the entire site (which can blow the Upstash daily write quota).
 *
 * Because each fee combination has a stable synthetic URL, the chunk IDs are
 * deterministic. Re-upserting just overwrites the existing vectors with the
 * fresh content — no deletions needed.
 *
 * Usage: node scripts/indexFees.js
 *   or:  npm run index:fees
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { upsertChunks } from "../server/services/vectorDb.js";
import { chunkText } from "../server/utils/chunker.js";

// ─── Load env ─────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key && !(key in process.env)) process.env[key] = val;
    });
}

const FEES_FILE = path.join(rootDir, "crawled-data", "pages-fees.json");

async function indexFees() {
  if (!fs.existsSync(FEES_FILE)) {
    console.error(`❌  No fee data found at: ${FEES_FILE}`);
    console.error('   Run "npm run crawl:fees" first.');
    process.exit(1);
  }

  const feePages = JSON.parse(fs.readFileSync(FEES_FILE, "utf-8"));

  console.log(`\n💰  Indexing fee combinations only`);
  console.log(`   Source: ${FEES_FILE}`);
  console.log(`   Combinations: ${feePages.length}`);

  if (feePages.length === 0) {
    console.log("\n⚠️  No fee combinations found in pages-fees.json.\n");
    return;
  }

  const chunks = [];
  for (const page of feePages) {
    const textChunks = chunkText(page.text);
    textChunks.forEach((chunk, i) => {
      const contextPrefix = `[${page.title}]\n`;
      chunks.push({
        id: `${encodeURIComponent(page.url)}_chunk_${i}`,
        text: contextPrefix + chunk,
        metadata: {
          url: page.url,
          title: page.title,
          chunkIndex: i,
          totalChunks: textChunks.length,
          crawledAt: page.crawledAt,
          dynamic: page.dynamic ?? true,
          fees: true,
        },
      });
    });
  }

  console.log(`   Total chunks: ${chunks.length}`);
  console.log(`   Upserting to Upstash (overwrites existing fee vectors)...\n`);

  try {
    await upsertChunks(chunks);
    console.log(
      `\n✅  Fees indexed! ${feePages.length} combinations (${chunks.length} chunks) refreshed in Upstash.\n`,
    );
  } catch (err) {
    console.error(`\n❌  Indexing failed: ${err.message}\n`);
    process.exit(1);
  }
}

indexFees().catch((err) => {
  console.error("❌  Indexing failed:", err.message);
  process.exit(1);
});
