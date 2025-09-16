// src/app/api/agent/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import { routeIntent } from "@/ai/agents/maestro";
import type { AgentContext } from "@/ai/agents/types";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Garante que é um array de mensagens no formato { role, content } */
function normalizeMessages(raw: any): Array<{ role: "user" | "assistant" | "system"; content: any }> {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m) => m && typeof m === "object")
    .map((m) => {
      const role = (m.role === "user" || m.role === "assistant" || m.role === "system") ? m.role : "user";
      // Aceita tanto string quanto { text }
      let content = m.content;
      if (content && typeof content === "object" && "text" in content) content = String(content.text);
      if (typeof content !== "string") content = String(content ?? "");
      return { role, content };
    });
}

/** Extrai último texto do usuário (para heurística, se precisar) */
function extractLastUserText(messages: any[]): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (m?.content?.text) return String(m.content.text);
    }
  }
  return "";
}

/** Tenta identificar o e-mail a partir do ID token (Authorization: Bearer <token>) */
async function getUserEmailFromAuthHeader(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded?.email ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    let messagesRaw: any = null;
    let imageBase64: string | undefined;

    // 1) Aceita multipart/form-data (imagem opcional)
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const m = form.get("messages");
      if (typeof m === "string") {
        try { messagesRaw = JSON.parse(m); } catch { messagesRaw = []; }
      } else if (Array.isArray(m)) {
        messagesRaw = m;
      }

      const image: any = form.get("image");
      if (image && typeof image === "object" && "arrayBuffer" in image) {
        const buf = Buffer.from(await image.arrayBuffer());
        if (buf.length > 5 * 1024 * 1024) {
          return NextResponse.json({ ok: false, error: "Imagem muito grande (>5MB)." }, { status: 413 });
        }
        const contentType = (image.type as string) || "image/jpeg";
        imageBase64 = `data:${contentType};base64,${buf.toString("base64")}`;
      } else if (typeof image === "string" && image.startsWith("data:image/")) {
        // string base64 direta
        const approxSize = Math.floor((image.length * 3) / 4);
        if (approxSize > 5 * 1024 * 1024) {
          return NextResponse.json({ ok: false, error: "Imagem muito grande (>5MB)." }, { status: 413 });
        }
        imageBase64 = image;
      }
    } else {
      // 2) Aceita application/json
      const body = await req.json().catch(() => ({}));
      messagesRaw = body?.messages ?? null;
      if (typeof body?.imageBase64 === "string") imageBase64 = body.imageBase64;
    }

    const messages = normalizeMessages(messagesRaw);

    // Se ainda não vieram mensagens válidas, devolve 400
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Campo 'messages' ausente ou inválido (esperado array com {role, content})." },
        { status: 400 }
      );
    }

    // Tenta obter email do token, ou de um campo opcional embutido nas messages
    const tokenEmail = await getUserEmailFromAuthHeader(req);
    const inlineEmail =
      messages.find((m: any) => m?.userEmail)?.userEmail ||
      messages.find((m: any) => m?.email)?.email ||
      null;

    const userEmail = tokenEmail || inlineEmail || "anon@local";

    const ctx: AgentContext = {
      userEmail,
      hasImage: Boolean(imageBase64),
      imageBase64,
      nowISO: new Date().toISOString(),
      locale: "pt-BR",
    };

    const result = await routeIntent({
      messages,
      ctx,
      openAIApiKey: process.env.OPENAI_API_KEY || "",
      caller: openAIChatCaller,
    });

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
    return NextResponse.json({ ok: false, error: err?.message || "Erro inesperado." }, { status: 500 });
  }
}
