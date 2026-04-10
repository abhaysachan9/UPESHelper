/**
 * scripts/testDynamic.js
 * Quick test to verify Puppeteer setup
 * 
 * Usage: node scripts/testDynamic.js <url>
 * Example: node scripts/testDynamic.js https://www.upes.ac.in
 */

import puppeteer from "puppeteer";

const testUrl = process.argv[2] || "https://www.upes.ac.in";

console.log("\n🧪 Testing Puppeteer setup...\n");
console.log(`   Target URL: ${testUrl}\n`);

async function test() {
  console.log("🚀 Launching browser...");
  
  const browser = await puppeteer.launch({
    headless: process.env.PUPPETEER_HEADLESS !== "false",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  
  console.log("📄 Loading page...");
  await page.goto(testUrl, { waitUntil: "networkidle2", timeout: 30000 });
  
  console.log("✅ Page loaded successfully!");
  
  const title = await page.title();
  console.log(`   Title: ${title}`);
  
  const content = await page.evaluate(() => {
    return document.body.innerText.slice(0, 200);
  });
  
  console.log(`   Content preview: ${content.replace(/\s+/g, ' ').trim()}...`);
  
  await browser.close();
  console.log("\n✅ Test complete! Puppeteer is working correctly.\n");
}

test().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  console.error("\nTroubleshooting:");
  console.error("1. Make sure Puppeteer is installed: npm install puppeteer");
  console.error("2. Check your internet connection");
  console.error("3. Try with a different URL\n");
  process.exit(1);
});
