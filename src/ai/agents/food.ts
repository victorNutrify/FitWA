import { AgentContext, AgentResult } from "./types";
import { FOOD_SYSTEM_PROMPT } from "@/ai/prompts/foodLogger";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";

function parseJsonLoose(rawText: string): any {
  let text = String(rawText || "");
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, p1) => String(p1 || "").trim());
  try {
    if (/^\s*{/.test(text)) return JSON.parse(text);
    if (/^\s*\[/.test(text)) return { alimentos: JSON.parse(text), reply: "" };
  } catch {
    /* ignore */
  }
  return { reply: rawText ?? "" };
}

export async function runFoodAgent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  model: string;
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, model } = args;

  // monta mensagem user (texto + opcional imagem)
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const userText = typeof lastUser === "string" ? lastUser : "";

  const contentParts: any[] = [];
  contentParts.push({ type: "text", text: userText || "Registrar refeição" });

  if (ctx.imageBase64) {
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${ctx.imageBase64}` },
    });
  }

  const { text } = await openAIChatCaller({
    apiKey: openAIApiKey,
    model,
    system: FOOD_SYSTEM_PROMPT,
    messages: [{ role: "user", content: contentParts }],
    forceJson: true,
  });

  const parsed = parseJsonLoose(text);

  return {
    domain: "food",
    reply: parsed?.reply || "Entendido! Registrei sua refeição.",
    data: parsed,
  };
}
