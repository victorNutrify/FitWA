// src/ai/agents/diet.ts
import type { AgentContext, AgentResult } from "./types";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import { buildDietPlannerPrompt } from "@/ai/prompts/dietplanner";
import { db, doc, setDoc } from "@/lib/firestore.admin.compat";

// ===== whitelist de nomes (sem marcas) =====
const GENERIC_ALLOWED = [
  // cafés/lanches básicos
  "Pão de forma", "Pão integral", "Tapioca", "Crepioca", "Aveia em flocos", "Granola",
  "Iogurte natural", "Iogurte grego", "Queijo minas", "Queijo cottage",
  "Leite desnatado", "Leite semidesnatado", "Leite vegetal",
  "Ovo", "Banana", "Maçã", "Mamão", "Manga", "Abacaxi", "Uva", "Pera", "Melancia",
  "Amendoim", "Pasta de amendoim", "Castanha de caju", "Castanha-do-pará", "Nozes",
  // almoço/jantar
  "Arroz", "Arroz integral", "Feijão", "Lentilha", "Grão-de-bico",
  "Macarrão", "Macarrão integral", "Batata inglesa", "Batata-doce", "Mandioquinha",
  "Abóbora", "Milho", "Ervilha",
  "Peito de frango", "Coxa de frango", "Carne moída", "Patinho", "Alcatra",
  "Carne suína", "Lombo suíno", "Peixe branco", "Salmão", "Atum", "Sardinha",
  "Omelete",
  // saladas/legumes
  "Alface", "Rúcula", "Agrião", "Tomate", "Cenoura", "Beterraba", "Pepino",
  "Brócolis", "Couve-flor", "Vagem", "Abobrinha", "Berinjela", "Pimentão",
  "Cebola", "Alho",
  // gorduras/tempero
  "Azeite de oliva", "Azeitona", "Abacate",
  // snacks
  "Biscoito de arroz", "Pipoca", "Barra de cereal",
  // bebidas
  "Café", "Chá", "Suco natural"
];

function parseFoodsBlock(raw: string): any[] {
  // Esperado: bloco <FOODS_JSON> [ ... ] </FOODS_JSON>
  const m = String(raw || "").match(/<FOODS_JSON>\s*([\s\S]*?)\s*<\/FOODS_JSON>/i);
  if (!m) return [];
  const inside = m[1].replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_mm, p1) => (p1 || "").trim());
  try {
    const arr = JSON.parse(inside);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function runDietAgent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  model: string;
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, model } = args;

  const userMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const goalsText =
    typeof userMsg === "string" && userMsg.trim().length > 0
      ? userMsg
      : "Gerar plano de 5–6 refeições para hoje.";

  // prompt padronizado TS (sem leitura de arquivo)
  const prompt = buildDietPlannerPrompt(GENERIC_ALLOWED);

  const { text } = await openAIChatCaller({
    apiKey: openAIApiKey,
    model,
    system: prompt,
    messages: [{ role: "user", content: goalsText }],
  });

  const plan = parseFoodsBlock(text);
  const dia = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (ctx?.userEmail) {
    const ref = doc(db, "chatfit", ctx.userEmail, "dietas", dia);
    await setDoc(
      ref,
      { createdAt: Date.now(), locale: ctx.locale ?? "pt-BR", plan },
      { merge: true }
    );
  }

  const reply =
    plan?.length
      ? "Plano de dieta gerado (sem marcas) e salvo para hoje. Quer ajustar por objetivo ou restrições?"
      : "Gerei a estrutura do plano. Quer que eu tente novamente com preferências (ex.: sem lactose, 5 refeições, horários)?";

  return {
    domain: "diet",
    reply,
    data: { dia, plan },
  };
}
