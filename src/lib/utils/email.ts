/**
 * Email validation utilities
 * Migrated from wonnda_archive: sql/il/il_tradeshow_companies.sql
 */

/**
 * Blacklist of private email providers
 * Business emails should NOT come from these domains
 */
const PRIVATE_EMAIL_PROVIDERS = [
  'gmail',
  'yahoo',
  'hotmail',
  'outlook',
  'aol',
  'icloud',
  'proton',
  'protonmail',
  'zoho',
  'yandex',
  'mail',
  'gmx',
  'live',
  'msn',
  'inbox',
  'rediff',
  'web.de',
  't-online',
  'freenet',
  'googlemail',
];

/**
 * Basic email format validation
 */
export function isValidEmailFormat(email: string | null | undefined): boolean {
  if (!email) return false;
  
  // Basic regex for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Check if email is from a business domain (not private provider)
 */
export function isBusinessEmail(email: string | null | undefined): boolean {
  if (!email || !isValidEmailFormat(email)) return false;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  
  // Check if domain contains any private provider
  return !PRIVATE_EMAIL_PROVIDERS.some(provider => 
    domain.includes(provider)
  );
}

/**
 * Validate and clean email
 * Returns null if invalid or from private provider
 */
export function validateEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  const cleaned = email.trim().toLowerCase();
  
  if (!isValidEmailFormat(cleaned)) return null;
  if (!isBusinessEmail(cleaned)) return null;
  
  return cleaned;
}
