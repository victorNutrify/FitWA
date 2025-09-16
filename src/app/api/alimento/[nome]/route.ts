// src/app/api/alimento/[nome]/route.ts
import type { NextRequest } from "next/server";
import { getFoodData } from "@/lib/openFoodFacts";

// Dica: RouteContext<'/api/alimento/[nome]'> tipa corretamente o params
export async function GET(req: NextRequest, ctx: RouteContext<"/api/alimento/[nome]">) {
  const { nome } = await ctx.params; // ✅ precisa de await no Next 15+
  const nomeDecod = decodeURIComponent(nome ?? "");

  if (!nomeDecod) {
    return new Response(JSON.stringify({ error: "Nome do alimento não informado" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const resultado = await getFoodData(nomeDecod);
    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[/api/alimento] Erro:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
