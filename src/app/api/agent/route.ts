// src/app/api/agent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { routeIntent } from "@/ia/agents/maestro";
import type { AgentContext } from "@/ia/agents/types";
import { openAIChatCaller } from "@/ia/clients/openaiCaller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lastUserText(messages: any[]): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (m?.content?.text && typeof m.content.text === "string") return m.content.text;
    }
  }
  return "";
}

async function resolveUserEmail(req: NextRequest, body: any): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (idToken) {
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      if (decoded?.email) return decoded.email;
    } catch (e) {
      console.warn("[/api/agent] Falha ao verificar ID token:", e);
    }
  }

  if (body?.userEmail && String(body.userEmail).includes("@")) {
    return String(body.userEmail);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages = [], hasImage = false, userEmail: userEmailBody } = body || {};

    const userEmail = await resolveUserEmail(req, { userEmail: userEmailBody });
    if (!userEmail) {
      return NextResponse.json(
        { error: "Usuário não autenticado. Envie Authorization: Bearer <ID_TOKEN>." },
        { status: 401 }
      );
    }

    const inputText = lastUserText(messages);

    const now = new Date();
    const nowISO =
      new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 19) + "-03:00";

    const ctx: AgentContext = {
      userEmail,
      hasImage: !!hasImage,
      nowISO,
      locale: "pt-BR",
    };

    const result = await routeIntent(inputText, ctx, openAIChatCaller);

    return NextResponse.json(
      {
        ok: true,
        domain: result.domain,
        reply: result.reply || "",
        data: result.data || null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/agent] Erro:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Erro inesperado." },
      { status: 500 }
    );
  }
}
