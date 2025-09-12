"use client"

import {
  Utensils,
  Flame,
  BrainCircuit,
  Zap,
  Loader2,
  CheckCircle,
  ShoppingCart
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import ProgressCharts from "@/components/dashboard/progress-charts"
import MealLogger from "@/components/dashboard/meal-logger"

import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { doc, getDoc, collection, query, orderBy, limit, getDocs, setDoc } from "firebase/firestore"
import { getFirebaseClient } from "@/lib/firebase.client";
const { auth, db } = getFirebaseClient();

// Função para validar se o plano alimentar é VÁLIDO (não é só um prompt de coleta)
function isValidDietPlan(content: string) {
  if (!content) return false;
  const lower = content.trim().toLowerCase();
  return !lower.includes("preciso saber suas necessidades") &&
         !lower.includes("poderia me informar, por favor") &&
         !lower.includes("posso fornecer um exemplo padrão para começar");
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [userData, setUserData] = React.useState<any>(null)
  const [metaData, setMetaData] = React.useState<any>(null)
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Para saber se plano/lista já existem
  const [planoCriado, setPlanoCriado] = React.useState(false)
  const [listaCriada, setListaCriada] = React.useState(false)
  const [planoLoading, setPlanoLoading] = React.useState(true)

  // Onboarding flags
  const [planoVisto, setPlanoVisto] = React.useState<boolean>(false)
  const [listaVisto, setListaVisto] = React.useState<boolean>(false)
  const [onboardingLoading, setOnboardingLoading] = React.useState(true)

  // Busca dados do usuário e meta mais recente + consulta plano/lista no onboarding
  React.useEffect(() => {
    async function fetchData() {
      if (!user?.email) return
      setLoading(true)
      setPlanoLoading(true)
      setOnboardingLoading(true)
      try {
        const userRef = doc(db, "chatfit", user.email)
        const userSnap = await getDoc(userRef)
        const userData = userSnap.exists() ? userSnap.data() : {}

        const metasRef = collection(db, "chatfit", user.email, "metasusuario")
        const metasQuery = query(metasRef, orderBy("createdAt", "desc"), limit(1))
        const metasSnap = await getDocs(metasQuery)
        let metaData = null
        metasSnap.forEach(doc => {
          metaData = doc.data()
        })

        setUserData(userData)
        setMetaData(metaData)

        // Consulta plano de dieta gerado no onboarding
        const planoRef = doc(db, "chatfit", user.email, "planos", "dieta")
        const planoSnap = await getDoc(planoRef)
        const planoData = planoSnap.exists() ? planoSnap.data() : null
        const planoValido = planoData && isValidDietPlan(planoData.content)
        setPlanoCriado(planoValido);

        // Consulta lista de compras gerada no onboarding (só criada se plano válido)
        const listaRef = doc(db, "chatfit", user.email, "listas", "lista_padrao")
        const listaSnap = await getDoc(listaRef)
        const listaData = listaSnap.exists() ? listaSnap.data() : null
        const listaValida = listaData && Array.isArray(listaData.alimentos) && listaData.alimentos.length > 0 && planoValido
        setListaCriada(listaValida);

        // Onboarding flags: checa se usuário já clicou nos botões
        const onboardingRef = doc(db, "chatfit", user.email, "onboarding", "flags")
        const onboardingSnap = await getDoc(onboardingRef)
        let flags = { planoVisto: false, listaVisto: false }
        if (onboardingSnap.exists()) {
          const data = onboardingSnap.data()
          flags.planoVisto = !!data.planoVisto
          flags.listaVisto = !!data.listaVisto
        }
        setPlanoVisto(flags.planoVisto)
        setListaVisto(flags.listaVisto)

      } catch (error) {
        console.error("Erro ao buscar dados do usuário/metas/plano/lista:", error)
      }
      setLoading(false)
      setPlanoLoading(false)
      setOnboardingLoading(false)
    }
    fetchData()
  }, [user])

  async function handleLogout() {
    await logout()
    router.push("/login")
  }

  function handleAfterMealLogged() {
    setRefreshKey(prev => prev + 1);
  }

  // Handler: marcar flag ao clicar no botão
  async function handlePlanoVisto() {
    if (!user?.email) return
    setPlanoVisto(true)
    const onboardingRef = doc(db, "chatfit", user.email, "onboarding", "flags")
    await setDoc(onboardingRef, { planoVisto: true }, { merge: true })
  }

  async function handleListaVisto() {
    if (!user?.email) return
    setListaVisto(true)
    const onboardingRef = doc(db, "chatfit", user.email, "onboarding", "flags")
    await setDoc(onboardingRef, { listaVisto: true }, { merge: true })
  }

  if (loading || planoLoading || onboardingLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary">
        <Loader2 className="animate-spin h-10 w-10 mb-2" />
        <div>Carregando dashboard...</div>
      </div>
    )
  }

  if (!user) {
    router.push("/login")
    return null
  }

  // Dados dos cards usando metaData mais recente
  const caloriasMeta = metaData?.caloriasMeta ?? 2250
  const proteina = metaData?.proteina ?? 160
  const carboidrato = metaData?.carboidrato ?? 240
  const gordura = metaData?.gordura ?? 80
  const nomeUsuario = userData?.nome || "Usuário"

  return (
    <>
      {/* TÍTULO + LOGOUT (no topo) */}
      <div className="flex items-center mb-4 justify-between">
        <h1 className="text-lg font-semibold md:text-2xl font-headline">
          Bem-vindo, {nomeUsuario}!
        </h1>
        <Button
          onClick={handleLogout}
          variant="outline"
          className="border-[#c4620a] text-[#c4620a] hover:bg-[#c4620a] hover:text-white"
        >
          Logout
        </Button>
      </div>

      {/* ALERTAS NO TOPO - só mostra se NÃO foi visto */}
      <div className="flex flex-col gap-4 mb-6">
        {!planoVisto && (
          <Card
            className="shadow-lg"
            style={{
              borderWidth: 2,
              borderColor: "#c4620a",
              background: "rgba(196, 98, 10, 0.08)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle style={{ color: "#c4620a" }} /> Plano de dieta criado!
                </CardTitle>
                <CardDescription>
                  Seu plano alimentar está pronto. Clique abaixo para visualizar detalhes.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="font-bold text-white"
                style={{ backgroundColor: "#c4620a" }}
                asChild
                disabled={!planoCriado || planoLoading}
                onClick={handlePlanoVisto}
              >
                <Link href="/dashboard/diet-plan-suggestion">Visualizar plano de dieta</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        {!listaVisto && (
          <Card
            className="shadow-lg"
            style={{
              borderWidth: 2,
              borderColor: "#d4af37",
              background: "rgba(212, 175, 55, 0.12)",
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ShoppingCart style={{ color: "#d4af37" }} /> Lista de compras pronta!
                </CardTitle>
                <CardDescription>
                  Sua lista de compras dos alimentos da dieta já está feita. Clique abaixo para visualizar.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                size="lg"
                className="font-bold text-black"
                style={{ backgroundColor: "#d4af37" }}
                asChild
                disabled={!listaCriada || planoLoading}
                onClick={handleListaVisto}
              >
                <Link href="/dashboard/shopping-list">Visualizar lista de compras</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cards menores: metas de calorias e macros */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Meta de Calorias
            </CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{caloriasMeta.toLocaleString()} kcal</div>
            <p className="text-[11px] text-muted-foreground">
              Sua meta diária
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Proteína
            </CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{proteina}g</div>
            <p className="text-[11px] text-muted-foreground">Meta diária</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Carboidratos</CardTitle>
            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{carboidrato}g</div>
            <p className="text-[11px] text-muted-foreground">Meta diária</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs sm:text-sm font-medium">Gordura</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl font-bold">{gordura}g</div>
            <p className="text-[11px] text-muted-foreground">Meta diária</p>
          </CardContent>
        </Card>
      </div>

      {/* ProgressCharts e MealLogger empilhados (mesma largura do conteúdo) */}
      <div className="mt-8 space-y-6">
        <ProgressCharts
          caloriasMeta={caloriasMeta}
          proteinaMeta={proteina}
          carboidratoMeta={carboidrato}
          gorduraMeta={gordura}
          refreshKey={refreshKey}
        />
        <MealLogger onMealLogged={handleAfterMealLogged} />
      </div>
    </>
  )
}
