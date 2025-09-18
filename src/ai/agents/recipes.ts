import { AgentContext, AgentResult } from "./types";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import { RECIPE_SYSTEM_PROMPT } from "@/ai/prompts/recipeLogger";

function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let txt = String(raw).trim();
  txt = txt.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_m, p1) => (p1 || "").trim());
  try {
    if (/^\s*[{[]/.test(txt)) return JSON.parse(txt);
  } catch {}
  return null;
}

export async function runRecipesAgent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  model: string;
}): Promise<AgentResult> {
  const { messages, openAIApiKey, model } = args;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const userText = typeof lastUser === "string" ? lastUser : "";

  const { text } = await openAIChatCaller({
    apiKey: openAIApiKey,
    model,
    system: RECIPE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText || "Quero receitas rápidas" }],
    forceJson: true,
  });

  const obj = parseJsonLoose(text);
  if (obj) {
    return { domain: "recipes", reply: obj.reply || "Aqui estão as receitas.", data: obj };
  }
  return {
    domain: "recipes",
    reply:
      "Posso sugerir receitas — diga ingredientes disponíveis, tempo e restrições (sem lactose/glúten etc.).",
    data: null,
  };
}
