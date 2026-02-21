/**
 * Netflix Cookie Utilities
 * Standalone helpers for parsing, validating, and formatting Netflix cookies.
 * Extracted so they can be shared by routes, workers, or scripts.
 */

export const TARGET_KEYS = [
  'NetflixId',
  'SecureNetflixId',
  'nfvdid',
  'OptanonConsent',
] as const;

export const REQUIRED_KEYS: ReadonlyArray<string> = [
  'NetflixId',
  'SecureNetflixId',
  'nfvdid',
];

export type CookieDict = Partial<Record<(typeof TARGET_KEYS)[number], string>>;

/** Build a Cookie header string from a key→value dict */
export function buildCookieString(dict: Record<string, string>): string {
  return Object.entries(dict)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/** Validate that all required cookies are present */
export function validateCookies(
  dict: Record<string, string>
): { valid: true } | { valid: false; missing: string[] } {
  const missing = REQUIRED_KEYS.filter((k) => !(k in dict));
  return missing.length === 0 ? { valid: true } : { valid: false, missing };
}

/**
 * Parse Netscape (tab-separated) cookie file content.
 * Returns an array of cookie dicts (one per valid set found).
 */
export function parseNetscapeCookies(
  content: string
): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  let current: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      const name = parts[5];
      const value = parts[6];
      if ((TARGET_KEYS as readonly string[]).includes(name)) {
        current[name] = value;
      }
    }
    const validation = validateCookies(current);
    if (validation.valid) {
      results.push({ ...current });
      current = {};
    }
  }

  return results;
}

/**
 * Parse any supported cookie format into an array of cookie dicts.
 *
 * Supported formats:
 *   1. Netscape (tab-separated)
 *   2. Browser-extension JSON [{name, value}, ...]
 *   3. Flat JSON list [{NetflixId, ...}, ...]
 *   4. Flat JSON object {NetflixId, ...}
 *   5. Raw cookie string  key=value; key=value
 */
export function extractCookieSets(
  input: string
): Record<string, string>[] {
  // ── 1. Netscape ─────────────────────────────────────────────────────────
  if (
    input.includes('\t') &&
    (input.includes('NetflixId') || input.includes('nfvdid'))
  ) {
    const results = parseNetscapeCookies(input);
    if (results.length > 0) return results;
  }

  // ── 2-4. JSON formats ───────────────────────────────────────────────────
  try {
    const data: unknown = JSON.parse(input);
    const dict: Record<string, string> = {};

    if (Array.isArray(data)) {
      if (
        data.length > 0 &&
        typeof data[0] === 'object' &&
        data[0] !== null &&
        'name' in (data[0] as object)
      ) {
        // Browser extension format
        for (const item of data as Array<{ name: string; value: string }>) {
          if ((TARGET_KEYS as readonly string[]).includes(item.name)) {
            dict[item.name] = item.value;
          }
        }
      } else {
        // Flat list — take the first entry
        const first = data[0] as Record<string, string>;
        if (first && typeof first === 'object') {
          for (const key of TARGET_KEYS) {
            if (key in first) dict[key] = first[key];
          }
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      // Flat object
      const obj = data as Record<string, string>;
      for (const key of TARGET_KEYS) {
        if (key in obj) dict[key] = obj[key];
      }
    }

    if (validateCookies(dict).valid) return [dict];
  } catch {
    // Not JSON — fall through
  }

  // ── 5. Raw cookie string ─────────────────────────────────────────────────
  const dict: Record<string, string> = {};
  const pairs = input.split(/[;\n]/);
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if ((TARGET_KEYS as readonly string[]).includes(name)) {
      dict[name] = value;
    }
  }

  return validateCookies(dict).valid ? [dict] : [];
}
