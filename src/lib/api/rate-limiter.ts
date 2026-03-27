import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window in seconds */
  windowSeconds: number;
}

export type RateLimitPreset = keyof typeof PRESETS;

// ─── Presets ──────────────────────────────────────────────────────────────────

export const PRESETS = {
  standard: { limit: 60, windowSeconds: 60 },
  ai:       { limit: 10, windowSeconds: 60 },
  auth:     { limit: 20, windowSeconds: 60 },
  upload:   { limit: 10, windowSeconds: 60 },
  billing:  { limit: 5,  windowSeconds: 60 },
  sms:      { limit: 10, windowSeconds: 60 },
} as const;

// ─── Upstash Redis rate limiter (production) ──────────────────────────────────

let _upstashLimiter: UpstashLimiter | null = null;
let _upstashInitAttempted = false;

interface UpstashLimiter {
  limit: (key: string, config: RateLimitConfig) => Promise<{ success: boolean; reset: number; remaining: number }>;
}

function getUpstashLimiter(): UpstashLimiter | null {
  if (_upstashInitAttempted) return _upstashLimiter;
  _upstashInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limiter] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. ' +
        'Falling back to in-memory rate limiting (not effective in serverless). ' +
        'Set these env vars in Vercel dashboard → Settings → Environment Variables.'
      );
    }
    return null;
  }

  try {
    // Lazy import — only runs when env vars are present
    const { Redis } = require('@upstash/redis');
    const { Ratelimit } = require('@upstash/ratelimit');

    const redis = new Redis({ url, token });

    // We create limiters per config on demand
    const limiterCache = new Map<string, unknown>();

    _upstashLimiter = {
      async limit(key: string, config: RateLimitConfig) {
        const cacheKey = `${config.limit}:${config.windowSeconds}`;
        if (!limiterCache.has(cacheKey)) {
          limiterCache.set(
            cacheKey,
            new Ratelimit({
              redis,
              limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
              analytics: false,
            })
          );
        }
        const ratelimit = limiterCache.get(cacheKey) as {
          limit: (key: string) => Promise<{ success: boolean; reset: number; remaining: number }>;
        };
        return ratelimit.limit(key);
      },
    };

    return _upstashLimiter;
  } catch (err) {
    console.error('[rate-limiter] Failed to initialize Upstash:', err);
    return null;
  }
}

// ─── In-memory fallback (local dev / cold starts without Redis) ───────────────

interface MemEntry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, MemEntry>();
let lastCleanup = Date.now();

function memCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (entry.resetAt < now) memStore.delete(key);
  }
}

function memCheckRateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; reset: number; remaining: number } {
  memCleanup();
  const now = Date.now();
  let entry = memStore.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + config.windowSeconds * 1000 };
    memStore.set(key, entry);
    return { success: true, reset: entry.resetAt, remaining: config.limit - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, config.limit - entry.count);
  return {
    success: entry.count <= config.limit,
    reset: entry.resetAt,
    remaining,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check rate limit and return a NextResponse (429) if exceeded, or null if OK.
 *
 * Uses Upstash Redis sliding-window when UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN are set (required in Vercel production).
 * Falls back to in-memory store otherwise (local dev only — not effective
 * across serverless instances).
 *
 * @param identifier - Unique caller ID (uid, IP, companyId)
 * @param route      - Route name for key scoping (e.g. "/api/auth/signup")
 * @param preset     - Preset name or custom { limit, windowSeconds }
 */
export async function checkRateLimit(
  identifier: string,
  route: string,
  preset: RateLimitPreset | RateLimitConfig = 'standard'
): Promise<NextResponse | null> {
  const config: RateLimitConfig =
    typeof preset === 'string' ? PRESETS[preset] : preset;

  const key = `rl:${route}:${identifier}`;

  let result: { success: boolean; reset: number; remaining: number };

  const upstash = getUpstashLimiter();
  if (upstash) {
    try {
      result = await upstash.limit(key, config);
    } catch (err) {
      // Redis unavailable — fail open (allow request) and log
      console.error('[rate-limiter] Upstash error, failing open:', err);
      return null;
    }
  } else {
    result = memCheckRateLimit(key, config);
  }

  if (!result.success) {
    const retryAfter = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(config.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
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
export function getCallerIdentifier(request: Request, uid?: string): string {
  if (uid) return uid;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'anonymous';
}
