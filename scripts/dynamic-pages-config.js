/**
 * scripts/dynamic-pages-config.js
 * Configuration for pages that require JavaScript rendering
 * These pages will be crawled with Puppeteer instead of static fetch
 */

export const DYNAMIC_PAGES = [
  // Example: Pages with React/Vue/Angular content
  // "https://www.upes.ac.in/interactive-dashboard",
  // "https://www.upes.ac.in/student-portal",
  
  // Add your JavaScript-heavy pages here
];

/**
 * URL patterns to identify dynamic pages during sitemap crawling
 * These will be automatically excluded from static crawling
 */
export const DYNAMIC_PAGE_PATTERNS = [
  // Example patterns:
  // /\/dashboard/,
  // /\/portal/,
  // /\/app\//,
];

/**
 * Check if a URL should be crawled dynamically
 */
export function isDynamicPage(url) {
  // Check exact matches
  if (DYNAMIC_PAGES.includes(url) || DYNAMIC_PAGES.includes(url.replace(/\/$/, ''))) {
    return true;
  }
  
  // Check pattern matches
  return DYNAMIC_PAGE_PATTERNS.some(pattern => pattern.test(url));
}
