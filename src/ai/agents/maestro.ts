// src/ai/agents/maestro.ts
import type { AgentContext, AgentDomain, AgentResult } from "./types";
import { runFoodAgent } from "./food";
import { runExerciseAgent } from "./exercise";
import { runDietAgent } from "./diet";
import { runRecipesAgent } from "./recipes";
import { runShoppingAgent } from "./shopping";
import fs from "node:fs";
import path from "node:path";

// Lê um prompt .txt da pasta src/ai/prompts
function loadPromptTxt(relPath: string) {
  try {
    const p = path.join(process.cwd(), "src", "ai", "prompts", relPath);
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// Normaliza acentos/caixa
function normalize(text: string) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Último texto do usuário nas mensagens
function lastUserText(messages: any[]): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (m?.content?.text) return String(m.content.text);
    }
  }
  return "";
}

// Heurística rápida
export function classifyIntentHeuristic(
  text: string,
  opts?: { hasImage?: boolean }
): AgentDomain {
  const t = normalize(text).trim();
  if (!t) return "unknown";

  // Imagem → prioriza logger de refeição
  if (opts?.hasImage) return "food";

  // DIET (plano estruturado)
  if (
    /(dieta|plano alimentar|cardapio|plano de refeicoes|plano de dieta)/.test(t) ||
    /(faca um plano|monte um plano|organizar refeicoes|estrutura de refeicoes)/.test(t) ||
    /(5 refeicoes|cinco refeicoes)/.test(t)
  ) return "diet";

  // RECIPES
  if (/(receita|modo de preparo|ingrediente(s)?|como fazer|passo a passo)/.test(t))
    return "recipes";

  // SHOPPING
  if (
    /(lista de compras|compras|mercado|supermercado|itens para comprar|despensa|reposicao)/.test(t) ||
    /(montar lista|preciso comprar|repor dispensa|repor despensa)/.test(t)
  ) return "shopping";

  // FOOD (registro de refeição)
  if (
    /(comi|adicione|lancar|refeic(a|o)|alimento|kcal|caloria|grama|ml|porcao)/.test(t) ||
    /(jantei|almoc(e|ei)|cafe da manha|lanche)/.test(t)
  ) return "food";

  // EXERCISE
  if (/(treino|exercicio|corrida|musculacao|bike|ciclismo|queimei|gasto calorico)/.test(t))
    return "exercise";

  return "unknown";
}

// Classificador LLM (fallback) usando seu router.txt
async function classifyIntentLLM(args: {
  caller: any; // openAIChatCaller
  openAIApiKey: string;
  text: string;
}): Promise<AgentDomain> {
  const SYS = loadPromptTxt("router.txt");
  const { caller, openAIApiKey, text } = args;

  const res = await caller({
    apiKey: openAIApiKey,
    model: "gpt-4o-mini",
    temperature: 0.0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYS || "Classifique a intenção: food|exercise|diet|recipes|shopping|unknown. Responda em JSON: {\"domain\":\"...\"}" },
      { role: "user", content: text || "classifique a intenção." },
    ],
  });

  try {
    const obj = res.json ?? JSON.parse(res.text);
    const d = String(obj?.domain || "").toLowerCase();
    if (["food", "exercise", "diet", "recipes", "shopping", "unknown"].includes(d)) {
      return d as AgentDomain;
    }
  } catch {
    // ignora e cai no fallback
  }
  return "unknown";
}

/**
 * Roteia para o agente certo.
 * IMPORTANTE: precisa receber `caller` (openAIChatCaller) porque o fallback LLM usa ele.
 */
export async function routeIntent(args: {
  messages: any[];
  ctx: AgentContext;
  openAIApiKey: string;
  caller: any; // openAIChatCaller
  modelFood?: string;
  modelExercise?: string;
  modelDiet?: string;
  modelRecipes?: string;
  modelShopping?: string;
}): Promise<AgentResult> {
  const {
    messages,
    ctx,
    openAIApiKey,
    caller,
    modelFood = "gpt-4o-mini",
    modelExercise = "gpt-4o-mini",
    modelDiet = "gpt-4o-mini",
    modelRecipes = "gpt-4o-mini",
    modelShopping = "gpt-4o-mini",
  } = args;

  const userText = lastUserText(messages);

  // 1) Heurística
  let domain: AgentDomain = classifyIntentHeuristic(userText, { hasImage: ctx.hasImage });

  // 2) Fallback LLM (se ainda desconhecido)
  if (domain === "unknown") {
    domain = await classifyIntentLLM({ caller, openAIApiKey, text: userText });
  }

  // 3) Default seguro
  if (domain === "unknown") domain = "food";

  // 4) Roteamento
  switch (domain) {
    case "food":
      return await runFoodAgent({ messages, ctx, openAIApiKey, model: modelFood });

    case "exercise":
      return await runExerciseAgent({ messages, ctx, openAIApiKey, model: modelExercise });

    case "diet":
      return await runDietAgent({ messages, ctx, openAIApiKey, model: modelDiet });

    case "recipes":
      return await runRecipesAgent({ messages, ctx, openAIApiKey, model: modelRecipes });

    case "shopping":
      return await runShoppingAgent({ messages, ctx, openAIApiKey, model: modelShopping });

    default:
      return { domain: "unknown", reply: "Não entendi sua solicitação.", data: {} };
  }
}