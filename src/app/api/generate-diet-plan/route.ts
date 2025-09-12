// src/app/api/generate-diet-plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, doc, setDoc, getDocs, collection, runTransaction, deleteDoc } from "@/lib/firestore.admin.compat";
import { z } from "zod";

// ------------------
// Schemas de validação
// ------------------
const AlimentoSchema = z.object({
  nome: z.string(),
  quantidade: z.string(),
  proteinas: z.number(),
  carboidratos: z.number(),
  gorduras: z.number(),
  calorias: z.number(),
});

const RefeicaoSchema = z.object({
  refeicao: z.string(),
  alimentos: z.array(AlimentoSchema),
});

const PlanoSchema = z.array(RefeicaoSchema);

type Alimento = z.infer<typeof AlimentoSchema>;
type Refeicao = z.infer<typeof RefeicaoSchema>;

// ------------------
// Funções auxiliares
// ------------------
async function getUserMeta(email: string) {
  try {
    const metasRef = collection(db, "chatfit", email, "metasusuario");
    const metasQuery = query(metasRef, orderBy("createdAt", "desc"));
    const metasSnap = await getDocs(metasQuery);
    if (metasSnap.empty) return null;
    return metasSnap.docs[0].data();
  } catch (err) {
    console.error("Erro ao buscar metas do usuário:", err);
    return null;
  }
}

function sumMacros(groupedPlan: Refeicao[]) {
  let protein = 0, carbs = 0, fat = 0, calories = 0;
  for (const refeicao of groupedPlan) {
    for (const a of refeicao.alimentos) {
      protein += a.proteinas;
      carbs += a.carboidratos;
      fat += a.gorduras;
      calories += a.calorias;
    }
  }
  return { protein, carbs, fat, calories };
}

function renderGroupedPlan(groupedPlan: Refeicao[], totals: any) {
  let out = "Plano de Dieta Diário\n";
  for (const refeicao of groupedPlan) {
    out += `\n${refeicao.refeicao}\n`;
    for (const a of refeicao.alimentos) {
      out += `${a.quantidade} de ${a.nome}: ${a.proteinas}g proteína, ${a.carboidratos}g carboidrato, ${a.gorduras}g gordura, ${a.calorias}kcal\n`;
    }
  }
  out += `\nTotais do Dia\n- Proteína: ${totals.protein}g\n- Carboidratos: ${totals.carbs}g\n- Gordura: ${totals.fat}g\n- Calorias: ${totals.calories}kcal\n`;
  return out;
}

// ------------------
// Normalização do JSON
// ------------------
function normalizeFoodsJson(data: any) {
  if (Array.isArray(data)) return data;

  if (typeof data === "object" && data !== null) {
    return Object.entries(data).map(([refeicao, alimentos]) => ({
      refeicao,
      alimentos: Array.isArray(alimentos) ? alimentos : []
    }));
  }

  return [];
}

// ------------------
// Rota principal
// ------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userEmail } = body;

    if (!userEmail) {
      return NextResponse.json({ error: "userEmail não informado." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "API key missing." }, { status: 500 });
    }

    const userMeta = await getUserMeta(userEmail);
    if (!userMeta) {
      return NextResponse.json({ error: "Metas do usuário não encontradas." }, { status: 500 });
    }

    // ------------------
    // PROMPT
    // ------------------
    const systemPrompt = `
Você deve gerar um plano alimentar de 1 dia, seguindo exatamente as metas:
- Proteína: ${userMeta.proteina}g
- Carboidratos: ${userMeta.carboidrato}g
- Gordura: ${userMeta.gordura}g

Regras:
- Nunca ultrapasse as metas de gordura e carboidrato.
- Se faltar proteína, complete com Whey Protein Isolado (g).
- Se faltar gordura, complete com azeite de oliva extra virgem (g).
- Se faltar carboidrato, complete com maltodextrina (g).
- Whey deve sempre aparecer em pelo menos uma refeição.
- Calcule macros reais para cada alimento (proteínas, carboidratos, gorduras, calorias).
- Nunca deixe valores vazios ou “N/I”.

Retorne APENAS o bloco <FOODS_JSON>...</FOODS_JSON> como um ARRAY JSON.
NUNCA retorne objeto.  
O formato correto é:

<FOODS_JSON>[
  {
    "refeicao": "Café da Manhã",
    "alimentos": [
      {"nome": "Ovos mexidos", "quantidade": "3 ovos", "proteinas": 18, "carboidratos": 1, "gorduras": 15, "calorias": 210}
    ]
  },
  {
    "refeicao": "Almoço",
    "alimentos": [
      {"nome": "Arroz integral", "quantidade": "150g", "proteinas": 4, "carboidratos": 40, "gorduras": 1, "calorias": 200}
    ]
  }
]</FOODS_JSON>
`.trim();

    const openAIMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // ------------------
    // Chamada OpenAI
    // ------------------
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: openAIMessages,
        max_tokens: 1800,
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    // ------------------
    // Parse + validação
    // ------------------
    const rawContent = data.choices?.[0]?.message?.content ?? "[]";

    // Extrai só o conteúdo entre <FOODS_JSON>...</FOODS_JSON>
    const m = rawContent.match(/<FOODS_JSON>([\s\S]*?)<\/FOODS_JSON>/i);
    const rawJson = m ? m[1].trim() : rawContent;

    let groupedPlan: Refeicao[];
    try {
      let parsed = JSON.parse(rawJson);
      parsed = normalizeFoodsJson(parsed);
      groupedPlan = PlanoSchema.parse(parsed);
    } catch (err) {
      console.error("Erro de validação do JSON:", err, rawJson);
      return NextResponse.json({ error: "Plano retornado em formato inválido." }, { status: 500 });
    }

    const totals = sumMacros(groupedPlan);
    const content = renderGroupedPlan(groupedPlan, totals);

    // ------------------
    // Salvar no Firestore
    // ------------------
    await setDoc(doc(db, "chatfit", userEmail, "planos", "dieta"), {
      content,
      alimentos: groupedPlan,
      updatedAt: new Date().toISOString(),
      totals,
    });

    return NextResponse.json({
      reply: content,
      alimentos: groupedPlan,
      totals,
      meta: {
        proteina: userMeta.proteina,
        carboidrato: userMeta.carboidrato,
        gordura: userMeta.gordura,
      }
    });
  } catch (err: any) {
    console.error("Erro inesperado no endpoint:", err);
    return NextResponse.json({ error: "Erro inesperado: " + (err?.message || "") }, { status: 500 });
  }
}
