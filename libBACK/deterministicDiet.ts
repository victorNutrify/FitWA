// src/lib/deterministicDiet.ts
// Ferramentas determinísticas para o pipeline híbrido:
// - adjustDay: ajuste final do dia (±6% em Kcal, P, C, G) com limites de porção realistas
// - formatPlanTextBR: saída textual com unidades "humanas"

import { findFoodByName, macrosPer100FromTaco, norm } from "@/lib/tacoDb";

export type MealKeyPt = "cafe_da_manha" | "lanche_manha" | "almoco" | "lanche_tarde" | "jantar";

export type DailyGoals = { calorias: number; proteina: number; carboidrato: number; gordura: number };

export type AlimentoItem = {
  meal: MealKeyPt;
  name: string;
  quantity: number; // g
  unit: "g";
  macro: { calories: number; protein: number; carbs: number; fat: number; source?: string };
};

export type UserPrefs = {
  disallowNames?: string[];
  likeNames?: string[];
  mustIncludeByMeal?: Partial<Record<MealKeyPt, string[]>>;
  gramStep?: number;
  tolerancePct?: number;
  randomSeed?: number;
};

type MacroPer100 = { calories: number; protein: number; carbs: number; fat: number; source: string };

const DEF_STEP = 5;
const DAY_TOL = 0.06;

// --------- overrides de 100 g (corrigem lacunas do TACO) ---------
const OVERRIDES_100G: Record<string, MacroPer100> = {
  "whey protein": { calories: 370, protein: 83, carbs: 7, fat: 5, source: "override" },
  "azeite de oliva": { calories: 900, protein: 0, carbs: 0, fat: 100, source: "override" },
  "kafta bovina grelhada": { calories: 220, protein: 26, carbs: 2, fat: 12, source: "override" },
  "carne moída de patinho (cozida)": { calories: 170, protein: 26, carbs: 0, fat: 7, source: "override" },
  "hambúrguer de peru grelhado": { calories: 165, protein: 22, carbs: 1, fat: 8, source: "override" },
  "leite desnatado": { calories: 35, protein: 3.4, carbs: 5, fat: 0.2, source: "override" },
  // almôndegas
  "almôndegas bovinas grelhadas": { calories: 200, protein: 18, carbs: 4, fat: 12, source: "override" },
  "almôndegas bovinas cozidas": { calories: 195, protein: 18, carbs: 5, fat: 11, source: "override" }
};

// --------- porções mín./máx. por item (limites realistas) ---------
type PortionRule = { min: number; max: number; step?: number };
const PORTION_RULES: Record<string, PortionRule> = {
  // proteínas
  "frango grelhado": { min: 80, max: 220, step: 10 },
  "peito de frango grelhado": { min: 80, max: 220, step: 10 },
  "kafta bovina grelhada": { min: 120, max: 220, step: 10 },
  "carne moída de patinho (cozida)": { min: 120, max: 220, step: 10 },
  "carne moída cozida": { min: 120, max: 220, step: 10 },
  "hambúrguer de peru grelhado": { min: 120, max: 200, step: 10 },
  "almôndegas bovinas grelhadas": { min: 120, max: 220, step: 10 },
  "almôndegas bovinas cozidas": { min: 120, max: 220, step: 10 },
  "whey protein": { min: 20, max: 40, step: 5 },

  // carboidratos
  "arroz integral cozido": { min: 100, max: 220, step: 10 },
  "arroz branco cozido": { min: 100, max: 220, step: 10 },
  "quinoa cozida": { min: 100, max: 220, step: 10 },
  "batata-doce cozida": { min: 100, max: 250, step: 10 },
  "pão integral": { min: 25, max: 50, step: 25 },
  "aveia em flocos": { min: 20, max: 60, step: 5 },
  "grão-de-bico cozido": { min: 50, max: 150, step: 10 },

  // frutas (mínimo 1 unidade)
  "banana": { min: 80, max: 160, step: 20 },
  "maçã": { min: 130, max: 200, step: 10 },
  "laranja": { min: 140, max: 220, step: 10 },

  // gorduras
  "amêndoas": { min: 10, max: 20, step: 5 },
  "azeite de oliva": { min: 5, max: 10, step: 5 },

  // laticínios
  "iogurte grego natural": { min: 100, max: 200, step: 100 },
  "iogurte natural": { min: 170, max: 170, step: 170 },
  "leite desnatado": { min: 200, max: 300, step: 50 },

  // legumes/verduras
  "brócolis cozido": { min: 80, max: 200, step: 20 }
};
const DEFAULT_PORTION: PortionRule = { min: 30, max: 200, step: 5 };

function getRule(name: string): PortionRule {
  const key = Object.keys(PORTION_RULES).find((k) => norm(k) === norm(name));
  return key ? PORTION_RULES[key] : DEFAULT_PORTION;
}

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)); }
function roundStep(v: number, step: number) { return Math.round(v / step) * step; }
function within(target: number, value: number, tol: number) {
  if (target <= 0) return true;
  const lo = target * (1 - tol), hi = target * (1 + tol);
  return value >= lo && value <= hi;
}

async function getMacros100g(name: string): Promise<MacroPer100> {
  const n = norm(name);
  if (OVERRIDES_100G[n]) return OVERRIDES_100G[n];
  // heurísticas
  if (/whey/.test(n)) return OVERRIDES_100G["whey protein"];
  if (/azeite/.test(n)) return OVERRIDES_100G["azeite de oliva"];
  if (/kafta/.test(n)) return OVERRIDES_100G["kafta bovina grelhada"];
  if (/patinho/.test(n)) return OVERRIDES_100G["carne moída de patinho (cozida)"];
  if (/hamb.*peru/.test(n)) return OVERRIDES_100G["hambúrguer de peru grelhado"];
  if (/leite.*desnatado/.test(n)) return OVERRIDES_100G["leite desnatado"];
  if (/alm[oô]ndeg/.test(n)) {
    // se o nome indicar cozida vs grelhada, tentamos mapear
    if (/cozid/.test(n)) return OVERRIDES_100G["almôndegas bovinas cozidas"];
    return OVERRIDES_100G["almôndegas bovinas grelhadas"];
  }
  const taco = await findFoodByName(name);
  if (taco) return macrosPer100FromTaco(taco);
  return { calories: 0, protein: 0, carbs: 0, fat: 0, source: "notfound" };
}

// -------- unidades para exibição --------
type UnitMap = { unitLabel: string; gramsPerUnit: number; plural?: string };
const UNIT_DISPLAY: Record<string, UnitMap> = {
  "banana": { unitLabel: "unidade", gramsPerUnit: 80, plural: "unidades" },
  "maçã": { unitLabel: "unidade", gramsPerUnit: 130, plural: "unidades" },
  "laranja": { unitLabel: "unidade", gramsPerUnit: 140, plural: "unidades" },
  "ovo cozido": { unitLabel: "unidade", gramsPerUnit: 50, plural: "unidades" },
  "pão integral": { unitLabel: "fatia", gramsPerUnit: 25, plural: "fatias" },
  "iogurte grego natural": { unitLabel: "pote", gramsPerUnit: 100, plural: "potes" },
  "iogurte natural": { unitLabel: "pote", gramsPerUnit: 170, plural: "potes" }
};

export async function adjustDay(
  alimentos: AlimentoItem[],
  goals: DailyGoals
): Promise<{ calories: number; protein: number; carbs: number; fat: number }> {
  type ItemRT = { meal: MealKeyPt; name: string; grams: number; per100: MacroPer100; step: number; min: number; max: number };
  const rt: ItemRT[] = [];
  for (const a of alimentos) {
    const per100 = await getMacros100g(a.name);
    const rule = getRule(a.name);
    // força quantidade dentro dos limites antes do ajuste
    const initial = clamp(roundStep(a.quantity, rule.step ?? DEF_STEP), rule.min, rule.max);
    rt.push({ meal: a.meal, name: a.name, grams: initial, per100, step: rule.step ?? DEF_STEP, min: rule.min, max: rule.max });
  }

  const computeTotals = () => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const it of rt) {
      t.calories += (it.per100.calories * it.grams) / 100;
      t.protein  += (it.per100.protein  * it.grams) / 100;
      t.carbs    += (it.per100.carbs    * it.grams) / 100;
      t.fat      += (it.per100.fat      * it.grams) / 100;
    }
    return {
      calories: +t.calories.toFixed(1),
      protein:  +t.protein.toFixed(1),
      carbs:    +t.carbs.toFixed(1),
      fat:      +t.fat.toFixed(1)
    };
  };

  let T = computeTotals();

  const rank = (kind: "calories"|"protein"|"carbs"|"fat", desc=true) =>
    [...rt].sort((a,b)=>{
      const da = (a.per100 as any)[kind] / 100;
      const db = (b.per100 as any)[kind] / 100;
      return desc ? db - da : da - db;
    });

  for (let i=0; i<200; i++) {
    const eK = goals.calorias - T.calories;
    const eP = goals.proteina - T.protein;
    const eC = goals.carboidrato - T.carbs;
    const eF = goals.gordura - T.fat;

    const okK = within(goals.calorias,   T.calories, DAY_TOL);
    const okP = within(goals.proteina,   T.protein,  DAY_TOL);
    const okC = within(goals.carboidrato, T.carbs,    DAY_TOL);
    const okF = within(goals.gordura,    T.fat,      DAY_TOL);

    if (okK && okP && okC && okF) break;

    // reduzir excedentes
    if (!okF && eF < 0) {
      for (const it of rank("fat")) {
        if (it.grams <= it.min) continue;
        it.grams = clamp(roundStep(it.grams - it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
    if (!okP && eP < 0) {
      for (const it of rank("protein")) {
        if (it.grams <= it.min) continue;
        it.grams = clamp(roundStep(it.grams - it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
    if (!okC && eC < 0) {
      for (const it of rank("carbs")) {
        if (it.grams <= it.min) continue;
        it.grams = clamp(roundStep(it.grams - it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }

    // elevar déficits
    if (!okP && eP > 0) {
      for (const it of rank("protein")) {
        if (it.grams >= it.max) continue;
        it.grams = clamp(roundStep(it.grams + it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
    if (!okC && eC > 0) {
      for (const it of rank("carbs")) {
        if (it.grams >= it.max) continue;
        it.grams = clamp(roundStep(it.grams + it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
    if (!okF && eF > 0) {
      for (const it of rank("fat")) {
        if (it.grams >= it.max) continue;
        it.grams = clamp(roundStep(it.grams + it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }

    // calorias global
    if (!okK && eK > 0) {
      for (const it of rank("calories")) {
        if (it.grams >= it.max) continue;
        it.grams = clamp(roundStep(it.grams + it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
    if (!okK && eK < 0) {
      for (const it of rank("calories")) {
        if (it.grams <= it.min) continue;
        it.grams = clamp(roundStep(it.grams - it.step, it.step), it.min, it.max);
        T = computeTotals(); break;
      }
      continue;
    }
  }

  // aplica de volta
  for (const it of rt) {
    const g = Math.max(it.min, Math.min(it.max, Math.round(it.grams)));
    const m = {
      calories: +(it.per100.calories * g / 100).toFixed(1),
      protein:  +(it.per100.protein  * g / 100).toFixed(1),
      carbs:    +(it.per100.carbs    * g / 100).toFixed(1),
      fat:      +(it.per100.fat      * g / 100).toFixed(1),
      source: it.per100.source
    };
    const idx = alimentos.findIndex(a => norm(a.name) === norm(it.name) && a.meal === it.meal);
    if (idx >= 0) { alimentos[idx].quantity = g; alimentos[idx].macro = m; }
  }

  return alimentos.reduce(
    (acc, a) => ({
      calories: +(acc.calories + (a.macro.calories || 0)).toFixed(1),
      protein:  +(acc.protein  + (a.macro.protein  || 0)).toFixed(1),
      carbs:    +(acc.carbs    + (a.macro.carbs    || 0)).toFixed(1),
      fat:      +(acc.fat      + (a.macro.fat      || 0)).toFixed(1)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

// -------- formatação final em texto --------
function formatQty(name: string, grams: number) {
  const key = Object.keys(UNIT_DISPLAY).find((k) => norm(k) === norm(name));
  if (!key) return `${grams} g de ${name}`;
  const u = UNIT_DISPLAY[key];
  const count = Math.max(1, Math.round(grams / u.gramsPerUnit));
  const totalG = count * u.gramsPerUnit;
  const label = count > 1 && u.plural ? u.plural : u.unitLabel;
  return `${count} ${label} (${totalG} g) de ${name}`;
}

export function formatPlanTextBR(
  alimentos: AlimentoItem[],
  totals: { calories: number; protein: number; carbs: number; fat: number }
) {
  const labels: Record<MealKeyPt, string> = {
    cafe_da_manha: "Café da Manhã",
    lanche_manha: "Lanche da Manhã",
    almoco: "Almoço",
    lanche_tarde: "Lanche da Tarde",
    jantar: "Jantar"
  };
  const order: MealKeyPt[] = ["cafe_da_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar"];
  let out = "Plano de Dieta Atual\nCriar outro plano de dieta\n";
  for (const m of order) {
    const arr = alimentos.filter((a) => a.meal === m);
    if (!arr.length) continue;
    out += `\n${labels[m]}\n`;
    for (const a of arr) {
      const qtyTxt = formatQty(a.name, a.quantity);
      out += `${qtyTxt}: ${a.macro.calories} kcal, ${a.macro.protein}g proteína, ${a.macro.carbs}g carboidrato, ${a.macro.fat}g gordura\n`;
    }
  }
  out += `\nTotais do Dia\n- Calorias: ${totals.calories} kcal\n- Proteína: ${totals.protein}g\n- Carboidratos: ${totals.carbs}g\n- Gordura: ${totals.fat}g\n`;
  return out;
}




