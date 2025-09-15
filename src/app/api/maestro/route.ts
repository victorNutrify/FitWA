// NOVO ARQUIVO: src/app/api/maestro/route.ts
import { NextRequest, NextResponse } from "next/server";
import { classifyIntentHeuristic } from "@/ia/maestro"; // ajuste o path se necessário
import { classifyIntentLLM } from "@/ia/maestro";       // ajuste o path se necessário

function getLastUserText(messages: any[]): string {
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

async function forwardToRegisterChat(origin: string, authHeader: string | null, payload: any) {
  const url = new URL("/api/register-chat", origin);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const authHeader = req.headers.get("authorization");
    let body: any = {};
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      const messagesStr = form.get("messages");
      body.messages = typeof messagesStr === "string" ? JSON.parse(messagesStr) : [];
      const imageFile: any = form.get("image");
      if (imageFile && typeof imageFile === "object" && "arrayBuffer" in imageFile) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const contentType = imageFile.type || "image/jpeg";
        body.imageBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
      } else if (typeof imageFile === "string" && imageFile.startsWith("data:image/")) {
        body.imageBase64 = imageFile;
      }
      const userEmail = form.get("userEmail");
      if (typeof userEmail === "string") body.userEmail = userEmail;
    } else {
      body = await req.json();
    }

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const hasImage = !!body.imageBase64;
    const lastText = getLastUserText(messages);

    // 1) Heurística
    let intent = classifyIntentHeuristic(lastText, { hasImage });
    // 2) Fallback pra LLM em caso de dúvida
    if (intent === "unknown") {
      intent = await classifyIntentLLM(lastText, { hasImage });
    }

    switch (intent) {
      case "food":
      case "exercise":
        // Reuso do seu endpoint que já grava no Firestore
        return await forwardToRegisterChat(origin, authHeader, body);

      case "diet":
        return NextResponse.json(
          { reply: "Ok! Vou montar seu plano de dieta. (Agente Diet será plugado aqui.)" },
          { status: 200 }
        );

      case "shopping":
        return NextResponse.json(
          { reply: "Certo! Vou gerar sua lista de compras. (Agente Shopping será plugado aqui.)" },
          { status: 200 }
        );

      case "recipe":
        return NextResponse.json(
          { reply: "Beleza! Já busco receitas. (Agente de Receitas será plugado aqui.)" },
          { status: 200 }
        );

      default:
        return NextResponse.json(
          {
            reply:
              "Não entendi bem. Você quer registrar alimentos, exercícios, pedir um plano de dieta, lista de compras ou receitas?",
          },
          { status: 200 }
        );
    }
  } catch (err: any) {
    console.error("[/api/maestro] Erro:", err);
    return NextResponse.json(
      { error: "Erro inesperado no Maestro: " + (err?.message || "") },
      { status: 500 }
    );
  }
}
