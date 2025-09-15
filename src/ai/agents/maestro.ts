// src/ia/agents/maestro.ts
import { AgentContext, AgentDomain, AgentResult, LLMCaller } from "./types";

const FOOD_HINTS = [
  "comi", "comer", "comida", "almoco", "almoço", "jantar", "cafe da manha", "café da manhã",
  "lanche", "fatia", "fatias", "unidade", "unidades", "ml", "g", "kg", "grama", "gramas",
  "caloria", "calorias", "proteina", "proteína", "carboidrato", "gordura",
  "registrar", "excluir", "remover", "substituir", "refeição", "refeicao", "alimento", "alimentos"
];

const EXERCISE_HINTS = [
  "treino", "treinei", "exercicio", "exercício", "corrida", "caminhada", "musculacao", "musculação",
  "bike", "bicicleta", "natação", "natacao", "yoga", "pilates", "gastei", "kcal", "calorias gastas",
  "adicionar exercicio", "excluir exercicio", "remover exercicio", "substituir exercicio"
];

const DIET_HINTS = [
  "dieta", "plano alimentar", "cardapio", "cardápio", "planejamento de refeições",
  "meta de macros", "objetivo calórico", "bulking", "cutting", "reeducação alimentar"
];

const RECIPES_HINTS = [
  "receita", "como fazer", "modo de preparo", "ingredientes", "rende", "porções"
];

const SHOPPING_HINTS = [
  "lista de compras", "mercado", "supermercado", "feira", "comprar", "estoque"
];

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some(n => haystack.includes(n));
}

/**
 * Heurística rápida para classificar a intenção sem LLM.
 * Se hasImage = true, prioriza FOOD (visão de refeições).
 */
// Substitua sua função por esta

export function classifyIntentHeuristic(
  text: string,
  opts?: { hasImage?: boolean }
): Intent {
  const tRaw = (text || "").trim();
  if (!tRaw) return "unknown";

  // Normalização simples
  const t = tRaw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1) Se veio imagem, prioridade é FOOD
  if (opts?.hasImage) return "food";

  // 2) Padrões de "registro de alimento" (sem hints fixas)
  //    - números + unidade (g, kg, ml, l, unidade(s), fatia(s), colher(es), x)
  //    - verbos comuns de ingestão: comi, bebi, almocei, jantei, lanchei, tomei
  const quantityUnitRe =
    /\b\d+(?:[.,]\d+)?\s*(?:g|grama|gramas|kg|ml|mililitros?|l|litros?|unid(?:ade)?s?|fatia(?:s)?|colher(?:es)?|x)\b/;
  const eatDrinkVerbsRe =
    /\b(comi|bebi|tomei|almocei|jant(ei|ar)|lanche(i|ar)|ingeri|consumi|degustei|mandei|fiz um lanche)\b/;

  // Se tem padrão de quantidade+unidade OU verbos de consumo -> tende a ser FOOD
  if (quantityUnitRe.test(t) || eatDrinkVerbsRe.test(t)) {
    // Mas verifique se não é claramente exercício (ex.: “corri 5km 30min 300kcal”)
    const exerciseShapeRe =
      /\b(\d+(?:[.,]\d+)?\s*(?:km|kcal|min|mins|minutos?|h|horas?))\b/;
    const exerciseVerbsRe =
      /\b(corri|pedalei|nadar?|nadei|caminhei|musculacao|treinei|supino|agachamento|esteira|bicicleta|spinning|yoga|pilates|hiit)\b/;

    // Se só tem formato "exercício" e não fala de comer/beber, manda pra exercise
    if (!eatDrinkVerbsRe.test(t) && (exerciseShapeRe.test(t) || exerciseVerbsRe.test(t))) {
      return "exercise";
    }
    return "food";
  }

  // 3) Remoção/ajuste/substituição (geralmente ainda é FOOD)
  const foodOpsRe =
    /\b(remov(e|er|i)|exclu(i|ir)|apaga(r)?|tirar?|substitu(i|ir)|corrig(e|ir)|nao\s+e|nao era)\b/;
  if (foodOpsRe.test(t)) {
    // Se fala de treino claro, manda pra exercise; caso contrário, food
    const exerciseWordsRe =
      /\b(treino|corrida|ciclismo|musculacao|exercicio|esteira|bike|bicicleta|hiit|yoga|pilates)\b/;
    if (exerciseWordsRe.test(t)) return "exercise";
    return "food";
  }

  // 4) Intenções de EXERCÍCIO
  const exerciseHardRe =
    /\b(corri|pedalei|nadei|nadar|caminhei|musculacao|treinei|esteira|bicicleta|spinning|remador|agachamento|supino|flexao|yoga|pilates|hiit)\b/;
  const exerciseUnitsRe = /\b(\d+(?:[.,]\d+)?\s*(km|kcal|min|mins|minutos?|h|horas?))\b/;
  if (exerciseHardRe.test(t) || exerciseUnitsRe.test(t)) {
    return "exercise";
  }

  // 5) Plano de dieta / cardápio (planejamento)
  const dietPlanRe =
    /\b(plano|planejar|planejamento|cardapio|dieta|semana|semanais?|mensal|macros|macro|objetivo|cutting|bulking)\b/;
  if (dietPlanRe.test(t)) return "diet";

  // 6) Lista de compras
  const shoppingRe =
    /\b(lista\s+de\s+compras|supermercado|comprar|mercado|feira|preciso\s+comprar|itens\s+para\s+comprar)\b/;
  if (shoppingRe.test(t)) return "shopping";

  // 7) Receitas (cozinhar)
  const recipeRe =
    /\b(receita|como\s+fazer|modo\s+de\s+preparo|ingredientes|preparo|rendimento|tempo\s+de\s+preparo)\b/;
  if (recipeRe.test(t)) return "recipe";

  // 8) Se nada bateu, unknown —> maestro usa classifyIntentLLM(...) no fallback
  return "unknown";
}

/**
 * Classificação por LLM (opcional). Use um modelo leve para rótulos.
 * Retorna um dos domínios predefinidos.
 */
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
    model: "gpt-4o-mini", // ou seu 'gpt-5-nano' equivalente
  });

  const label = (content || "").trim().toLowerCase();
  const allowed: AgentDomain[] = ["food", "exercise", "diet", "recipes", "shopping", "unknown"];
  return (allowed as string[]).includes(label) ? (label as AgentDomain) : "unknown";
}

/**
 * Maestro/orquestrador: decide pra qual agente mandar.
 * Nesta etapa, só retorna o domínio escolhido. Na próxima, você conecta os agentes concretos.
 */
export async function routeIntent(
  inputText: string,
  ctx: AgentContext,
  llm?: LLMCaller
): Promise<AgentResult> {
  // 1) Heurística barata primeiro
  let domain = classifyIntentHeuristic(inputText, { hasImage: ctx.hasImage });

  // 2) Se ainda "unknown" e tiver LLM disponível, tenta desempate
  if (domain === "unknown" && llm) {
    try {
      domain = await classifyIntentLLM(inputText, llm);
    } catch (e) {
      // se der erro, mantém unknown
      console.warn("[Maestro] Falha ao classificar com LLM, mantendo 'unknown'.", e);
    }
  }

  return { domain };
}
