// src/ia/agents/maestro.ts
import { AgentContext, AgentDomain, AgentResult, LLMCaller } from "./types";

// ==== Heurísticas simples ====
export function classifyIntentHeuristic(
  text: string,
  opts?: { hasImage?: boolean }
): AgentDomain {
  const tRaw = (text || "").trim();
  if (!tRaw) return "unknown";

  const t = tRaw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (opts?.hasImage) return "food";

  if (/\b(comi|bebi|tomei|almocei|jantei|lanchei)\b/.test(t)) return "food";
  if (/\b(treinei|musculacao|corrida|caminhei|yoga|pilates)\b/.test(t)) return "exercise";
  if (/\b(dieta|plano|cardapio|cutting|bulking)\b/.test(t)) return "diet";
  if (/\b(lista de compras|mercado|feira|supermercado)\b/.test(t)) return "shopping";
  if (/\b(receita|como fazer|modo de preparo|ingredientes)\b/.test(t)) return "recipes";

  return "unknown";
}

// ==== Classificação via LLM ====
export async function classifyIntentLLM(
  text: string,
  llm: LLMCaller
): Promise<AgentDomain> {
  const system =
    "Você classifica intenções do usuário em 'food', 'exercise', 'diet', 'recipes', 'shopping' ou 'unknown'. Responda apenas com uma dessas palavras.";

  const { content } = await llm({
    system,
    messages: [{ role: "user", content: text }],
    json: false,
    temperature: 0.0,
    max_tokens: 5,
    model: "gpt-4o-mini", // ou 'gpt-5-nano' se você tiver roteado
  });

  const label = (content || "").trim().toLowerCase();
  const allowed: AgentDomain[] = ["food", "exercise", "diet", "recipes", "shopping", "unknown"];
  return (allowed as string[]).includes(label) ? (label as AgentDomain) : "unknown";
}

// ==== Roteamento Maestro ====
export async function routeIntent(
  inputText: string,
  ctx: AgentContext,
  llm?: LLMCaller
): Promise<AgentResult> {
  let domain = classifyIntentHeuristic(inputText, { hasImage: ctx.hasImage });

  if (domain === "unknown" && llm) {
    try {
      domain = await classifyIntentLLM(inputText, llm);
    } catch (e) {
      console.warn("[Maestro] Falha no classifyIntentLLM, mantendo unknown", e);
    }
  }

  return { domain };
}
