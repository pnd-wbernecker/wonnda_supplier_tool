/**
 * Company hash generation for deduplication
 * Migrated from wonnda_archive: FARM_FINGERPRINT(domain OR name)
 */

/**
 * Compute a deterministic hash for a company
 * Used as the deduplication key
 * 
 * @param domain - Company domain (preferred)
 * @param name - Company name (fallback if no domain)
 * @returns Hash string
 */
export async function computeCompanyHash(
  domain: string | null | undefined, 
  name: string
): Promise<string> {
  const input = (domain || name).toLowerCase().trim();
  
  // Use SubtleCrypto for consistent hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Return first 16 chars for readability (still unique enough)
  return hashHex.substring(0, 16);
}

/**
 * Synchronous hash for cases where async isn't practical
 * Uses simple djb2 algorithm
 */
export function computeCompanyHashSync(
  domain: string | null | undefined, 
  name: string
): string {
  const input = (domain || name).toLowerCase().trim();
  
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and ensure positive
  return Math.abs(hash).toString(16).padStart(8, '0');
}
