// src/ai/agents/maestro.ts
import type { AgentContext, AgentDomain, AgentResult } from "./types";
import { runFoodAgent } from "./food";
import { runExerciseAgent } from "./exercise";
import { runDietAgent } from "./diet";
import { runRecipesAgent } from "./recipes";
import { runShoppingAgent } from "./shopping";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import { ROUTER_SYSTEM_PROMPT } from "@/ai/prompts/router";
// (opcional) bem-estar
// import { runCoachAgent } from "./coach";

// ---- Heurística reforçada ----
function guessDomainSimple(text: string): AgentDomain {
  const t = (text || "").toLowerCase();

  // imagem → tende a ser food
  if (/\b(foto|imagem|foto do prato|anexa(da)? imagem)\b/.test(t)) return "food";

  // palavras de comida
  if (/\b(alimento|comi|comida|lanche|refei(c|ç)ão|calorias|macro|almo(ç|c)o|jantar|café|ceia)\b/.test(t))
    return "food";

  // EXERCÍCIOS (mais abrangente: verbos e esportes comuns + pistas de tempo/distância)
  const hasExerciseVerb =
    /\b(exerc(í|i)cio|treino|treinar|muscula(c|ç)[aã]o|corri|correr|corrida|corre|correu|pedalei|pedalar|caminhei|caminhar|caminhada|nadei|nadar|natação|natacao|remada|el[íi]ptico|eliptico|esteira|flex(ã|a)o|agachamento|supino|abd(o|ô)minal|prancha|yoga|pilates|hiit|hit)\b/.test(
      t
    );
  const hasSport =
    /\b(t[êe]nis|tenis|futebol|basquete|v[oó]lei|bicicleta|bike|mountain bike|mtb|spinning|corrida)\b/.test(
      t
    );
  const hasNumbers = /\b\d+\s?(min|mins|minutos|km|kcal|h|hr|hora|horas)\b/.test(t);

  if (hasExerciseVerb || hasSport || (hasNumbers && /\b(corr|bike|bicic|caminh|nada|exerc|trein)\w*/.test(t)))
    return "exercise";

  // plano de dieta
  if (/\b(plano|card(á|a)pio|dieta|refei(c|ç)ões do dia|refei(c|ç)ões da semana)\b/.test(t))
    return "diet";

  // receitas
  if (/\b(receita|modo de preparo|ingredientes)\b/.test(t)) return "recipes";

  // compras
  if (/\b(compra|lista de compras|supermercado|mercado)\b/.test(t)) return "shopping";

  // bem-estar (opcional)
  // if (/\b(sa(u|ú)de|bem[- ]?estar|saud(a|á)vel|dica(s)?|posso comer|é saud(a|á)vel|qual a melhor)\b/.test(t))
  //   return "coach";

  return "unknown";
}

// ---- Fallback por LLM ----
async function guessDomainLLM({
  apiKey,
  model,
  userText,
}: {
  apiKey: string;
  model: string;
  userText: string;
}): Promise<AgentDomain> {
  const { text } = await openAIChatCaller({
    apiKey,
    model,
    system: ROUTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText }],
    forceJson: true,
  });

  try {
    const obj = JSON.parse(text);
    if (obj?.domain) {
      const d = String(obj.domain).toLowerCase();
      if (["food", "exercise", "diet", "recipes", "shopping", "coach", "unknown"].includes(d)) {
        return d as AgentDomain;
      }
    }
    if (Array.isArray(obj?.intents) && obj.intents.length) {
      const order: AgentDomain[] = ["food", "exercise", "diet", "recipes", "shopping" /*, "coach"*/];
      const found = order.find((d) => obj.intents.includes(d) || obj.intents.includes(String(d)));
      return (found ?? "unknown") as AgentDomain;
    }
  } catch {}
  return "unknown";
}

// ---- Roteador principal ----
export async function routeIntent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  modelFood?: string;
  modelExercise?: string;
  modelDiet?: string;
  modelRecipes?: string;
  modelShopping?: string;
  routerModel?: string;
}): Promise<AgentResult> {
  const {
    messages,
    ctx,
    openAIApiKey,
    modelFood = "gpt-5",
    modelExercise = "gpt-5",
    modelDiet = "gpt-5",
    modelRecipes = "gpt-5",
    modelShopping = "gpt-5",
    routerModel = "gpt-5",
  } = args;

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const textOnly = typeof lastUser === "string" ? lastUser : "";

  let domain = guessDomainSimple(textOnly);

  if (domain === "unknown" && textOnly) {
    try {
      domain = await guessDomainLLM({
        apiKey: openAIApiKey,
        model: routerModel,
        userText: textOnly,
      });
    } catch {
      domain = "unknown";
    }
  }

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
    // case "coach":
    //   return await runCoachAgent({ messages, ctx, openAIApiKey, model: modelRecipes });
    default:
      return {
        domain: "unknown",
        reply:
          "Não entendi sua solicitação. Você quer registrar alimentos/exercícios, gerar um plano de dieta, receitas ou uma lista de compras?",
        data: {},
      };
  }
}
