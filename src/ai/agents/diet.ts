// src/ai/agents/diet.ts
import type { AgentContext, AgentResult } from "./types";
import { db, doc, setDoc } from "@/lib/firestore.admin.compat";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import fs from "node:fs";
import path from "node:path";

// util: lê prompt .txt
function loadPromptTxt(relPath: string) {
  try {
    const p = path.join(process.cwd(), "src", "ai", "prompts", relPath);
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

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

function ymdFromISO(iso: string) {
  return (iso || "").slice(0, 10);
}

function parseJsonLoose(s: string) {
  const trimmed = (s || "").trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
    return null;
  }
}

// JSON Schema da função (alinha com seu prompt de “5 refeições, sem somar macros”)
const DietPlanParams = {
  type: "object",
  properties: {
    dia: { type: "string", description: "YYYY-MM-DD" },
    refeicoes: {
      type: "array",
      minItems: 5,
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "café, lanche manhã, almoço, lanche tarde, jantar" },
          horario: { type: "string", description: "HH:mm", nullable: true },
          itens: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                alimento: { type: "string" },
                quantidade: { type: "number" },
                unidade: { type: "string", enum: ["g", "ml", "un"] }
              },
              required: ["alimento", "quantidade", "unidade"],
              additionalProperties: false
            }
          }
        },
        required: ["nome", "itens"],
        additionalProperties: false
      }
    },
    totais: {
      type: "object",
      properties: {
        kcal: { type: "number" },
        carbs: { type: "number" },
        protein: { type: "number" },
        fat: { type: "number" }
      },
      additionalProperties: false
    }
  },
  required: ["refeicoes"],
  additionalProperties: true
};

export async function runDietAgent(args: {
  messages: any[];
  ctx: AgentContext;
  openAIApiKey: string;
  model?: string;
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, model = "gpt-4o-mini" } = args;

  const userText = lastUserText(messages);
  const dia = ymdFromISO(ctx.nowISO);
  const SYS = loadPromptTxt("dietplanner.txt");

  const systemPrompt =
    SYS ||
    `Você é um planejador de dieta. Gere um plano diário com 5 refeições (café, lanche manhã, almoço, lanche tarde, jantar).
Nunca 1 ingrediente só por refeição; mínimo 2 itens. Respeite preferências/alergias. Não some calorias/macros. Responda usando a função.`;

  // CHAMADA com FUNCTION CALLING — força JSON via tool 'set_diet_plan'
  let plan: any = null;
  try {
    const r = await openAIChatCaller({
      apiKey: openAIApiKey,
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText || "Monte um plano diário de 5 refeições." },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "set_diet_plan",
            description: "Retorna o plano diário de refeições em JSON",
            parameters: DietPlanParams,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "set_diet_plan" } },
    });

    if (r.toolCall?.arguments) {
      plan = parseJsonLoose(r.toolCall.arguments);
    } else {
      // fallback: tenta do content (caso modelo não faça tool_call)
      plan = r.json ?? parseJsonLoose(r.text);
    }
  } catch (e) {
    plan = null;
  }

  // Normaliza estrutura mínima
  if (!plan || typeof plan !== "object") {
    plan = {
      dia,
      refeicoes: [],
      totais: { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      _notes: "LLM não retornou JSON válido; estrutura vazia criada.",
    };
  } else {
    if (!plan.dia) plan.dia = dia;
    if (!Array.isArray(plan.refeicoes)) plan.refeicoes = [];
  }

  const ref = doc(db, "chatfit", ctx.userEmail, "dietas", dia);
  await setDoc(ref, { createdAt: Date.now(), locale: ctx.locale, plan }, { merge: true });

  const reply =
    plan.refeicoes?.length
      ? "Plano de dieta gerado e salvo para hoje. Quer ajustes por objetivo (cutting/bulking/manutenção) ou restrições?"
      : "Gerei a estrutura do plano. Quer que eu tente novamente com preferências (ex.: sem lactose, 5 refeições, horários)?";

  return {
    domain: "diet",
    reply,
    data: { dia, plan },
  };
}
