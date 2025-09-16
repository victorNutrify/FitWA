// src/ia/agents/shopping.ts
import { AgentContext, AgentResult, LLMCaller } from "./types";

function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let txt = String(raw).trim();
  txt = txt.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_m, p1) => (p1 || "").trim());
  try {
    if (/^\s*[{[]/.test(txt)) return JSON.parse(txt);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Agente de lista de compras.
 * - Constrói uma lista a partir do texto do usuário (ou futuramente do plano de dieta salvo).
 * - Se houver LLM, retorna um JSON com itens, quantidades e seção do mercado.
 */
export async function runShoppingAgent(
  text: string,
  ctx: AgentContext,
  llm?: LLMCaller
): Promise<AgentResult> {
  if (!llm) {
    return {
      domain: "shopping",
      reply:
        "Diga para quantos dias e quais refeições você quer cobrir que eu monto uma lista de compras.",
      data: { hint: "Ex.: 'lista para 5 dias, almoço e jantar, low-carb'." },
    };
  }

  const system = `
Você é um assistente de compras. Retorne **APENAS JSON** no formato:

{
  "reply": "frase curta",
  "dias_planejados": 5,
  "itens": [
    { "item": "Peito de frango", "quantidade": 1.2, "unidade": "kg", "sessao": "açougue" },
    { "item": "Arroz integral", "quantidade": 2, "unidade": "kg", "sessao": "grãos" },
    { "item": "Ovos", "quantidade": 30, "unidade": "un", "sessao": "laticínios" }
  ],
  "observacoes": ["ajustes de marca/tamanho ok"]
}

Regras:
- Português BR.
- Agrupe mentalmente por sessão do mercado (açougue, hortifruti, laticínios, grãos, congelados, mercearia, bebidas).
- Não invente marcas.
- Não use markdown. Somente JSON.
`.trim();

  const user =
    `Pedido de compras: "${(text || "").trim()}"` +
    (ctx?.locale ? ` | locale=${ctx.locale}` : "");

  try {
    const { content } = await llm({
      system,
      messages: [{ role: "user", content: user }],
      json: false,
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
    });

    const obj = parseJsonLoose(content);
    if (obj && typeof obj === "object") {
      return {
        domain: "shopping",
        reply: obj.reply || "Sua lista de compras está pronta.",
        data: obj,
      };
    }
  } catch {
    /* fallback abaixo */
  }

  return {
    domain: "shopping",
    reply:
      "Me diga por quantos dias e para quais refeições quer comprar; eu retorno a lista organizada.",
    data: null,
  };
}
