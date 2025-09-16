"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { getFirebaseClient } from "@/lib/firebase.client";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, setDoc, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

// Parser para plano agrupado por refeição (formato da LLM atual)
function parseGroupedDietPlan(alimentos?: any[]) {
  if (!alimentos || !Array.isArray(alimentos) || alimentos.length === 0) return null;
  const meals: any[] = [];
  const totals = { protein: 0, carbs: 0, fat: 0 };
  for (const refeicao of alimentos) {
    if (!refeicao?.refeicao || !Array.isArray(refeicao.alimentos)) continue;
    const items: string[] = [];
    for (const a of refeicao.alimentos) {
      items.push(
        `${a.quantidade} de ${a.nome}: ${a.proteinas}g proteína, ${a.carboidratos}g carboidrato, ${a.gorduras}g gordura`
      );
      totals.protein += Number(a?.proteinas ?? 0);
      totals.carbs += Number(a?.carboidratos ?? 0);
      totals.fat += Number(a?.gorduras ?? 0);
    }
    meals.push({ title: refeicao.refeicao, items });
  }
  return { meals, totals };
}

export default function DietPlanSuggestionPage() {
  // ✅ obter db do client SDK (evita import server-side)
  const { db } = getFirebaseClient();

  const { user } = useAuth();
  const router = useRouter();

  const [observacao, setObservacao] = useState<string>("");
  const diasPlano = 7;

  const [userMacros, setUserMacros] = useState<{ protein: string; carbs: string; fat: string }>({
    protein: "",
    carbs: "",
    fat: "",
  });

  const [dietPlan, setDietPlan] = useState<string>("");
  const [parsedPlan, setParsedPlan] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMacros, setLoadingMacros] = useState<boolean>(true);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [activeAlimentos, setActiveAlimentos] = useState<any[] | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [loadingActive, setLoadingActive] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Carrega metas do usuário (proteína, carbo, gordura)
  useEffect(() => {
    async function fetchUserMacros() {
      if (!user?.email) {
        setLoadingMacros(false);
        return;
      }
      setLoadingMacros(true);
      try {
        const metasCollectionRef = collection(db, "chatfit", user.email, "metasusuario");
        const metasSnap = await getDocs(metasCollectionRef);

        if (!metasSnap.empty) {
          const docData: any = metasSnap.docs[0].data();
          setUserMacros({
            protein: docData?.proteina ? String(docData.proteina) : "",
            carbs: docData?.carboidrato ? String(docData.carboidrato) : "",
            fat: docData?.gordura ? String(docData.gordura) : "",
          });
        } else {
          setUserMacros({ protein: "", carbs: "", fat: "" });
        }
      } catch {
        setUserMacros({ protein: "", carbs: "", fat: "" });
      }
      setLoadingMacros(false);
    }
    fetchUserMacros();
  }, [db, user]);

  // Carrega plano ativo salvo (texto simples ou alimentos agrupados)
  useEffect(() => {
    async function fetchActivePlan() {
      if (!user?.email) {
        setActivePlan(null);
        setActiveAlimentos(null);
        setLoadingActive(false);
        return;
      }
      setLoadingActive(true);
      try {
        const planRef = doc(db, "chatfit", user.email, "planos", "dieta");
        const planSnap = await getDoc(planRef);
        if (planSnap.exists()) {
          const data: any = planSnap.data();
          setActivePlan(data?.content || null);
          setActiveAlimentos(Array.isArray(data?.alimentos) ? data.alimentos : null);
        } else {
          setActivePlan(null);
          setActiveAlimentos(null);
        }
      } catch {
        setActivePlan(null);
        setActiveAlimentos(null);
      }
      setLoadingActive(false);
    }
    fetchActivePlan();
  }, [db, user, dietPlan]);

  // Reset de visual ao alterar parâmetros
  useEffect(() => {
    setDietPlan("");
    setParsedPlan(null);
    setErrorMsg("");
  }, [observacao, userMacros.protein, userMacros.carbs, userMacros.fat]);

  async function savePlanToFirestore(dietPlanStr: string, alimentos: any[] | null, userEmail: string) {
    if (!userEmail) return;
    try {
      const dietPlanRef = doc(db, "chatfit", userEmail, "planos", "dieta");
      if (dietPlanStr) {
        await setDoc(
          dietPlanRef,
          {
            content: dietPlanStr,
            alimentos: alimentos || [],
            updatedAt: new Date().toISOString(),
          },
          { merge: false }
        );
      }
    } catch {
      // opcional: setErrorMsg("Erro ao salvar plano no banco de dados.");
    }
  }

  async function handleSuggestDiet(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (!userMacros.protein || !userMacros.carbs || !userMacros.fat) {
      setErrorMsg("Preencha todas as metas de proteína, carboidratos e gordura.");
      setLoading(false);
      return;
    }

    const obsFinal =
      observacao && observacao.trim().length > 0 ? observacao : "Nenhuma restrição específica.";

    // PROMPT: retorna apenas o bloco JSON entre <FOODS_JSON>...</FOODS_JSON>
    const systemPrompt = `
Faça um plano alimentar para UM DIA, o mais próximo possível das metas dos macros abaixo, sem desvio padrão.
ATENÇÃO:
- Não ultrapasse as metas de gordura e carboidrato em hipótese alguma.
- Se faltar gordura, complete com azeite de oliva extra virgem.
- Se faltar carboidrato, complete com maltodextrina ou suplemento similar.
- Se faltar proteína, complete com whey protein isolado.
- Informe claramente como as metas foram completadas.
Retorne APENAS o bloco <FOODS_JSON>...<FOODS_JSON> como array JSON, sem comentários nem texto extra.
Cada alimento deve informar as gramagens de proteína, carboidrato e gordura.
Formato de saída:
<FOODS_JSON>[
  {
    "refeicao": "Café da Manhã",
    "alimentos": [
      {"nome": "Ovos mexidos", "quantidade": "3 ovos", "proteinas": 18, "carboidratos": 1, "gorduras": 15}
      ...
    ]
  },
  ...
]</FOODS_JSON>
Metas diárias do usuário:
- Proteína: ${userMacros.protein}g
- Carboidratos: ${userMacros.carbs}g
- Gordura: ${userMacros.fat}g
Observações/restrições do usuário: ${obsFinal}
`.trim();

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: obsFinal },
    ] as const;

    try {
      const response = await fetch("/api/generate-diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          userEmail: user?.email || "",
        }),
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        setErrorMsg("Erro interno ao decodificar resposta do servidor.");
        setLoading(false);
        return;
      }

      if (!response.ok || data?.error) {
        setErrorMsg(data?.error || "Não foi possível gerar o plano. Tente novamente.");
        setDietPlan("");
        setParsedPlan(null);
      } else if (data?.reply) {
        setDietPlan(data.reply || "");
        const parsed = parseGroupedDietPlan(data.alimentos);
        setParsedPlan(parsed);
        await savePlanToFirestore(data.reply || "", data.alimentos || [], user?.email || "");
        setShowForm(false);
      } else {
        setErrorMsg("Não foi possível gerar o plano. Tente novamente.");
        setDietPlan("");
        setParsedPlan(null);
      }
    } catch {
      setErrorMsg("Erro inesperado ao gerar plano. Tente novamente.");
      setDietPlan("");
      setParsedPlan(null);
    }
    setLoading(false);
  }

  function renderPlanoFormatado(parsedPlan: any) {
    if (!parsedPlan) return null;
    return (
      <div>
        {parsedPlan.meals.length > 0 &&
          parsedPlan.meals.map((meal: any, i: number) => (
            <div key={i} className="mb-3">
              <div className="font-semibold">{meal.title}</div>
              <ul className="list-disc ml-5">
                {meal.items.map((item: string, j: number) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        {parsedPlan.totals && (
          <div className="mt-4 p-2 bg-muted rounded">
            <div className="font-bold mb-1">Totais do Dia</div>
            <pre className="text-xs whitespace-pre-line">
              Proteína: {parsedPlan.totals.protein}g{"\n"}
              Carboidratos: {parsedPlan.totals.carbs}g{"\n"}
              Gordura: {parsedPlan.totals.fat}g
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (loadingActive) {
    return (
      <div className="max-w-4xl mx-auto w-full flex gap-6">
        <div className="flex-1">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 text-center text-muted-foreground my-4">
                <Loader2 className="animate-spin h-6 w-6" />
                Carregando plano de dieta...
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activePlan && !showForm) {
    return (
      <div className="max-w-4xl mx-auto w-full flex gap-6 relative">
        <div className="flex-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Plano de Dieta Atual</CardTitle>
              <Button
                size="sm"
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 ml-4"
                onClick={() => setShowForm(true)}
              >
                Criar outro plano de dieta
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                {activeAlimentos && activeAlimentos.length > 0
                  ? renderPlanoFormatado(parseGroupedDietPlan(activeAlimentos))
                  : <div className="bg-muted/50 p-4 rounded-md text-sm whitespace-pre-line">{activePlan}</div>
                }
              </div>
              <Button
                size="lg"
                className="w-full mt-8 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-bold py-6 rounded-xl"
                onClick={() => router.push("/dashboard/shopping-list")}
              >
                Clique aqui para visualizar sua lista de compra para mercado/hortifrut
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full flex gap-6">
      <div className="flex-1">
        <Card>
          <CardHeader>
            <CardTitle>Plano de Dieta Personalizado</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSuggestDiet} className="space-y-4">
              <div>
                <label htmlFor="observacao" className="block text-sm font-semibold mb-1">
                  Tem alguma consideração para passar antes de elaborar o plano para você?
                </label>
                <Textarea
                  id="observacao"
                  name="observacao"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex: sou vegetariana, sou alérgico a castanhas, gosto de whey protein, não gosto de banana..."
                  rows={3}
                  autoComplete="on"
                />
              </div>
              <div>
                <span className="block text-sm font-semibold mb-2">
                  Meta calculada pelo ChatFit
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="proteinas" className="block text-xs font-medium mb-1">
                      Proteínas (g)
                    </label>
                    <Input
                      id="proteinas"
                      name="proteinas"
                      type="number"
                      placeholder="Proteínas"
                      value={userMacros.protein}
                      onChange={(e) => setUserMacros({ ...userMacros, protein: e.target.value })}
                      disabled={loadingMacros}
                      min="0"
                      autoComplete="on"
                    />
                  </div>
                  <div>
                    <label htmlFor="carboidratos" className="block text-xs font-medium mb-1">
                      Carboidratos (g)
                    </label>
                    <Input
                      id="carboidratos"
                      name="carboidratos"
                      type="number"
                      placeholder="Carboidratos"
                      value={userMacros.carbs}
                      onChange={(e) => setUserMacros({ ...userMacros, carbs: e.target.value })}
                      disabled={loadingMacros}
                      min="0"
                      autoComplete="on"
                    />
                  </div>
                  <div>
                    <label htmlFor="gorduras" className="block text-xs font-medium mb-1">
                      Gorduras (g)
                    </label>
                    <Input
                      id="gorduras"
                      name="gorduras"
                      type="number"
                      placeholder="Gorduras"
                      value={userMacros.fat}
                      onChange={(e) => setUserMacros({ ...userMacros, fat: e.target.value })}
                      disabled={loadingMacros}
                      min="0"
                      autoComplete="on"
                    />
                  </div>
                </div>
              </div>
              <div>
                <span className="block text-sm mb-2 font-semibold">
                  Plano para <span className="font-bold">{diasPlano}</span> dias
                </span>
              </div>
              {errorMsg && <div className="text-red-600 font-semibold text-sm mb-2">{errorMsg}</div>}
              <Button
                type="submit"
                disabled={loading || loadingMacros}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white border-none"
              >
                {loading || loadingMacros ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    IA está pensando, aguarde...
                  </>
                ) : (
                  "Gerar Plano de Dieta"
                )}
              </Button>
            </form>

            <div className="mt-8">
              <h3 className="text-lg font-bold mb-4">Plano alimentar sugerido</h3>
              {loading ? (
                <div className="flex items-center gap-2 text-center text-muted-foreground my-4">
                  <Loader2 className="animate-spin h-6 w-6" />
                  IA está pensando, aguarde...
                </div>
              ) : errorMsg ? (
                <div className="text-red-600 font-semibold text-sm">{errorMsg}</div>
              ) : parsedPlan ? (
                renderPlanoFormatado(parsedPlan)
              ) : (
                dietPlan && <div className="bg-muted/50 p-4 rounded-md text-sm whitespace-pre-line">{dietPlan}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
