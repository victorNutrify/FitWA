import { NextRequest, NextResponse } from "next/server";

// Função para limpar blocos markdown da resposta
function parseRecipeReply(reply: string) {
  return {
    reply: reply.replace(/```markdown|```/g, "") || "",
    ingredientes: [],
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages } = body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key missing." }, { status: 500 });
  }

  // O prompt DEVE estar inteiro entre crases, sem aspas duplas dentro. Use aspas simples se precisar!
  const systemPrompt = `
Você é um assistente culinário brasileiro.
Sua tarefa é criar receitas saudáveis e saborosas com os ingredientes informados pelo usuário.

REQUISITOS OBRIGATÓRIOS:
- Nunca use todos os ingredientes juntos se não fizer sentido culinário.
- Sempre calcule e exiba os dados nutricionais reais da receita (calorias, proteína, carboidratos, gordura), somando os valores dos ingredientes utilizados (use tabelas nutricionais confiáveis).
- O cálculo dos macros deve considerar as quantidades dos ingredientes listados, e os valores devem ser aproximados, mas nunca deixe de calcular.
- Nunca pode exibir N/I, Erro ao calcular ou não informado nos macros. Sempre calcule e preencha os valores.
- Mostre os macros finais da receita, com a soma dos valores dos ingredientes e suas quantidades.
- Retorne SEMPRE em português brasileiro, formato simples, sem blocos de markdown ou qualquer bloco de código.
- Títulos como Ingredientes, Modo de Preparo, Macros da receita, Fonte devem vir sem # e sem markdown heading.
- Não invente receitas, sempre use bom senso culinário brasileiro.

EXEMPLO DE SAÍDA (adapte para o card no frontend):

Nome da Receita: Omelete de Queijo
Ingredientes
- 2 ovos
- 50g de queijo
- 1 tomate pequeno

Modo de Preparo
1. Bata os ovos...
2. ...

Macros da receita
Calorias: 320 kcal
Proteína: 22g
Carboidrato: 3g
Gordura: 24g

Fonte
Receita adaptada de TudoGostoso (https://www.tudogostoso.com.br/receita/12345-omelete-de-queijo)

EXEMPLO DO CÁLCULO DOS MACROS:
- 2 ovos (~50g cada): 140 kcal, 12g proteína, 1g carboidrato, 10g gordura
- 50g queijo muçarela: 150 kcal, 10g proteína, 1g carboidrato, 12g gordura
- 1 tomate pequeno (~50g): 10 kcal, 1g proteína, 2g carboidrato, 0g gordura

SOMA FINAL DA RECEITA:
Calorias: 140 + 150 + 10 = 300 kcal
Proteína: 12 + 10 + 1 = 23g
Carboidrato: 1 + 1 + 2 = 4g
Gordura: 10 + 12 + 0 = 22g

Retorne os valores finais assim na receita.
`.trim();

  const openAIMessages = [
    { role: "system", content: systemPrompt },
    ...messages,
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: openAIMessages,
        max_tokens: 1600,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const reply = data.choices?.[0]?.message?.content ?? "";
    const recipe = parseRecipeReply(reply);

    return NextResponse.json({
      reply: recipe.reply,
      ingredientes: recipe.ingredientes,
    });
  } catch (err) {
    return NextResponse.json({ error: "Erro na comunicação com a OpenAI." }, { status: 500 });
  }
}