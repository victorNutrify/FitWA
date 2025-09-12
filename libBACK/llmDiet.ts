// src/lib/llmDiet.ts
// Camada LLM para gerar rascunho de plano (array de itens com gramas).
// O resultado SEMPRE passa por validação/ajuste determinístico depois.

import type { DailyGoals, MealKeyPt } from "@/lib/deterministicDiet";

type LlmFoodsItem = {
  meal: MealKeyPt;
  name: string;
  quantity: number; // em gramas
  unit?: "g";
};

export async function llmDraftFoods(
  goals: DailyGoals,
  preferenciasTexto: string,
  disallowNames: string[],
  likeNames: string[]
): Promise<LlmFoodsItem[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const system = `
Você é nutricionista. Gere um plano para UM dia (5 refeições: cafe_da_manha, lanche_manha, almoco, lanche_tarde, jantar).
REGRAS OBRIGATÓRIAS:
- NUNCA inclua alimentos da lista PROIBIDOS (dislikes).
- Se houver LIKES, prefira incluí-los, principalmente no almoço e jantar.
- Whey: NUNCA menos que 20 g.
- Use porções realistas: proteínas (100–220 g), carboidratos (80–220 g), oleaginosas (10–20 g), azeite (5–10 g).
- Frutas: prefira 1 unidade (banana ~80 g, maçã ~130 g, laranja ~140 g). Evite porções microscópicas (ex.: 1 g).
- Distribua P/C/G em TODAS as refeições (evite só carbo ou só proteína).
- Retorne APENAS um JSON (array) válido, sem comentários.
`.trim();

  const user = `
METAS (dia):
- Calorias: ${goals.calorias}
- Proteína: ${goals.proteina}
- Carboidratos: ${goals.carboidrato}
- Gorduras: ${goals.gordura}

PROIBIDOS: ${JSON.stringify(disallowNames)}
LIKES (priorizar): ${JSON.stringify(likeNames)}

Observações do usuário: ${preferenciasTexto || "(vazio)"}

Nomes aceitáveis (exemplos):
"iogurte grego natural","iogurte natural","leite desnatado","ovo cozido","banana","maçã","laranja",
"aveia em flocos","pão integral","arroz integral cozido","arroz branco cozido","quinoa cozida","batata-doce cozida",
"brócolis cozido","grão-de-bico cozido","amêndoas","azeite de oliva",
"frango grelhado","kafta bovina grelhada","tilápia grelhada","salmão grelhado",
"carne moída cozida","carne moída de patinho (cozida)","hambúrguer de peru grelhado","almôndegas bovinas grelhadas","whey protein"

FORMATO:
[
  {"meal":"almoco","name":"almôndegas bovinas grelhadas","quantity":150,"unit":"g"},
  {"meal":"almoco","name":"arroz integral cozido","quantity":140,"unit":"g"},
  ...
]
`.trim();

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 1200,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  const data = await resp.json();
  if (data?.error) {
    console.error("LLM error:", data.error);
    return null;
  }

  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  try {
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) return null;
    return json.map((x: any) => ({
      meal: x.meal,
      name: x.name,
      quantity: Number(x.quantity) || 0,
      unit: "g"
    }));
  } catch {
    const trimmed = raw.replace(/```json|```/g, "").trim();
    try {
      const json2 = JSON.parse(trimmed);
      if (!Array.isArray(json2)) return null;
      return json2.map((x: any) => ({ meal: x.meal, name: x.name, quantity: Number(x.quantity) || 0, unit: "g" }));
    } catch {
      console.error("Falha ao parsear FOODS_JSON da LLM:", raw);
      return null;
    }
  }
}

