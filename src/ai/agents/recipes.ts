// src/ia/agents/recipes.ts
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
 * Agente de receitas.
 * - Gera 1–3 receitas simples baseadas no texto do usuário (ingredientes alvo, preferência, restrições).
 * - Retorna **apenas JSON** quando a LLM está disponível; caso contrário, um placeholder.
 */
export async function runRecipesAgent(
  text: string,
  ctx: AgentContext,
  llm?: LLMCaller
): Promise<AgentResult> {
  if (!llm) {
    return {
      domain: "recipes",
      reply:
        "Me diga ingredientes que você tem em casa ou o prato desejado que eu te mando 1–3 receitas fáceis.",
      data: { hint: "Ex.: 'quero receita com frango e arroz', 'receita low-carb para jantar'." },
    };
  }

  const system = `
Você é um chef prático. Retorne **APENAS JSON** no formato:

{
  "reply": "frase curta",
  "receitas": [
    {
      "titulo": "nome",
      "rendimento": "2 porções",
      "tempo_preparo_min": 0,
      "ingredientes": [ "item x", "item y", "..." ],
      "modo_de_preparo": [ "passo 1", "passo 2", "..." ],
      "macros_estimados": { "kcal": 0, "proteina_g": 0, "carbo_g": 0, "gordura_g": 0 }
    }
  ],
  "observacoes": ["dicas rápidas, substituições"]
}

Regras:
- Português do Brasil.
- Ingredientes acessíveis.
- Evite doces ultraprocessados por padrão.
- Não use markdown. Só JSON.
`.trim();

  const user =
    `Pedido de receita: "${(text || "").trim()}"` +
    (ctx?.locale ? ` | locale=${ctx.locale}` : "");

  try {
    const { content } = await llm({
      system,
      messages: [{ role: "user", content: user }],
      json: false,
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 900,
    });

    const obj = parseJsonLoose(content);
    if (obj && typeof obj === "object") {
      return {
        domain: "recipes",
        reply: obj.reply || "Aqui vão algumas receitas para você.",
        data: obj,
      };
    }
  } catch {
    /* fallback abaixo */
  }

  return {
    domain: "recipes",
    reply:
      "Posso sugerir receitas — diga os ingredientes disponíveis, tempo que você tem e se há restrições.",
    data: null,
  };
}
