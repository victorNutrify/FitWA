import { AgentContext, AgentResult } from "./types";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";

const SHOPPING_PROMPT = `
Você gera **somente JSON** com uma lista de compras organizada em seções.
Formato:
{
  "reply": "string curta",
  "lista": [
    { "item": "Arroz integral", "quantidade": "1 kg", "secao": "Grãos" },
    { "item": "Peito de frango", "quantidade": "1.2 kg", "secao": "Carnes" }
  ],
  "dias": number,
  "refeicoes_por_dia": number
}
Nunca use marcas.
`;

function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let txt = String(raw).trim();
  txt = txt.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_m, p1) => (p1 || "").trim());
  try {
    if (/^\s*[{[]/.test(txt)) return JSON.parse(txt);
  } catch {}
  return null;
}

export async function runShoppingAgent(args: {
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
    system: SHOPPING_PROMPT,
    messages: [{ role: "user", content: userText || "Lista de compras para 7 dias e 5 refeições/dia" }],
    forceJson: true,
  });

  const obj = parseJsonLoose(text);
  if (obj) {
    return { domain: "shopping", reply: obj.reply || "Lista gerada.", data: obj };
  }
  return {
    domain: "shopping",
    reply:
      "Diga por quantos dias e quantas refeições/dia quer comprar; gera(rei) a lista sem marcas.",
    data: null,
  };
}
