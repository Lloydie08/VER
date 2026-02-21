/**
 * Netflix NFToken Generator
 * Directly calls Netflix's own GraphQL API to generate a watch link token.
 * No third-party proxy (e.g. makizig) needed.
 *
 * POST /api/netflix/generate-token
 * Body: { cookies: string | object | array }
 *
 * Supported cookie formats:
 *   - Browser extension JSON  (Cookie-Editor / EditThisCookie export)
 *   - Netscape tab-separated format
 *   - Raw cookie string  (key=value; key=value)
 *   - Flat JSON object   { NetflixId: "...", ... }
 *   - Flat JSON list     [{ NetflixId: "...", ... }]
 *
 * Required keys: NetflixId, SecureNetflixId, nfvdid
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

const NETFLIX_GRAPHQL_URL = 'https://android13.prod.ftl.netflix.com/graphql';

const BASE_HEADERS: Record<string, string> = {
  'User-Agent':
    'com.netflix.mediaclient/63884 (Linux; U; Android 13; ro; M2007J3SG; Build/TQ1A.230205.001.A2; Cronet/143.0.7445.0)',
  Accept:
    'multipart/mixed;deferSpec=20220824, application/graphql-response+json, application/json',
  'Content-Type': 'application/json',
  Origin: 'https://www.netflix.com',
  Referer: 'https://www.netflix.com/',
};

const TARGET_KEYS = ['NetflixId', 'SecureNetflixId', 'nfvdid', 'OptanonConsent'];
const REQUIRED_KEYS = ['NetflixId', 'SecureNetflixId', 'nfvdid'];

// GraphQL persisted-query payload — mirrors the Python script exactly
const GQL_PAYLOAD = {
  operationName: 'CreateAutoLoginToken',
  variables: { scope: 'WEBVIEW_MOBILE_STREAMING' },
  extensions: {
    persistedQuery: {
      version: 102,
      id: '76e97129-f4b5-41a0-a73c-12e674896849',
    },
  },
};

// ── Cookie Parsing ───────────────────────────────────────────────────────────

function buildCookieString(dict: Record<string, string>): string {
  return Object.entries(dict)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

/**
 * Parse any supported cookie format into a flat key→value dict.
 * Returns null if required keys are missing.
 */
function parseCookies(
  input: string | object | unknown[]
): Record<string, string> | null {
  const dict: Record<string, string> = {};

  const raw =
    typeof input === 'string' ? input : JSON.stringify(input);

  // ── 1. Netscape (tab-separated) ──────────────────────────────────────────
  if (
    typeof raw === 'string' &&
    raw.includes('\t') &&
    (raw.includes('NetflixId') || raw.includes('nfvdid'))
  ) {
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      if (parts.length >= 7) {
        const name = parts[5];
        const value = parts[6];
        if (TARGET_KEYS.includes(name)) dict[name] = value;
      }
    }
    const missing = REQUIRED_KEYS.filter((k) => !(k in dict));
    if (missing.length === 0) return dict;
    // Fall through to other parsers if this didn't work
    Object.keys(dict).forEach((k) => delete dict[k]);
  }

  // ── 2. JSON formats ──────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    parsed = null;
  }

  if (parsed !== null && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      if (
        parsed.length > 0 &&
        typeof parsed[0] === 'object' &&
        parsed[0] !== null &&
        'name' in (parsed[0] as object) &&
        'value' in (parsed[0] as object)
      ) {
        // Browser extension export: [{name, value}, ...]
        for (const item of parsed as Array<{ name: string; value: string }>) {
          if (TARGET_KEYS.includes(item.name)) dict[item.name] = item.value;
        }
      } else {
        // Flat JSON list: [{NetflixId, ...}, ...]
        const first = parsed[0] as Record<string, string> | undefined;
        if (first) {
          for (const key of TARGET_KEYS) {
            if (key in first) dict[key] = first[key];
          }
        }
      }
    } else {
      // Flat JSON object: {NetflixId: "...", ...}
      const obj = parsed as Record<string, string>;
      for (const key of TARGET_KEYS) {
        if (key in obj) dict[key] = obj[key];
      }
    }
  }

  if (REQUIRED_KEYS.every((k) => k in dict)) return dict;
  Object.keys(dict).forEach((k) => delete dict[k]);

  // ── 3. Raw cookie string: key=value; key=value ───────────────────────────
  const patterns: RegExp[] = [
    /NetflixId=([^;\s]+)/,
    /SecureNetflixId=([^;\s]+)/,
    /nfvdid=([^;\s]+)/,
    /OptanonConsent=([^;\s]+)/,
  ];

  const names = ['NetflixId', 'SecureNetflixId', 'nfvdid', 'OptanonConsent'];
  for (let i = 0; i < patterns.length; i++) {
    const match = raw.match(patterns[i]);
    if (match) dict[names[i]] = match[1];
  }

  const missing = REQUIRED_KEYS.filter((k) => !(k in dict));
  if (missing.length > 0) return null;

  return dict;
}

// ── Route Handler ────────────────────────────────────────────────────────────

/**
 * POST /api/netflix/generate-token
 *
 * Body (JSON):
 *   {
 *     cookies: string | object | array   // any supported cookie format
 *   }
 *
 * Success response:
 *   { success: true, token: string, watchLink: string }
 *
 * Error response:
 *   { success: false, error: string, details?: unknown }
 */
router.post('/generate-token', async (req: Request, res: Response) => {
  try {
    const { cookies } = req.body as { cookies?: unknown };

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Request body must include a "cookies" field.',
      });
    }

    // Parse cookies from whatever format was supplied
    const cookieDict = parseCookies(
      typeof cookies === 'string' ? cookies : (cookies as object)
    );

    if (!cookieDict) {
      const missingList = REQUIRED_KEYS.join(', ');
      return res.status(400).json({
        success: false,
        error: `Could not find required Netflix cookies. Ensure your input contains: ${missingList}`,
      });
    }

    // Call Netflix GraphQL directly
    const response = await fetch(NETFLIX_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        ...BASE_HEADERS,
        Cookie: buildCookieString(cookieDict),
      },
      body: JSON.stringify(GQL_PAYLOAD),
      // @ts-ignore -- node-fetch / native fetch compatibility
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        success: false,
        error: `Netflix API returned HTTP ${response.status}`,
        details: text.slice(0, 400),
      });
    }

    const data = (await response.json()) as {
      data?: { createAutoLoginToken?: string };
      errors?: unknown[];
    };

    if (data?.data?.createAutoLoginToken) {
      const token = data.data.createAutoLoginToken;
      return res.json({
        success: true,
        token,
        watchLink: `https://netflix.com/?nftoken=${token}`,
      });
    }

    if (data?.errors) {
      return res.status(422).json({
        success: false,
        error: 'Netflix API returned errors',
        details: data.errors,
      });
    }

    return res.status(502).json({
      success: false,
      error: 'Unexpected response from Netflix GraphQL API',
      details: data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout =
      message.includes('timeout') || message.includes('TimeoutError');
    return res.status(isTimeout ? 504 : 500).json({
      success: false,
      error: isTimeout ? 'Request to Netflix API timed out' : message,
    });
  }
});

export default router;
