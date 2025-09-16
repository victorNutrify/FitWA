import { AgentContext, AgentResult } from "./types";
import { EXERCISE_SYSTEM_PROMPT } from "@/ai/prompts/exerciseLogger";

/** Remove cercas ```...``` e tenta parsear como JSON; fallback mantém reply texto */
function parseExercisesFromLLM(rawText: string): any {
  let text = rawText || "";
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, p1) => String(p1 || "").trim());
  try {
    if (/^\s*{/.test(text)) return JSON.parse(text);
    if (/^\s*\[/.test(text)) return { exercicios: JSON.parse(text), reply: "" };
  } catch {
    return { reply: rawText };
  }
  return { reply: text };
}

/** Monta mensagens para a LLM com prompt oficial de exercícios */
function buildExerciseMessages(
  history: Array<{ role: "user" | "assistant"; content: string }>
) {
  const systemMsg = { role: "system" as const, content: EXERCISE_SYSTEM_PROMPT };

  const filtered = (Array.isArray(history) ? history : []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant")
  );
  const last6 = filtered.slice(-6);

  return [systemMsg, ...last6];
}

/** Executa o agente de exercícios. Não persiste; retorna em `data`. */
export async function runExerciseAgent(opts: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  ctx?: AgentContext;
  openAIApiKey: string;
  model?: string; // default: gpt-4o
}): Promise<AgentResult> {
  const { messages, openAIApiKey, model = "gpt-4o" } = opts;

  const payload = {
    model,
    temperature: 0.2,
    top_p: 0.95,
    max_tokens: 800,
    response_format: { type: "json_object" as const },
    messages: buildExerciseMessages(messages),
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
      return { domain: "exercise", reply: `Falha na LLM (exercise): ${errText}`, data: {} };
    }

    const data = await resp.json();
    const content = String(data?.choices?.[0]?.message?.content || "");
    const parsed = parseExercisesFromLLM(content);

    return {
      domain: "exercise",
      reply: parsed.reply || "Entendido! Registrei seus exercícios.",
      data: parsed,
    };
  } catch (e: any) {
    return {
      domain: "exercise",
      reply: `Erro de comunicação com a LLM: ${e?.message || "desconhecido"}`,
      data: {},
    };
  }
}
