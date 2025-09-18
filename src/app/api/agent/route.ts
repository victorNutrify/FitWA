// src/app/api/agent/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { routeIntent } from "@/ai/agents/maestro";
import type { AgentContext } from "@/ai/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tryJsonParse<T = any>(s: any): T | null {
  if (s == null) return null;
  if (typeof s === "object") return s as T;
  if (typeof s !== "string") return null;
  const txt = s.trim();
  if (!txt) return null;
  try { return JSON.parse(txt) as T; } catch { return null; }
}

function normalizeMessages(raw: any): Array<{ role: "user" | "assistant" | "system"; content: any }> {
  let data = raw;
  const parsed = tryJsonParse<any>(raw);
  if (parsed) data = parsed;

  if (Array.isArray(data)) {
    return data
      .filter((m) => m && (m.role === "user" || m.role === "assistant" || m.role === "system"))
      .map((m) => ({ role: m.role, content: m.content ?? "" }));
  }

  if (data && Array.isArray((data as any).messages)) {
    return (data as any).messages
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant" || m.role === "system"))
      .map((m: any) => ({ role: m.role, content: m.content ?? "" }));
  }

  return [];
}

export async function POST(req: NextRequest) {
  try {
    const openAIApiKey = process.env.OPENAI_API_KEY;
    if (!openAIApiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY ausente no servidor." }, { status: 500 });
    }

    const ctype = (req.headers.get("content-type") || "").toLowerCase();

    let messages: Array<{ role: "user" | "assistant" | "system"; content: any }> = [];
    let imageBase64: string | undefined;
    let body: any = {};

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const messagesField = form.get("messages");
      imageBase64 = typeof form.get("imageBase64") === "string" ? (form.get("imageBase64") as string) : undefined;
      messages = normalizeMessages(messagesField);
      // tentamos também extrair userEmail do form (se existir)
      const emailField = form.get("userEmail");
      if (typeof emailField === "string") body.userEmail = emailField;
    } else if (ctype.includes("application/json")) {
      try { body = await req.json(); }
      catch {
        const txt = await req.text().catch(() => "");
        body = tryJsonParse(txt) ?? {};
      }
      imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : undefined;
      messages = normalizeMessages(body);
      if (messages.length === 0) messages = normalizeMessages(body?.messages);
    } else {
      const txt = await req.text().catch(() => "");
      const maybeKV = Object.fromEntries(new URLSearchParams(txt));
      const candidate = maybeKV?.messages ?? txt;
      messages = normalizeMessages(candidate);
      if (maybeKV?.userEmail) body.userEmail = maybeKV.userEmail;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Campo 'messages' ausente ou inválido (esperado array de objetos {role, content}).",
          hint: "Exemplo: { \"messages\": [ { \"role\": \"user\", \"content\": \"texto\" } ] }",
        },
        { status: 400 }
      );
    }

    // Contexto do usuário: token OU fallback em dev com userEmail do body
    const authHeader = req.headers.get("Authorization");
    let userEmail = (typeof body?.userEmail === "string" && body.userEmail) || "anon@local";

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      try {
        const decoded = await getAuth().verifyIdToken(token);
        userEmail = decoded?.email || userEmail;
      } catch {
        // segue com fallback/body
      }
    }

    const ctx: AgentContext = {
      userEmail,
      hasImage: !!imageBase64,
      imageBase64,
      nowISO: new Date().toISOString(),
      locale: "pt-BR",
    };

    const result = await routeIntent({
      messages,
      ctx,
      openAIApiKey,
      modelFood: "gpt-5",
      modelExercise: "gpt-5",
      modelDiet: "gpt-5",
      modelRecipes: "gpt-5",
      modelShopping: "gpt-5",
      routerModel: "gpt-5",
    });

    return NextResponse.json(
      { ok: true, domain: result.domain, reply: result.reply || "", data: result.data ?? null },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/agent] Erro:", err?.stack || err?.message || err);
    const msg = typeof err?.message === "string" ? err.message : "Erro inesperado.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
