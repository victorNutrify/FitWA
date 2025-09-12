// src/lib/auth.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, adminDb } from "./firebase.admin";
import { rateLimit, rateLimitKey } from "./rateLimit";

export type AuthedUser = {
  uid: string;
  email?: string;
  name?: string;
};

export function getIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.ip ||
    "0.0.0.0"
  );
}

export function getBearerToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}

export async function getUserFromRequest(
  req: NextRequest
): Promise<AuthedUser | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  } catch (err) {
    return null;
  }
}

export type GuardOptions = {
  scope?: string; // para diferenciar rotas no limiter
  limit?: number; // req por janela
  windowMs?: number; // ms da janela
  requireAuth?: boolean; // default true
};

export function withAuthAndRateLimit<T extends (...args: any[]) => any>(
  handler: T,
  opts: GuardOptions = {}
) {
  const {
    scope = "api",
    limit = 60,
    windowMs = 60_000,
    requireAuth = true,
  } = opts;

  return async function guarded(
    req: NextRequest,
    ...rest: any[]
  ): Promise<ReturnType<T>> {
    // Rate limit (usa uid quando disponível, senão IP)
    const user = await getUserFromRequest(req);
    const key = rateLimitKey(user?.uid || getIp(req), scope);
    const r = rateLimit(key, limit, windowMs);
    if (!r.allowed) {
      return NextResponse.json(
        { error: "Too Many Requests", retryAfter: r.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(r.retryAfter) },
        }
      ) as any;
    }

    if (requireAuth && !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as any;
    }

    // injeta usuário em request via header (simples) — ou passe por parâmetro
    const headers = new Headers(req.headers);
    if (user) {
      headers.set("x-user-uid", user.uid);
      if (user.email) headers.set("x-user-email", user.email);
    }
    const reqWithUser = new NextRequest(req.url, {
      method: req.method,
      headers,
      body: req.body,
      duplex: "half",
    });

    return handler(reqWithUser, ...rest);
  };
}
