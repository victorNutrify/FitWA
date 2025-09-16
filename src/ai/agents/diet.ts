// src/ia/agents/diet.ts
import { AgentContext, AgentResult, LLMCaller } from "./types";

/**
 * Pequeno utilitário para parsear JSON vindo da LLM (removendo ```json ... ``` se houver).
 */
function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let txt = String(raw).trim();
  // remove cercas de código
  txt = txt.replace(/```(?:json)?\s*([\s\S]*?)```/gi, (_m, p1) => (p1 || "").trim());
  try {
    if (/^\s*[{[]/.test(txt)) return JSON.parse(txt);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Agente de plano de dieta.
 * - Nesta versão: gera um "esqueleto" de plano de 1 dia via LLM (se disponível),
 *   com refeições, horário sugerido e macros estimados.
 * - Caso não haja LLM, retorna placeholder amigável.
 */
export async function runDietAgent(
  text: string,
  ctx: AgentContext,
  llm?: LLMCaller
): Promise<AgentResult> {
  // Sem LLM: resposta simples
  if (!llm) {
    return {
      domain: "diet",
      reply:
        "Posso montar seu plano de dieta. Diga seu objetivo (ex.: cutting/bulking/manutenção), calorias alvo e restrições.",
      data: {
        hint:
          "Informe calorias/metas, restrições (ex.: sem lactose), número de refeições e horários preferidos.",
      },
    };
  }

  // Com LLM: pede um JSON simples com plano do dia
  const system = `
Você é um nutricionista. Gere um PLANO DIÁRIO de dieta enxuto **APENAS EM JSON** no formato:

{
  "reply": "frase curta para o usuário",
  "meta": { "objetivo": "...", "calorias_alvo": <number> },
  "refeicoes": [
    { "tipo": "café da manhã", "hora": "07:30", "itens": ["...","..."], "kcal": 0, "proteina_g": 0, "carbo_g": 0, "gordura_g": 0 },
    { "tipo": "almoço",        "hora": "12:30", "itens": ["...","..."], "kcal": 0, "proteina_g": 0, "carbo_g": 0, "gordura_g": 0 },
    { "tipo": "lanche",        "hora": "16:00", "itens": ["..."],      "kcal": 0, "proteina_g": 0, "carbo_g": 0, "gordura_g": 0 },
    { "tipo": "jantar",        "hora": "19:30", "itens": ["...","..."], "kcal": 0, "proteina_g": 0, "carbo_g": 0, "gordura_g": 0 }
  ],
  "observacoes": ["..."]
}

Regras:
- Português do Brasil.
- Itens simples e fáceis de achar.
- Se o usuário não informou meta, assuma manutenção e ~30g proteína por refeição.
- Não use markdown. Somente JSON.
`.trim();

  const user =
    `Entrada do usuário: "${(text || "").trim()}"` +
    (ctx?.locale ? ` | locale=${ctx.locale}` : "") +
    (ctx?.nowISO ? ` | agora=${ctx.nowISO}` : "");

  try {
    const { content } = await llm({
      system,
      messages: [{ role: "user", content: user }],
      json: false, // retornamos string e parseamos manualmente
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 800,
    });

    const obj = parseJsonLoose(content);
    if (obj && typeof obj === "object") {
      return {
        domain: "diet",
        reply: obj.reply || "Plano de dieta gerado.",
        data: obj,
      };
    }
  } catch {
    // cai no fallback abaixo
  }

  // Fallback amigável
  return {
    domain: "diet",
    reply:
      "Monte comigo seu plano: diga objetivo (ex.: cutting), calorias alvo e se tem alguma restrição alimentar.",
    data: null,
  };
}
