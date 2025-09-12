import { NextRequest, NextResponse } from "next/server";
import { db, doc, setDoc, getDocs, collection, runTransaction, deleteDoc } from "@/lib/firestore.admin.compat";
import { z } from "zod";

// ------------------
// Schemas Zod
// ------------------
const ShoppingItemSchema = z.object({
  alimento: z.string(),
  quantidade: z.string(),
});

const ShoppingListSchema = z.object({
  lista: z.array(ShoppingItemSchema),
});

type ShoppingList = z.infer<typeof ShoppingListSchema>;

// ------------------
// Helpers
// ------------------
async function getUserAlimentos(userEmail: string) {
  if (!userEmail) return [];
  const planRef = doc(db, "chatfit", userEmail, "planos", "dieta");
  const planSnap = await getDoc(planRef);
  if (!planSnap.exists()) return [];
  return planSnap.data().alimentos || [];
}

// ------------------
// Endpoint principal
// ------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { days, userEmail } = body;

    if (!userEmail || !days) {
      return NextResponse.json({ error: "userEmail and days required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing." }, { status: 500 });
    }

    const alimentos = await getUserAlimentos(userEmail);
    if (!alimentos || alimentos.length === 0) {
      return NextResponse.json({ error: "No alimentos found for user." }, { status: 400 });
    }

    let alimentosParaDias: any[] = [];
    for (let i = 0; i < days; i++) {
      alimentosParaDias = alimentosParaDias.concat(alimentos);
    }

    // Prompt bem restritivo
    const systemPrompt = `
Você receberá um array de alimentos em JSON, cada item contém: { nome, quantidade }.
Sua tarefa:
- Agrupe alimentos iguais e some as quantidades (ex: "3 ovos" × 7 = "21 ovos").
- Converta g → kg e ml → L quando > 1000.
- NÃO invente nem adicione nada.
- Retorne JSON no formato:
{
  "lista": [
    {"alimento": "Ovos", "quantidade": "21 ovos"},
    {"alimento": "Arroz integral", "quantidade": "1,4kg"},
    ...
  ]
}
`.trim();

    const userPrompt = `
Array de alimentos para ${days} dias:
${JSON.stringify(alimentosParaDias, null, 2)}

Monte a lista agrupada e somada no formato JSON exigido.
`.trim();

    const openAIMessages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: openAIMessages,
        max_tokens: 1200,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const rawJson = data.choices?.[0]?.message?.content ?? "{}";

    let lista: ShoppingList;
    try {
      lista = ShoppingListSchema.parse(JSON.parse(rawJson));
    } catch (err) {
      console.error("Erro de validação do JSON da lista:", err);
      return NextResponse.json({ error: "Lista retornada em formato inválido." }, { status: 500 });
    }

    // Salva lista validada no Firestore
    await setDoc(
      doc(db, "chatfit", userEmail, "listas", "listaCompras"),
      {
        items: lista.lista,
        dias: days,
        origem: "llm",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ reply: lista.lista });
  } catch (err: any) {
    console.error("Erro na API /api/generate-shopping-list:", err);
    return NextResponse.json({ error: err.message || "Erro na comunicação com a OpenAI." }, { status: 500 });
  }
}
