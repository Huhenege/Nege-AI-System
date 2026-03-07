import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSeconds: number;
}

const PRESETS = {
  standard: { limit: 60, windowSeconds: 60 },
  ai: { limit: 10, windowSeconds: 60 },
  auth: { limit: 20, windowSeconds: 60 },
  upload: { limit: 10, windowSeconds: 60 },
  billing: { limit: 5, windowSeconds: 60 },
  sms: { limit: 10, windowSeconds: 60 },
} as const;

export type RateLimitPreset = keyof typeof PRESETS;

function getKey(identifier: string, route: string) {
  return `${identifier}:${route}`;
}

/**
 * Check rate limit and return a NextResponse if exceeded, or null if OK.
 * Call at the top of each API route handler.
 *
 * @param identifier - Unique caller ID (e.g. uid, IP, companyId)
 * @param route - Route name for scoping (e.g. "/api/assistant/chat")
 * @param preset - Preset config name or custom config
 */
export function checkRateLimit(
  identifier: string,
  route: string,
  preset: RateLimitPreset | RateLimitConfig = 'standard'
): NextResponse | null {
  cleanup();

  const config = typeof preset === 'string' ? PRESETS[preset] : preset;
  const key = getKey(identifier, route);
  const now = Date.now();

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + config.windowSeconds * 1000 };
    store.set(key, entry);
    return null;
  }

  entry.count++;

  if (entry.count > config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

/**
 * Extract a usable identifier from a request.
 * Prefers auth uid, falls back to IP, then "anonymous".
 */
export function getCallerIdentifier(
  request: Request,
  uid?: string
): string {
  if (uid) return uid;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'anonymous';
}
