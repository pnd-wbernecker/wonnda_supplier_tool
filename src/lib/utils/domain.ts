/**
 * Domain extraction and URL utilities
 * Migrated from wonnda_archive SQL: NET.HOST(REGEXP_REPLACE(website, 'https?://www\.?'))
 */

/**
 * Extract domain from a website URL
 * "https://www.acme.com/about" → "acme.com"
 * "http://shop.example.org" → "shop.example.org"
 */
export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  
  try {
    // Add protocol if missing
    let url = website.trim();
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url;
    }
    
    const parsed = new URL(url);
    // Remove www. prefix
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    // Try regex fallback for malformed URLs
    const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

/**
 * Normalize a website URL to consistent format
 */
export function normalizeWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  
  let url = website.trim();
  
  // Add https if no protocol
  if (!url.match(/^https?:\/\//i)) {
    url = 'https://' + url;
  }
  
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return url;
  }
}
