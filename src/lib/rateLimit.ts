// src/lib/rateLimit.ts
type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

export function rateLimitKey(ipOrUid: string, scope = "global") {
  return `${scope}:${ipOrUid}`;
}

/**
 * Limita requests por janela de tempo.
 * @returns { allowed, remaining, retryAfter }
 */
export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (existing.count < limit) {
    existing.count += 1;
    return {
      allowed: true,
      remaining: limit - existing.count,
      retryAfter: 0,
    };
  }

  const retryAfter = Math.max(0, Math.ceil((existing.resetAt - now) / 1000));
  return { allowed: false, remaining: 0, retryAfter };
}
