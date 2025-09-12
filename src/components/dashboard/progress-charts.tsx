"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseClient } from "@/lib/firebase.client";
const { auth, db } = getFirebaseClient();
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

type Props = {
  caloriasMeta?: number;
  proteinaMeta?: number;
  carboidratoMeta?: number;
  gorduraMeta?: number;
  aguaMeta?: number; // fallback caso não exista em metasusuario
  refreshKey?: number;
};

// === Utils ===
function useIsDarkMode() {
  const [isDark, setIsDark] = React.useState(false);
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDark(
        window.matchMedia("(prefers-color-scheme: dark)").matches ||
          document.documentElement.classList.contains("dark")
      );
    }
  }, []);
  return isDark;
}

function getDiaAtual() {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs);
  return local.toISOString().slice(0, 10);
}

// ===== Tooltip simples por hover =====
function HoverTooltip({
  text,
  children,
}: {
  text: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative inline-block group">
      {children}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50
                   bg-popover text-popover-foreground border border-border shadow-sm px-3 py-2 rounded text-xs whitespace-pre-line w-max max-w-[260px]"
      >
        {text}
      </div>
    </div>
  );
}

// ===== VELOCÍMETRO SVG =====
function CircularGauge({
  label,
  atual,
  meta,
  unidade = "g",
  size = 110,
  color = "hsl(var(--chart-1))",
  bgColor = "hsl(var(--muted))",
  destaque = false,
  icon,
  showMeta = true,
}: {
  label: string;
  atual: number;
  meta: number;
  unidade?: string;
  size?: number;
  color?: string;
  bgColor?: string;
  destaque?: boolean;
  icon?: React.ReactNode;
  showMeta?: boolean;
}) {
  const percent = meta > 0 ? Math.min(atual / meta, 1) : 0;
  const passouMeta = atual > meta && meta > 0;
  const stroke = destaque ? 18 : 10;
  const radius = size / 2 - stroke;
  const circ = 2 * Math.PI * radius;
  const isDark = useIsDarkMode();

  const corPrincipal = passouMeta
    ? isDark
      ? "#f87171"
      : "hsl(var(--destructive))"
    : color;
  const corBg = passouMeta
    ? isDark
      ? "rgba(248,113,113,0.35)"
      : "hsla(var(--destructive),0.35)"
    : bgColor;

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ minWidth: size, width: size }}
    >
      <div className="font-bold mb-1 text-base text-foreground text-center flex items-center gap-2">
        {icon ? <span className="inline-block mr-1">{icon}</span> : null}
        {label}
      </div>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={corBg}
            strokeWidth={stroke}
            fill="none"
            opacity={0.35}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={corPrincipal}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - percent)}
            style={{ transition: "stroke-dashoffset 0.5s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span
            className={`font-bold text-2xl ${
              passouMeta ? "text-destructive dark:text-red-400" : "text-chart-1"
            }`}
          >
            {Number(atual).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            })}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {unidade}
          </span>
          {showMeta && (
            <span
              className={`font-bold mt-1 rounded px-2 py-1 text-xs ${
                passouMeta
                  ? "text-destructive dark:text-red-400 bg-destructive/10 dark:bg-red-400/20"
                  : "text-chart-1 bg-muted"
              }`}
              style={{
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              / {Number(meta).toLocaleString(undefined, { maximumFractionDigits: 1 })}{" "}
              {unidade}
            </span>
          )}
        </div>
      </div>
      {passouMeta && (
        <div className="flex items-center mt-2">
          <span
            className="text-destructive dark:text-red-400 bg-destructive/10 dark:bg-red-400/20"
            style={{
              fontSize: "0.95em",
              fontWeight: 500,
              borderRadius: "4px",
              padding: "2px 8px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ⚠️ acima da meta
          </span>
        </div>
      )}
    </div>
  );
}

// ===== Painel de Exercício físico =====
function ExercisePanel({
  totalCalorias,
  exercicios,
}: {
  totalCalorias: number;
  exercicios: any[];
}) {
  return (
    <div className="flex flex-col items-center justify-center min-w-[220px] mx-auto">
      <div className="font-bold mb-2 text-base text-foreground text-center">
        Exercício Físico
      </div>
      <div className="flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-2">
          <HoverTooltip text={`As calorias queimadas nos exercícios são somadas à sua meta diária de calorias.\nEx.: se a meta é 1800 kcal e você queimou 300 kcal, a meta vira 2100 kcal.`}>
            <span
              className="select-none"
              style={{
                fontWeight: 700,
                color: "hsl(var(--muted-foreground))",
                fontSize: "1em",
                borderRadius: "50%",
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--muted))",
                width: 18,
                height: 18,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "default",
              }}
              aria-label="Ajuda sobre meta de calorias"
            >
              ?
            </span>
          </HoverTooltip>
          <span className="text-4xl font-bold text-chart-2">
            {Math.round(totalCalorias)}
          </span>
        </div>
        <span
          className="bg-muted text-chart-2 font-bold"
          style={{
            fontSize: "1.15em",
            marginTop: 4,
            borderRadius: "6px",
            padding: "2px 14px",
          }}
        >
          kcal feitas
        </span>
      </div>
      <div className="mt-4 w-full flex flex-col items-center">
        {exercicios.length === 0 ? (
          <span className="text-muted-foreground text-base mt-2 text-center">
            nenhum exercício registrado hoje
          </span>
        ) : (
          <div className="text-base font-medium text-center flex flex-col gap-1 text-chart-2">
            {exercicios.map((ex, idx) => (
              <span key={idx}>
                {ex.duracao ? `${ex.duracao} ` : ""}
                {ex.tipo ? ex.tipo : ""}
                {ex.calorias ? ` (${ex.calorias} kcal)` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ====== MacroBar ======
function MacroBar({
  label,
  atual,
  meta,
}: {
  label: string;
  atual: number;
  meta: number;
}) {
  const percent = meta > 0 ? Math.min(atual / meta, 1) : 0;
  const passouMeta = atual > meta;
  const atualFormatado = Math.round(atual * 10) / 10;
  const metaFormatada = Math.round(meta * 10) / 10;

  return (
    <div className="flex flex-col items-start gap-0 relative min-h-[54px] w-full">
      <div className="flex items-end gap-2 relative w-full">
        <span className="min-w-[100px] text-base font-semibold text-foreground break-words">
          {label}
        </span>
        <div className="relative flex items-center h-8 flex-1 min-w-[80px] max-w-[180px] w-full">
          <span
            className={`absolute text-xs font-bold ${
              passouMeta
                ? "text-destructive dark:text-red-400"
                : "text-chart-1"
            }`}
            style={{
              left: Math.min(180 * percent - 24, 180 - 38),
              top: -18,
              minWidth: 28,
              textAlign: "center",
              transition: "left 0.4s",
            }}
          >
            {atualFormatado}g
          </span>
          <div
            className={`absolute left-0 top-0 h-8 w-full rounded ${
              passouMeta ? "bg-destructive/30 dark:bg-red-400/70" : "bg-muted"
            }`}
          />
          <div
            className={`absolute left-0 top-0 h-8 rounded ${
              passouMeta ? "bg-destructive dark:bg-red-400" : "bg-chart-1"
            }`}
            style={{
              width: `${percent * 100}%`,
              transition: "width 0.4s",
            }}
          />
        </div>
        <span
          className={`px-2 py-1 rounded ml-2 font-bold text-right text-xs ${
            passouMeta
              ? "text-destructive dark:text-red-400 bg-destructive/10 dark:bg-red-400/20"
              : "text-chart-1 bg-muted"
          }`}
          style={{ minWidth: 48 }}
        >
          Meta: {metaFormatada}g
        </span>
      </div>
      {passouMeta && (
        <div className="flex items-center mt-1 ml-[7.5rem] min-h-[18px]">
          <span
            className="text-destructive dark:text-red-400 bg-destructive/10 dark:bg-red-400/20"
            style={{
              fontSize: "0.88em",
              fontWeight: 500,
              borderRadius: "4px",
              padding: "1px 6px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            ⚠️ ingestão acima da meta
          </span>
        </div>
      )}
    </div>
  );
}

// ====== Barra de Água (horizontal azul, com emoji) ======
function WaterBar({
  atual,
  meta,
}: {
  atual: number;
  meta: number;
}) {
  const percent = meta > 0 ? Math.min(atual / meta, 1) : 0;
  const atualFmt = Math.round(atual);
  const metaFmt = Math.round(meta);

  return (
    <div className="mt-6 w-full">
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-base text-foreground flex items-center gap-2">
          <span role="img" aria-label="água">💧</span> Água
        </div>
        <div className="text-xs font-semibold text-muted-foreground">
          {atualFmt} / {metaFmt} ml
        </div>
      </div>
      <div className="relative h-4 w-full rounded bg-[#dbeafe]">
        <div
          className="absolute left-0 top-0 h-4 rounded bg-[#3b82f6]"
          style={{ width: `${percent * 100}%`, transition: "width 0.4s" }}
        />
      </div>
    </div>
  );
}

// ====== ProgressCharts principal ======
export default function ProgressCharts({
  caloriasMeta = 1200,
  proteinaMeta = 108,
  carboidratoMeta = 71,
  gorduraMeta = 54,
  aguaMeta = 2500, // fallback
  refreshKey = 0,
}: Props) {
  const { user } = useAuth();

  const [caloriasAtual, setCaloriasAtual] = React.useState(0);
  const [proteinaAtual, setProteinaAtual] = React.useState(0);
  const [carboidratoAtual, setCarboidratoAtual] = React.useState(0);
  const [gorduraAtual, setGorduraAtual] = React.useState(0);
  const [aguaAtual, setAguaAtual] = React.useState(0);

  const [exercicioCalorias, setExercicioCalorias] = React.useState(0);
  const [exercicios, setExercicios] = React.useState<any[]>([]);

  // Meta de água vinda do Firestore (metasusuario.waterGoalMl)
  const [aguaMetaUser, setAguaMetaUser] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!user?.email) return;
    const dia = getDiaAtual();

    // Resumo de refeições do dia (acumulado)
    const resumoDocRef = doc(
      db,
      "chatfit",
      user.email,
      "refeicoes",
      dia,
      "resumo",
      "acumulado"
    );
    const unsubResumo = onSnapshot(resumoDocRef, (resumoSnap) => {
      if (resumoSnap.exists()) {
        const resumo = resumoSnap.data() ?? {};
        setCaloriasAtual(resumo.calorias ?? 0);
        setProteinaAtual(resumo.proteina ?? 0);
        setCarboidratoAtual(resumo.carboidrato ?? 0);
        setGorduraAtual(resumo.gordura ?? 0);
        setAguaAtual(resumo.agua ?? 0);
      } else {
        setCaloriasAtual(0);
        setProteinaAtual(0);
        setCarboidratoAtual(0);
        setGorduraAtual(0);
        setAguaAtual(0);
      }
    });

    // Exercícios do dia
    const exercicioDocRef = doc(db, "chatfit", user.email, "exerciciosDoDia", dia);
    const unsubExercicio = onSnapshot(exercicioDocRef, (exSnap) => {
      if (exSnap.exists()) {
        const dados = exSnap.data();
        const lista = Array.isArray(dados.exercicios) ? dados.exercicios : [];
        let totalCalEx = 0;
        lista.forEach((ex) => {
          totalCalEx += Number(ex.calorias) || 0;
        });
        setExercicios(lista);
        setExercicioCalorias(totalCalEx);
      } else {
        setExercicios([]);
        setExercicioCalorias(0);
      }
    });

    // Meta de água do usuário (metasusuario -> doc mais recente)
    const metasRef = collection(db, "chatfit", user.email, "metasusuario");
    let unsubMeta: (() => void) | null = null;

    try {
      const q = query(metasRef, orderBy("createdAt", "desc"), limit(1));
      unsubMeta = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data() as any;
          const ml =
            Number(d?.waterGoalMl) ||
            Number(d?.aguaMeta) || // fallback de nome antigo
            0;
          if (ml > 0) setAguaMetaUser(ml);
        }
      });
    } catch (e) {
      // fallback caso não exista índice/campo
      getDocs(metasRef)
        .then((snap) => {
          if (!snap.empty) {
            const d = snap.docs[0].data() as any;
            const ml =
              Number(d?.waterGoalMl) ||
              Number(d?.aguaMeta) ||
              0;
            if (ml > 0) setAguaMetaUser(ml);
          }
        })
        .catch(() => {
          /* silencioso */
        });
    }

    return () => {
      unsubResumo();
      unsubExercicio();
      if (unsubMeta) unsubMeta();
    };
  }, [user, refreshKey]);

  // Metas ajustadas por exercício
  const metaCaloriasAjustada = caloriasMeta + exercicioCalorias;
  const pProteina = caloriasMeta > 0 ? proteinaMeta / caloriasMeta : 0;
  const pCarbo = caloriasMeta > 0 ? carboidratoMeta / caloriasMeta : 0;
  const pGordura = caloriasMeta > 0 ? gorduraMeta / caloriasMeta : 0;

  const metaProteinaAjustada = Math.round(
    proteinaMeta + exercicioCalorias * pProteina
  );
  const metaCarboAjustada = Math.round(
    carboidratoMeta + exercicioCalorias * pCarbo
  );
  const metaGorduraAjustada = Math.round(
    gorduraMeta + exercicioCalorias * pGordura
  );

  // Meta de água final: Firestore > prop fallback
  const aguaMetaFinal = Number(aguaMetaUser ?? aguaMeta ?? 0);

  return (
    <div className="rounded-lg p-3 md:p-6 border border-border bg-card">
      <div className="font-semibold text-xl mb-2 text-foreground">
        Progresso de Hoje
      </div>
      <div className="text-muted-foreground mb-4 text-sm">
        Um resumo visual da sua ingestão de hoje.
      </div>

      {/* Linha principal: Exercício + Calorias + Macros */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 items-center justify-center w-full">
        <ExercisePanel
          totalCalorias={exercicioCalorias}
          exercicios={exercicios}
        />

        {/* Calorias */}
        <CircularGauge
          label="Calorias"
          atual={caloriasAtual}
          meta={metaCaloriasAjustada}
          unidade="kcal"
          size={192}
          color="hsl(var(--chart-1))"
          bgColor="hsl(var(--muted))"
          destaque
        />

        {/* Macros + Água abaixo */}
        <div className="flex-1 flex flex-col justify-center items-center w-full max-w-[420px] mx-auto">
          <div className="font-bold mb-2 text-base text-foreground">
            Macronutrientes (g)
          </div>
          <div className="space-y-8 pt-1 w-full">
            <MacroBar
              label="Proteína"
              atual={proteinaAtual}
              meta={metaProteinaAjustada}
            />
            <MacroBar
              label="Carboidratos"
              atual={carboidratoAtual}
              meta={metaCarboAjustada}
            />
            <MacroBar
              label="Gordura"
              atual={gorduraAtual}
              meta={metaGorduraAjustada}
            />

            {/* Água: barra horizontal azul logo abaixo dos macros */}
            <WaterBar atual={aguaAtual} meta={aguaMetaFinal} />
          </div>
        </div>
      </div>
    </div>
  );
}
