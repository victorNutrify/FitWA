"use client";

import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CaloriesByHourTable from "@/components/dashboard/CaloriesByHourTable";
import { Filter } from "lucide-react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, ComposedChart
} from "recharts";

// Dados simulados para ilustrar um mês seguindo um plano com +20 alimentos diferentes
const topMacros = [
    { alimento: "Frango grelhado", proteína: 320, carbo: 10, gordura: 12 },
    { alimento: "Arroz branco", proteína: 40, carbo: 420, gordura: 10 },
    { alimento: "Feijão preto", proteína: 68, carbo: 220, gordura: 8 },
    { alimento: "Ovo cozido", proteína: 120, carbo: 7, gordura: 32 },
    { alimento: "Batata doce", proteína: 22, carbo: 175, gordura: 0 },
    { alimento: "Brócolis", proteína: 18, carbo: 55, gordura: 1 },
    { alimento: "Banana", proteína: 6, carbo: 130, gordura: 1 },
    { alimento: "Aveia", proteína: 46, carbo: 265, gordura: 12 },
    { alimento: "Salmão", proteína: 150, carbo: 0, gordura: 34 },
    { alimento: "Azeite de oliva", proteína: 0, carbo: 0, gordura: 98 }
];

const paretoCaloriasData = [
    { alimento: "Arroz branco", kcal: 1200, percent_acumulada: 20 },
    { alimento: "Feijão preto", kcal: 900, percent_acumulada: 35 },
    { alimento: "Frango grelhado", kcal: 850, percent_acumulada: 49 },
    { alimento: "Batata doce", kcal: 650, percent_acumulada: 60 },
    { alimento: "Ovo cozido", kcal: 620, percent_acumulada: 70 },
    { alimento: "Aveia", kcal: 500, percent_acumulada: 78 },
    { alimento: "Salmão", kcal: 420, percent_acumulada: 85 },
    { alimento: "Banana", kcal: 390, percent_acumulada: 92 },
    { alimento: "Brócolis", kcal: 310, percent_acumulada: 97 },
    { alimento: "Azeite de oliva", kcal: 150, percent_acumulada: 100 }
];

const densidadeNutriente = [
    { alimento: "Frango grelhado", proteina_100kcal: 35, fibra_1000kcal: 2 },
    { alimento: "Feijão preto", proteina_100kcal: 12, fibra_1000kcal: 17 },
    { alimento: "Aveia", proteina_100kcal: 9, fibra_1000kcal: 15 },
    { alimento: "Brócolis", proteina_100kcal: 16, fibra_1000kcal: 22 },
    { alimento: "Salmão", proteina_100kcal: 18, fibra_1000kcal: 0 }
];
const densidadeDiaria = [
    { dia: "01/08", proteina_100kcal: 13, fibra_1000kcal: 17 },
    { dia: "07/08", proteina_100kcal: 14, fibra_1000kcal: 16 },
    { dia: "14/08", proteina_100kcal: 12, fibra_1000kcal: 15 },
    { dia: "21/08", proteina_100kcal: 15, fibra_1000kcal: 18 },
    { dia: "28/08", proteina_100kcal: 13, fibra_1000kcal: 19 }
];

const heatmapHorario = [
    { hora: "07:00", segunda: 200, terca: 180, quarta: 210, quinta: 195, sexta: 205, sabado: 220, domingo: 230 },
    { hora: "10:00", segunda: 120, terca: 110, quarta: 130, quinta: 120, sexta: 125, sabado: 140, domingo: 150 },
    { hora: "13:00", segunda: 400, terca: 420, quarta: 410, quinta: 405, sexta: 430, sabado: 460, domingo: 470 },
    { hora: "16:00", segunda: 180, terca: 160, quarta: 170, quinta: 165, sexta: 170, sabado: 190, domingo: 195 },
    { hora: "19:00", segunda: 350, terca: 370, quarta: 355, quinta: 360, sexta: 380, sabado: 390, domingo: 400 },
];

const efeitoFds = [
    { dia: "Semana", kcal: 1950, proteína: 120, carbo: 260, gordura: 60 },
    { dia: "Sábado", kcal: 2200, proteína: 110, carbo: 280, gordura: 72 },
    { dia: "Domingo", kcal: 2300, proteína: 98, carbo: 300, gordura: 82 },
];

const proteinaPorRefeicao = [
    { semana: "Semana 1", cv: 0.18 },
    { semana: "Semana 2", cv: 0.15 },
    { semana: "Semana 3", cv: 0.13 },
    { semana: "Semana 4", cv: 0.17 },
];

const metaDiaria = [
    { dia: "01/08", kcal: 2000, consumido: 2100 },
    { dia: "05/08", kcal: 2000, consumido: 1980 },
    { dia: "10/08", kcal: 2000, consumido: 2030 },
    { dia: "15/08", kcal: 2000, consumido: 1950 },
    { dia: "20/08", kcal: 2000, consumido: 2000 },
    { dia: "25/08", kcal: 2000, consumido: 2200 },
    { dia: "30/08", kcal: 2000, consumido: 2050 }
];

const streak = 6;

const loggingCompleteness = [
    { dia: "01/08", refeicoes_logadas: 5 },
    { dia: "02/08", refeicoes_logadas: 5 },
    { dia: "03/08", refeicoes_logadas: 4 },
    { dia: "04/08", refeicoes_logadas: 5 },
    { dia: "05/08", refeicoes_logadas: 5 },
    { dia: "06/08", refeicoes_logadas: 5 },
    { dia: "07/08", refeicoes_logadas: 5 },
];

const acucarDiaria = [
    { dia: "01/08", acucar: 38 },
    { dia: "05/08", acucar: 35 },
    { dia: "10/08", acucar: 40 },
    { dia: "15/08", acucar: 42 },
    { dia: "20/08", acucar: 39 },
    { dia: "25/08", acucar: 37 },
    { dia: "30/08", acucar: 41 }
];

const sodioDiaria = [
    { dia: "01/08", sodio: 1850 },
    { dia: "05/08", sodio: 2100 },
    { dia: "10/08", sodio: 1950 },
    { dia: "15/08", sodio: 2200 },
    { dia: "20/08", sodio: 2050 },
    { dia: "25/08", sodio: 1980 },
    { dia: "30/08", sodio: 2150 }
];

const saldoEnergetico7d = [
    { dia: "07/08", saldo: 100 },
    { dia: "14/08", saldo: -50 },
    { dia: "21/08", saldo: 80 },
    { dia: "28/08", saldo: 120 },
];

const macrosVsAlvo = [
    { dia: "01/08", proteína: 120, carbo: 250, gordura: 60, prot_alvo: 100, carb_alvo: 260, gord_alvo: 65 },
    { dia: "10/08", proteína: 110, carbo: 270, gordura: 67, prot_alvo: 100, carb_alvo: 260, gord_alvo: 65 },
    { dia: "20/08", proteína: 105, carbo: 260, gordura: 65, prot_alvo: 100, carb_alvo: 260, gord_alvo: 65 },
    { dia: "30/08", proteína: 130, carbo: 280, gordura: 70, prot_alvo: 100, carb_alvo: 260, gord_alvo: 65 }
];

const variedadeAlimentar = [
    { semana: "Semana 1", alimentos_distintos: 19, top5_pct: 51 },
    { semana: "Semana 2", alimentos_distintos: 22, top5_pct: 54 },
    { semana: "Semana 3", alimentos_distintos: 21, top5_pct: 48 },
    { semana: "Semana 4", alimentos_distintos: 23, top5_pct: 49 }
];

const categoriasConsumo = [
    { categoria: "Grãos", qtd: 48 },
    { categoria: "Frutas", qtd: 32 },
    { categoria: "Legumes", qtd: 27 },
    { categoria: "Carnes", qtd: 25 },
    { categoria: "Laticínios", qtd: 20 },
    { categoria: "Oleaginosas", qtd: 12 },
    { categoria: "Óleos", qtd: 10 }
];

const qualidadeLanches = [
    { lanche: "Lanche manhã", proteína: 14, preparo_min: 5 },
    { lanche: "Lanche tarde", proteína: 12, preparo_min: 7 },
    { lanche: "Ceia", proteína: 9, preparo_min: 3 }
];

// Funções de análise mais detalhadas
function analyzeTopMacros(data: typeof topMacros) {
    const protMax = data.reduce((max, cur) => cur.proteína > max.proteína ? cur : max, data[0]);
    const carbMax = data.reduce((max, cur) => cur.carbo > max.carbo ? cur : max, data[0]);
    const gordMax = data.reduce((max, cur) => cur.gordura > max.gordura ? cur : max, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Seu alimento mais proteico foi <b>{protMax.alimento}</b> ({protMax.proteína}g). O maior carboidrato foi <b>{carbMax.alimento}</b> ({carbMax.carbo}g) e o maior em gordura foi <b>{gordMax.alimento}</b> ({gordMax.gordura}g). Esses alimentos são importantes para atingir suas metas nutricionais!
        </>
    );
}
function analyzePareto(data: typeof paretoCaloriasData) {
    const top3 = data.slice(0, 3).map(d => d.alimento).join(", ");
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Os alimentos <b>{top3}</b> somam mais de 49% das calorias no mês. Isso mostra que poucos itens concentram a maior parte do seu consumo energético. Para reduzir calorias, foque nesses alimentos principais.
        </>
    );
}
function analyzeDensity(data: typeof densidadeNutriente) {
    const maxProt = data.reduce((max, cur) => cur.proteina_100kcal > max.proteina_100kcal ? cur : max, data[0]);
    const maxFibra = data.reduce((max, cur) => cur.fibra_1000kcal > max.fibra_1000kcal ? cur : max, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            O alimento mais denso em proteína foi <b>{maxProt.alimento}</b> ({maxProt.proteina_100kcal}g/100kcal), já o mais rico em fibra foi <b>{maxFibra.alimento}</b> ({maxFibra.fibra_1000kcal}g/1000kcal). Prefira alimentos densos para uma dieta saudável e equilibrada.
        </>
    );
}
function analyzeCaloriesByHour(data: typeof heatmapHorario) {
    const horarioMax = data.reduce((prev, curr) =>
        Object.values(curr).slice(1).reduce((a, b) => a + (b as number), 0) >
        Object.values(prev).slice(1).reduce((a, b) => a + (b as number), 0)
            ? curr
            : prev
    );
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            O horário de maior consumo foi às <b>{horarioMax.hora}</b>. Atenção para evitar grandes volumes em um só horário, pois a distribuição equilibrada favorece a saciedade e o controle de peso.
        </>
    );
}
function analyzeWeekendEffect(data: typeof efeitoFds) {
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Nos finais de semana você consumiu mais calorias, especialmente no <b>domingo (2300 kcal)</b>. O excesso pode dificultar o alcance das metas. Tente manter disciplina alimentar também nos finais de semana!
        </>
    );
}
function analyzeProteinCV(data: typeof proteinaPorRefeicao) {
    const menorCV = data.reduce((min, cur) => cur.cv < min.cv ? cur : min, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Sua melhor distribuição de proteína entre as refeições foi na <b>{menorCV.semana}</b>, com coeficiente de variação (CV) de <b>{menorCV.cv}</b>.<br />
            <b>O que é CV?</b> O coeficiente de variação (CV) avalia como a proteína está distribuída nas refeições: quanto mais próximo de zero, mais uniforme.<br />
            <b>Valores de referência:</b>
            <ul style={{ marginLeft: 16, fontSize: "0.95em" }}>
                <li>CV &lt; 0.15: excelente distribuição</li>
                <li>CV entre 0.15 e 0.25: bom</li>
                <li>CV &gt; 0.25: precisa melhorar a regularidade</li>
            </ul>
            Manter o CV baixo melhora absorção e resultados!
        </>
    );
}
function analyzeMetaDiaria(data: typeof metaDiaria) {
    const acertos = data.filter(d => Math.abs(d.consumido - d.kcal) <= d.kcal * 0.05).length;
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Você ficou dentro da meta em <b>{acertos} de {data.length} dias</b>. Isso mostra boa aderência ao plano. O objetivo é manter acerto em pelo menos 80% dos dias do mês.
        </>
    );
}
function analyzeStreak(streak: number) {
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Seu maior streak de acerto foi de <b>{streak} dias consecutivos</b>. Isso demonstra consistência e disciplina alimentar, fundamentais para resultados duradouros.
        </>
    );
}
function analyzeLogging(data: typeof loggingCompleteness) {
    const total = data.length;
    const completos = data.filter(d => d.refeicoes_logadas === 5).length;
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Você registrou todas as refeições em <b>{completos} de {total} dias</b>. Quanto mais regular o registro, mais fácil ajustar a dieta e obter resultados!
        </>
    );
}
function analyzeSugar(data: typeof acucarDiaria) {
    const max = data.reduce((max, cur) => cur.acucar > max.acucar ? cur : max, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Seu dia de maior consumo de açúcar foi <b>{max.dia}</b> com <b>{max.acucar}g</b>. Tente manter o consumo diário abaixo de 40g para evitar riscos à saúde.
        </>
    );
}
function analyzeSodio(data: typeof sodioDiaria) {
    const acima = data.filter(d => d.sodio > 2300).length;
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Você ultrapassou a recomendação de sódio em <b>{acima} de {data.length} dias</b>. O ideal é manter o consumo de sódio abaixo de 2300mg/dia para evitar hipertensão.
        </>
    );
}
function analyzeSaldoEnergetico(data: typeof saldoEnergetico7d) {
    const positivo = data.filter(d => d.saldo > 0).length;
    const negativo = data.filter(d => d.saldo < 0).length;
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Você ficou em superavit energético em <b>{positivo}</b> semanas e em déficit em <b>{negativo}</b> semanas. O saldo positivo pode levar ao ganho de peso, enquanto o negativo favorece o emagrecimento.
        </>
    );
}
function analyzeMacrosVsAlvo(data: typeof macrosVsAlvo) {
    const diasAcima = data.filter(d => d.proteína > d.prot_alvo).length;
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Você superou o alvo de proteína em <b>{diasAcima} dos {data.length} dias</b>. Isso é positivo para manutenção da massa muscular. Mantenha o equilíbrio entre os macros para resultados consistentes.
        </>
    );
}
function analyzeVariedade(data: typeof variedadeAlimentar) {
    const maior = data.reduce((max, cur) => cur.alimentos_distintos > max.alimentos_distintos ? cur : max, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Sua semana mais variada foi <b>{maior.semana}</b>, com <b>{maior.alimentos_distintos} alimentos diferentes</b>. A variedade alimentar garante oferta de diferentes nutrientes e benefícios à saúde.
        </>
    );
}
function analyzeCategorias(data: typeof categoriasConsumo) {
    const top = categoriasConsumo.reduce((max, cur) => cur.qtd > max.qtd ? cur : max, categoriasConsumo[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            A categoria mais consumida foi <b>{top.categoria}</b>, totalizando <b>{top.qtd} itens</b> no mês. Variar entre categorias é essencial para uma dieta equilibrada.
        </>
    );
}
function analyzeLanches(data: typeof qualidadeLanches) {
    const protMax = data.reduce((max, cur) => cur.proteína > max.proteína ? cur : max, data[0]);
    return (
        <>
            <span style={{ fontWeight: 'bold', fontSize: '1.05em' }}>⭐ Análise desse gráfico pela IA:</span><br/>
            Seu lanche mais proteico foi <b>{protMax.lanche}</b> ({protMax.proteína}g), com tempo médio de preparo de <b>{protMax.preparo_min} min</b>. Lanches proteicos auxiliam no controle da fome entre as principais refeições.
        </>
    );
}

// STORYTELLING - Card inicial
function storytelling() {
    return (
        <div>
            <h2 className="text-xl font-bold mb-2">O que seus dados contam sobre você</h2>
            <div className="text-base text-muted-foreground">
             <p>
Durante o mês, você se dedicou a uma alimentação variada e equilibrada, explorando diferentes alimentos e distribuindo bem os macronutrientes nas refeições. Os registros mostram boa consistência e disciplina, com vários dias em que você atingiu suas metas.
</p>
<p>
Apesar dos desafios dos finais de semana, onde o consumo calórico aumentou, você demonstrou força nos dias úteis e conseguiu manter o açúcar sob controle e evitar excessos de sódio na maioria dos dias. O saldo energético foi positivo, mas também houve momentos de déficit que ajudaram no controle de peso.
</p>
<p>
Seu maior destaque foi a variedade alimentar e o registro fiel das refeições, mostrando protagonismo nas escolhas e evolução constante. Cada decisão ao longo do mês contribuiu para uma história de saúde e superação, pronta para novos capítulos.
</p>
            </div>
        </div>
    );
}

export default function ReportsPage() {
    const [period, setPeriod] = useState<"month" | "week" | "all">("month");

    return (
        <div>
            {/* Card Storytelling */}
            <Card className="mb-8 p-6">{storytelling()}</Card>

            <div className="flex items-center mb-4">
                <h1 className="text-lg font-semibold md:text-2xl font-headline">Relatórios</h1>
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant={period === "week" ? "default" : "outline"}
                        onClick={() => setPeriod("week")}
                    >
                        <Filter className="mr-2 h-4 w-4" /> Semana
                    </Button>
                    <Button
                        size="sm"
                        variant={period === "month" ? "default" : "outline"}
                        onClick={() => setPeriod("month")}
                    >
                        <Filter className="mr-2 h-4 w-4" /> Mês
                    </Button>
                    <Button
                        size="sm"
                        variant={period === "all" ? "default" : "outline"}
                        onClick={() => setPeriod("all")}
                    >
                        <Filter className="mr-2 h-4 w-4" /> Tudo
                    </Button>
                </div>
            </div>

            {/* 1) Top fontes por macro */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Top fontes por macronutriente</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra os alimentos que mais contribuem para cada macronutriente consumido: proteína, carboidrato e gordura. Use para identificar fontes predominantes na sua dieta.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart
                            layout="vertical"
                            data={topMacros}
                            margin={{ left: 40, right: 30, top: 20, bottom: 20 }}
                        >
                            <XAxis type="number" label={{ value: "Quantidade (g)", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis type="category" dataKey="alimento" label={{ value: "Alimentos", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="proteína" fill="#0e9f6e" name="Proteína (g)" />
                            <Bar dataKey="carbo" fill="#3b82f6" name="Carboidrato (g)" />
                            <Bar dataKey="gordura" fill="#f59e42" name="Gordura (g)" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeTopMacros(topMacros)}
                    </div>
                </div>
            </Card>

            {/* 2) Pareto de calorias */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Pareto das calorias</h2>
                    <div className="mb-2 text-muted-foreground">
                        Gráfico de Pareto: mostra como poucos alimentos concentram grande parte das calorias ingeridas. Útil para identificar onde é possível fazer cortes ou ajustes mais eficazes.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={paretoCaloriasData} margin={{ left: 30, right: 30, top: 20, bottom: 20 }}>
                            <XAxis dataKey="alimento" label={{ value: "Alimentos", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis yAxisId="left" label={{ value: "Calorias (kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <YAxis yAxisId="right" orientation="right" label={{ value: "Acumulado (%)", angle: -90, position: "insideRight", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="kcal" yAxisId="left" fill="#ef4444" name="Calorias (kcal)" />
                            <Line type="monotone" dataKey="percent_acumulada" yAxisId="right" stroke="#0e9f6e" dot={false} name="Acumulado (%)" />
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzePareto(paretoCaloriasData)}
                    </div>
                </div>
            </Card>

            {/* 3) Densidade proteica & fibra */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Densidade nutricional dos alimentos</h2>
                    <div className="mb-2 text-muted-foreground">
                        Densidade nutricional: mostra quanta proteína e fibra cada alimento oferece em relação à sua quantidade de calorias. Ideal para quem busca refeições mais nutritivas.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={densidadeNutriente} margin={{ left: 30, right: 30, top: 20, bottom: 20 }}>
                            <XAxis dataKey="alimento" label={{ value: "Alimento", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Densidade (g/kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="proteina_100kcal" fill="#0e9f6e" name="Proteína/100kcal" />
                            <Bar dataKey="fibra_1000kcal" fill="#a21caf" name="Fibra/1000kcal" />
                        </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={densidadeDiaria} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Densidade (g/kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="proteina_100kcal" stroke="#0e9f6e" name="Proteína/100kcal" />
                            <Line type="monotone" dataKey="fibra_1000kcal" stroke="#a21caf" name="Fibra/1000kcal" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeDensity(densidadeNutriente)}
                    </div>
                </div>
            </Card>

            {/* 4) Distribuição das calorias por horário */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Distribuição das calorias por horário</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra em quais horários do dia você consome mais calorias, distribuído por cada dia da semana. Ajuda a identificar padrões de ingestão e oportunidades para ajustes.
                    </div>
                </div>
                <div className="px-6">
                    <CaloriesByHourTable data={heatmapHorario} />
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeCaloriesByHour(heatmapHorario)}
                    </div>
                </div>
            </Card>

            {/* 5) Efeito fim de semana */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Efeito fim de semana</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra como seu consumo de calorias, proteína, carboidrato e gordura varia entre dias da semana comuns e finais de semana. Ajuda a entender padrões e ajustar hábitos.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={efeitoFds} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Quantidade (g/kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="kcal" fill="#ef4444" name="Calorias (kcal)" />
                            <Bar dataKey="proteína" fill="#0e9f6e" name="Proteína (g)" />
                            <Bar dataKey="carbo" fill="#3b82f6" name="Carboidrato (g)" />
                            <Bar dataKey="gordura" fill="#f59e42" name="Gordura (g)" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeWeekendEffect(efeitoFds)}
                    </div>
                </div>
            </Card>

            {/* 6) Consistência de proteína por refeição */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Consistência da proteína nas refeições</h2>
                    <div className="mb-2 text-muted-foreground">
                        Consistência de proteína: mostra se a distribuição de proteína entre as refeições está uniforme. Quanto menor o coeficiente de variação (CV), melhor a distribuição.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={proteinaPorRefeicao} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="semana" label={{ value: "Semana", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis domain={[0, 0.5]} label={{ value: "CV Proteína", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="cv" stroke="#a21caf" name="CV Proteína entre refeições" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 110 }}>
                        {analyzeProteinCV(proteinaPorRefeicao)}
                    </div>
                </div>
            </Card>

            {/* 7) Dias dentro da faixa da meta */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Dias dentro da faixa da meta de calorias</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse relatório mostra em quantos dias você conseguiu ficar dentro da sua meta calórica (com tolerância de ±5%). Ajuda a acompanhar a aderência ao objetivo.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={metaDiaria} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Calorias (kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="consumido" stroke="#3b82f6" name="Calorias consumidas" />
                            <Line type="monotone" dataKey="kcal" stroke="#0e9f6e" name="Meta diária" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-2 font-semibold text-green-700">
                        {`Você acertou a meta em 5 de 7 dias (${Math.round((5 / 7) * 100)}%)`}
                    </div>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeMetaDiaria(metaDiaria)}
                    </div>
                </div>
            </Card>

            {/* 8) Streaks de acerto */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Streaks de acerto</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse relatório mostra quantos dias consecutivos você atingiu sua meta calórica. Ajuda a criar gamificação e motivação para manter o hábito.
                    </div>
                </div>
                <div className="px-6">
                    <div className="text-3xl font-bold text-blue-800">{streak} dias</div>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeStreak(streak)}
                    </div>
                </div>
            </Card>

            {/* 9) Completude de logging */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Completude de registro das refeições</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra a quantidade de refeições registradas por dia, ajudando a controlar a regularidade do registro alimentar.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={loggingCompleteness} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis domain={[0, 5]} label={{ value: "Refeições registradas", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Bar dataKey="refeicoes_logadas" fill="#3b82f6" name="Refeições registradas" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeLogging(loggingCompleteness)}
                    </div>
                </div>
            </Card>

            {/* 10) Açúcar total por dia */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Consumo de açúcar por dia</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra a quantidade de açúcar total consumido a cada dia, auxiliando na identificação de excessos e ajustes necessários.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={acucarDiaria} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Açúcar (g)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="acucar" stroke="#f59e42" name="Açúcar (g)" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeSugar(acucarDiaria)}
                    </div>
                </div>
            </Card>

            {/* 11) Sódio diário vs recomendação */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Consumo de sódio por dia</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra o consumo diário de sódio, comparando com a faixa recomendada de até 2.300mg por dia. Útil para monitorar ingestão e evitar riscos à saúde.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={sodioDiaria} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Sódio (mg)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="sodio" stroke="#ef4444" name="Sódio (mg)" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-1 text-sm text-gray-500">Faixa recomendada: até 2300mg/dia</div>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeSodio(sodioDiaria)}
                    </div>
                </div>
            </Card>

            {/* 12) Saldo energético rolling 7 dias */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Saldo energético (média móvel 7 dias)</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra o saldo calórico dos últimos 7 dias, ajudando a prever tendência de peso e entender se está em superavit ou déficit.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={saldoEnergetico7d} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Saldo energético (kcal)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="saldo" stroke="#0e9f6e" name="Saldo energético" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-1 text-sm text-gray-500">
                        Previsão de peso: Δpeso estimado ≈ (saldo_7d / 7700) kg
                    </div>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeSaldoEnergetico(saldoEnergetico7d)}
                    </div>
                </div>
            </Card>

            {/* 13) Macros vs alvo (stacked) */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Macros vs alvo diário</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico compara o consumo real de proteína, carboidrato e gordura com os alvos definidos para cada dia. Ajuda a visualizar desbalanceios e ajustar o plano alimentar.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={macrosVsAlvo} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="dia" label={{ value: "Dia", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Quantidade (g)", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="proteína" stackId="a" fill="#0e9f6e" name="Proteína (g)" />
                            <Bar dataKey="carbo" stackId="a" fill="#3b82f6" name="Carboidrato (g)" />
                            <Bar dataKey="gordura" stackId="a" fill="#f59e42" name="Gordura (g)" />
                            <Line type="monotone" dataKey="prot_alvo" stroke="#0e9f6e" name="Proteína alvo (g)" />
                            <Line type="monotone" dataKey="carb_alvo" stroke="#3b82f6" name="Carboidrato alvo (g)" />
                            <Line type="monotone" dataKey="gord_alvo" stroke="#f59e42" name="Gordura alvo (g)" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeMacrosVsAlvo(macrosVsAlvo)}
                    </div>
                </div>
            </Card>

            {/* 14) Variedade alimentar */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Índice de variedade alimentar</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra a quantidade de alimentos distintos consumidos por semana e a participação dos 5 mais frequentes. Ajuda a promover variedade alimentar.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={variedadeAlimentar} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="semana" label={{ value: "Semana", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Quantidade de alimentos", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="alimentos_distintos" fill="#3b82f6" name="Alimentos distintos/semana" />
                            <Bar dataKey="top5_pct" fill="#ef4444" name="Top 5 (%)" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeVariedade(variedadeAlimentar)}
                    </div>
                </div>
            </Card>

            {/* 15) Categorias mais consumidas */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Categorias mais consumidas</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra a quantidade de itens consumidos por categoria (grãos, frutas, laticínios, etc). Ajuda a identificar padrões e possíveis excessos em alguma categoria.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart layout="vertical" data={categoriasConsumo} margin={{ left: 30, right: 30 }}>
                            <XAxis type="number" label={{ value: "Quantidade", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis type="category" dataKey="categoria" label={{ value: "Categoria", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Bar dataKey="qtd" fill="#3b82f6" name="Quantidade" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeCategorias(categoriasConsumo)}
                    </div>
                </div>
            </Card>

            {/* 16) Qualidade dos lanches */}
            <Card className="mb-8">
                <div className="p-6 pb-0">
                    <h2 className="text-xl font-bold mb-2">Qualidade dos lanches</h2>
                    <div className="mb-2 text-muted-foreground">
                        Esse gráfico mostra a qualidade dos seus lanches em termos de proteína média e tempo de preparo. Útil para avaliar se os snacks estão ajudando a atingir suas metas.
                    </div>
                </div>
                <div className="px-6">
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={qualidadeLanches} margin={{ left: 30, right: 30 }}>
                            <XAxis dataKey="lanche" label={{ value: "Lanche", position: "bottom", offset: 8, fontSize: 14 }} />
                            <YAxis label={{ value: "Quantidade/Tempo", angle: -90, position: "insideLeft", fontSize: 14 }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="proteína" fill="#0e9f6e" name="Proteína média (g)" />
                            <Bar dataKey="preparo_min" fill="#3b82f6" name="Tempo preparo (min)" />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-6 mb-4 p-4 rounded bg-blue-50 text-blue-900 text-base font-medium" style={{ minHeight: 75 }}>
                        {analyzeLanches(qualidadeLanches)}
                    </div>
                </div>
            </Card>
        </div>
    );
}