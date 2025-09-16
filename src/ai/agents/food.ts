import { AgentContext, AgentResult } from "./types";
import { FOOD_SYSTEM_PROMPT } from "@/ai/prompts/foodLogger";

/** Remove cercas ```...``` e tenta parsear como JSON; fallback mantém reply texto */
function parseMacrosFromLLM(rawText: string): any {
  let text = rawText || "";
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, p1) => String(p1 || "").trim());
  try {
    if (/^\s*{/.test(text)) return JSON.parse(text);
    if (/^\s*\[/.test(text)) return { alimentos: JSON.parse(text), reply: "" };
  } catch {
    return { reply: rawText };
  }
  return { reply: text };
}

/** Monta mensagens para a LLM usando seu prompt oficial; suporta imagem */
function buildFoodMessages(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  imageBase64?: string
) {
  const systemMsg = { role: "system" as const, content: FOOD_SYSTEM_PROMPT };

  const filtered = (Array.isArray(history) ? history : []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant")
  );
  const last6 = filtered.slice(-6);

  if (imageBase64) {
    // Mensagem multimodal (compatível com GPT-4o/4.1)
    const visionMsg: any = {
      role: "user",
      content: [
        { type: "text", text: "Analise a imagem da refeição e retorne SOMENTE o JSON conforme instruções." },
        { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
      ],
    };
    return [systemMsg, ...last6, visionMsg] as any[];
  }

  return [systemMsg, ...last6];
}

/** Executa o agente de alimentos. Não persiste; retorna as ações em `data`. */
export async function runFoodAgent(opts: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  ctx?: AgentContext;
  openAIApiKey: string;
  model?: string; // default: gpt-4o
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, model = "gpt-4o" } = opts;

  const payload: any = {
    model,
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: 1200,
    response_format: { type: "json_object" as const },
    messages: buildFoodMessages(messages, ctx?.hasImage ? ctx?.imageBase64 : undefined),
  };

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { domain: "food", reply: `Falha na LLM (food): ${errText}`, data: {} };
    }

    const data = await resp.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    const parsed = parseMacrosFromLLM(content);

    return {
      domain: "food",
      reply: parsed.reply || "Entendido! Registrei sua refeição.",
      data: parsed,
    };
  } catch (e: any) {
    return {
      domain: "food",
      reply: `Erro de comunicação com a LLM: ${e?.message || "desconhecido"}`,
      data: {},
    };
  }
}
