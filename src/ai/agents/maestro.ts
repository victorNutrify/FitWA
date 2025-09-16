// src/ia/agents/maestro.ts
import { AgentContext, AgentDomain, AgentResult } from "./types";
import { runFoodAgent } from "./food";
import { runExerciseAgent } from "./exercise";

// Heurística leve para classificar
export function classifyIntentHeuristic(
  text: string,
  opts?: { hasImage?: boolean }
): AgentDomain {
  const tRaw = (text || "").trim();
  if (!tRaw) return "unknown";

  const t = tRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (opts?.hasImage) return "food";

  const quantityUnitRe =
    /\b\d+(?:[.,]\d+)?\s*(?:g|grama|gramas|kg|ml|mililitros?|l|litros?|unid(?:ade)?s?|fatia(?:s)?|colher(?:es)?|x)\b/;
  const eatDrinkVerbsRe =
    /\b(comi|bebi|tomei|almocei|jant(ei|ar)|lanche(i|ar)|ingeri|consumi)\b/;
  if (quantityUnitRe.test(t) || eatDrinkVerbsRe.test(t)) {
    const exerciseShapeRe = /\b(\d+(?:[.,]\d+)?\s*(?:km|kcal|min|mins|minutos?|h|horas?))\b/;
    const exerciseVerbsRe =
      /\b(corri|pedalei|nadar?|nadei|caminhei|musculacao|treinei|esteira|bicicleta|spinning|yoga|pilates|hiit)\b/;
    if (!eatDrinkVerbsRe.test(t) && (exerciseShapeRe.test(t) || exerciseVerbsRe.test(t))) {
      return "exercise";
    }
    return "food";
  }

  const foodOpsRe = /\b(remover|removi|excluir|exclui|apagar|substituir|corrigir)\b/;
  if (foodOpsRe.test(t)) {
    const exerciseWordsRe =
      /\b(treino|corrida|ciclismo|musculacao|exercicio|esteira|bike|bicicleta|hiit|yoga|pilates)\b/;
    if (exerciseWordsRe.test(t)) return "exercise";
    return "food";
  }

  const exerciseHardRe =
    /\b(corri|pedalei|nadei|nadar|caminhei|musculacao|treinei|esteira|bicicleta|spinning|remador|agachamento|supino|flexao|yoga|pilates|hiit)\b/;
  const exerciseUnitsRe = /\b(\d+(?:[.,]\d+)?\s*(?:km|kcal|min|mins|minutos?|h|horas?))\b/;
  if (exerciseHardRe.test(t) || exerciseUnitsRe.test(t)) return "exercise";

  const dietPlanRe = /\b(plano|planejar|planejamento|cardapio|dieta|semana|macros|objetivo|cutting|bulking)\b/;
  if (dietPlanRe.test(t)) return "diet";

  const shoppingRe = /\b(lista\s+de\s+compras|supermercado|comprar|mercado|feira|preciso\s+comprar)\b/;
  if (shoppingRe.test(t)) return "shopping";

  const recipeRe = /\b(receita|como\s+fazer|modo\s+de\s+preparo|ingredientes|preparo|rendimento)\b/;
  if (recipeRe.test(t)) return "recipes";

  return "unknown";
}

/**
 * Roteia para o agente certo.
 * Alinha a assinatura com os agentes que recebem (messages, ctx, openAIApiKey).
 */
export async function routeIntent(opts: {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  ctx: AgentContext;
  openAIApiKey: string;
  modelFood?: string;
  modelExercise?: string;
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, modelFood = "gpt-4o", modelExercise = "gpt-4o" } = opts;

  const lastUser =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";

  let domain = classifyIntentHeuristic(lastUser, { hasImage: ctx.hasImage });

  switch (domain) {
    case "food":
      return await runFoodAgent({ messages, ctx, openAIApiKey, model: modelFood });
    case "exercise":
      return await runExerciseAgent({ messages, ctx, openAIApiKey, model: modelExercise });
    default:
      return { domain: "unknown", reply: "Não entendi sua solicitação.", data: {} };
  }
}
