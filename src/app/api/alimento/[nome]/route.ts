import { NextRequest } from 'next/server';
import { getFoodData } from '@/lib/openFoodFacts'; 
import { getFoodData } from '@/lib/foodsResolver';

export async function GET(
  req: NextRequest,
  { params }: { params: { nome: string } }
) {
  const nome = decodeURIComponent(params.nome);

  if (!nome || typeof nome !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Nome do alimento não informado' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const resultado = await getFoodData(nome);
    return new Response(JSON.stringify(resultado), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na busca do alimento:', error);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}