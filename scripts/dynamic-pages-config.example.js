/**
 * scripts/dynamic-pages-config.js
 * Example configuration for pages that require JavaScript rendering
 */

export const DYNAMIC_PAGES = [
  // Add URLs of JavaScript-heavy pages here
  // Examples:
  
  // Single-page applications
  // "https://www.upes.ac.in/student-portal",
  // "https://www.upes.ac.in/interactive-dashboard",
  
  // Pages with dynamic content loading
  // "https://www.upes.ac.in/courses/search",
  // "https://www.upes.ac.in/faculty-directory",
  
  // React/Vue/Angular apps
  // "https://www.upes.ac.in/app/admissions",
];

/**
 * URL patterns to automatically identify dynamic pages
 * These will be excluded from static crawling
 */
export const DYNAMIC_PAGE_PATTERNS = [
  // Add regex patterns to match dynamic page URLs
  // Examples:
  
  // Match all dashboard pages
  // /\/dashboard/,
  
  // Match all portal pages
  // /\/portal/,
  
  // Match all app routes
  // /\/app\//,
  
  // Match specific subdomains
  // /^https:\/\/portal\./,
];

/**
 * Check if a URL should be crawled dynamically
 * (You don't need to modify this function)
 */
export function isDynamicPage(url) {
  // Check exact matches
  if (DYNAMIC_PAGES.includes(url) || DYNAMIC_PAGES.includes(url.replace(/\/$/, ''))) {
    return true;
  }
  
  // Check pattern matches
  return DYNAMIC_PAGE_PATTERNS.some(pattern => pattern.test(url));
}
