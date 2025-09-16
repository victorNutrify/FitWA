// src/app/api/generate-diet-plan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, doc, setDoc, collection } from "@/lib/firestore.admin.compat";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ================================
   Schemas
================================ */
const AlimentoSchema = z.object({
  nome: z.string().min(1),
  quantidade: z.string().min(1),
  proteinas: z.number().nonnegative(),
  carboidratos: z.number().nonnegative(),
  gorduras: z.number().nonnegative(),
  calorias: z.number().nonnegative(),
});
const RefeicaoSchema = z.object({
  refeicao: z.string().min(1),
  alimentos: z.array(AlimentoSchema).min(1),
});
const PlanoSchema = z.array(RefeicaoSchema).min(1);
type Refeicao = z.infer<typeof RefeicaoSchema>;

/* ================================
   Preferências (tipos)
================================ */
type DietType = "omnivore" | "vegetarian" | "vegan" | "pescatarian" | "halal" | "kosher";
type Prefs = {
  dietType?: DietType;
  avoidCategories: {
    dairy?: boolean; eggs?: boolean; pork?: boolean; seafood?: boolean; shellfish?: boolean;
    meat?: boolean; poultry?: boolean; alcohol?: boolean; gluten?: boolean; nuts?: boolean;
  };
  avoidIngredients: string[];
  dislikeIngredients: string[];
  preferredCuisines?: string[];
};

/* ================================
   Utils
================================ */
function toNumber(val: any): number {
  const n = typeof val === "string" ? parseFloat(val.replace(",", ".")) : Number(val);
  return Number.isFinite(n) ? n : 0;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

function normalizeStr(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
function extractFoodsBlock(raw: string): string {
  if (!raw) return "[]";
  const m = raw.match(/<FOODS_JSON>([\s\S]*?)<\/FOODS_JSON>/i);
  const inside = (m ? m[1] : raw).trim();
  return inside.replace(/^```json\s*|\s*```$/g, "").trim();
}
function normalizeFoodsJson(data: any) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    return Object.entries(data).map(([refeicao, alimentos]) => ({
      refeicao,
      alimentos: Array.isArray(alimentos) ? alimentos : [],
    }));
  }
  return [];
}

/* ================================
   Base local: alimentos_br.json
================================ */
type FoodDB = {
  name: string; // por 100 g
  calories: number; protein: number; carbs: number; fat: number;
  category?: string; source?: string;
};
let FOODS_CACHE: FoodDB[] | null = null;
function loadFoodsDB(): FoodDB[] {
  if (FOODS_CACHE) return FOODS_CACHE;
  try {
    const p = path.join(process.cwd(), "alimentos_br.json");
    const raw = fs.readFileSync(p, "utf8");
    const arr = JSON.parse(raw);
    const list = Array.isArray(arr) ? arr : Array.isArray(arr?.data) ? arr.data : [];
    FOODS_CACHE = list.map((f: any) => ({
      name: String(f.name ?? f.nome ?? "").trim(),
      calories: toNumber(f.calories ?? f.kcal ?? f.cal ?? 0),
      protein: toNumber(f.protein ?? f.proteina ?? 0),
      carbs: toNumber(f.carbs ?? f.carboidratos ?? 0),
      fat: toNumber(f.fat ?? f.gorduras ?? 0),
      category: f.category ?? f.categoria ?? undefined,
      source: f.source ?? "db",
    }));
  } catch {
    FOODS_CACHE = [];
  }
  return FOODS_CACHE!;
}

/* ================================
   Fallback per-100g (evita 0g)
================================ */
const HARD_PER100: Record<string, FoodDB> = {
  "pão integral": { name: "pão integral", calories: 247, protein: 13, carbs: 41, fat: 4, source: "hard" },
  "pão sem glúten": { name: "pão sem glúten", calories: 250, protein: 6, carbs: 50, fat: 3, source: "hard" },

  "pasta de amendoim": { name: "pasta de amendoim", calories: 588, protein: 25, carbs: 20, fat: 50, source: "hard" },
  "amêndoas": { name: "amêndoas", calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, source: "hard" },
  "castanha de caju": { name: "castanha de caju", calories: 553, protein: 18.2, carbs: 30.2, fat: 43.9, source: "hard" },

  "homus": { name: "homus", calories: 166, protein: 8, carbs: 14.3, fat: 9.6, source: "hard" },
  "hummus": { name: "hummus", calories: 166, protein: 8, carbs: 14.3, fat: 9.6, source: "hard" },

  "azeite de oliva": { name: "azeite de oliva", calories: 884, protein: 0, carbs: 0, fat: 100, source: "hard" },
  "azeite de oliva extra virgem": { name: "azeite de oliva extra virgem", calories: 884, protein: 0, carbs: 0, fat: 100, source: "hard" },

  "alface": { name: "alface", calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, source: "hard" },
  "alface crespa": { name: "alface crespa", calories: 15, protein: 1.4, carbs: 2.9, fat: 0.2, source: "hard" },

  "cenoura": { name: "cenoura", calories: 41, protein: 0.9, carbs: 10, fat: 0.2, source: "hard" },
  "brócolis cozido": { name: "brócolis cozido", calories: 35, protein: 2.4, carbs: 7.2, fat: 0.4, source: "hard" },

  "quinoa cozida": { name: "quinoa cozida", calories: 120, protein: 4.4, carbs: 21.3, fat: 1.9, source: "hard" },
  "grão de bico cozido": { name: "grão de bico cozido", calories: 164, protein: 9, carbs: 27.4, fat: 2.6, source: "hard" },

  "banana": { name: "banana", calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, source: "hard" },
  "abacate": { name: "abacate", calories: 160, protein: 2, carbs: 9, fat: 15, source: "hard" },

  "ovo de galinha": { name: "ovo de galinha", calories: 155, protein: 13, carbs: 1.1, fat: 11, source: "hard" },
  "clara de ovo pasteurizada": { name: "clara de ovo pasteurizada", calories: 44, protein: 11, carbs: 0, fat: 0, source: "hard" },

  "proteína isolada de soja (sem lactose e sem glúten)": {
    name: "proteína isolada de soja (sem lactose e sem glúten)",
    calories: 403, protein: 90, carbs: 3.3, fat: 3.3, source: "hard"
  },
  "proteína isolada de ervilha (sem lactose e sem glúten)": {
    name: "proteína isolada de ervilha (sem lactose e sem glúten)",
    calories: 395, protein: 80, carbs: 10, fat: 5, source: "hard"
  },
  "maltodextrina": { name: "maltodextrina", calories: 386, protein: 0, carbs: 96.5, fat: 0, source: "hard" },
  "biscoito integral": { name: "biscoito integral", calories: 430, protein: 8, carbs: 70, fat: 12, source: "hard" },
  "pão de forma":            { name: "pão de forma",            calories: 265, protein: 9,   carbs: 49,  fat: 3,   source: "hard" },
  "arroz integral cozido":   { name: "arroz integral cozido",   calories: 124, protein: 2.6, carbs: 25.8, fat: 1,   source: "hard" },
  "batata doce cozida":      { name: "batata doce cozida",      calories: 86,  protein: 1.6, carbs: 20.1, fat: 0.1, source: "hard" },
  "espinafre cozido":        { name: "espinafre cozido",        calories: 23,  protein: 2.9, carbs: 3.6,  fat: 0.4, source: "hard" },
  "proteína vegetal em pó":  { name: "proteína vegetal em pó",  calories: 395, protein: 80,  carbs: 10,  fat: 5,   source: "hard" },

};

// Normalizações de nomes (marca → genérico)
const FOOD_ALIASES: Record<string, string> = {
  "pão integral girassol e castanha wickbold pacote 400g": "pão integral",
  "pão integral girassol wickbold": "pão integral",
  "macarrão de sêmola grano duro espaguete 8 adria pacote 500g": "macarrão de sêmola",
  "iogurte integral com preparado de abacaxi": "iogurte integral",
  "palitos de zanahoria": "cenoura",
  "shake de proteína vegetal": "proteína vegetal em pó",
  "ovo de galinha": "ovo",
};

/* ================================
   Matching com sinônimos e Jaccard
================================ */
const ALIAS: { rx: RegExp; canon: string }[] = [
  // Marcas/variações → genérico
  { rx: /wickbold/i, canon: "pão integral" },
  { rx: /girassol.*castanha.*p[aã]o/i, canon: "pão integral" },

  // Itens básicos e vegetais
  { rx: /tofu/i, canon: "tofu" },
  { rx: /quinoa/i, canon: "quinoa cozida" },
  { rx: /gr[aã]o de bico/i, canon: "grão de bico cozido" },
  { rx: /br[oó]colis/i, canon: "brócolis cozido" },
  { rx: /espinafre/i, canon: "espinafre cozido" },
  { rx: /salada.*folhas|folhas verdes|mix de folhas/i, canon: "alface" },
  { rx: /alface(?:\s+crespa)?/i, canon: "alface crespa" },
  { rx: /banana/i, canon: "banana" },
  { rx: /abacate/i, canon: "abacate" },
  { rx: /cenoura|zanahoria/i, canon: "cenoura" },

  // Pães / glúten
  { rx: /p[aã]o integral/i, canon: "pão integral" },
  { rx: /p[aã]o.*gl[uú]ten|sem gl[uú]ten/i, canon: "pão sem glúten" },
  { rx: /torrada.*integral/i, canon: "pão integral" },

  // Pastas / laticínios vegetais
  { rx: /pasta de amendoim|manteiga de amendoim/i, canon: "pasta de amendoim" },
  { rx: /iogurte.*soja/i, canon: "iogurte de soja" },
  { rx: /leite.*soja/i, canon: "leite de soja" },
  { rx: /hummus|homus/i, canon: "homus" },

  // Gorduras
  { rx: /azeite de oliva( extra virgem)?/i, canon: "azeite de oliva extra virgem" },

  // Carboidratos cozidos
  { rx: /arroz integral/i, canon: "arroz integral cozido" },
  { rx: /batata.*doce/i, canon: "batata doce cozida" },

  // Preparações
  { rx: /hamb[uú]rguer.*lentilha/i, canon: "hambúrguer de lentilha" },

  // Ovos / whey
  { rx: /ovo/i, canon: "ovo de galinha" },
  { rx: /shake.*prote[ií]na.*vegetal/i, canon: "proteína isolada de soja (sem lactose e sem glúten)" },
  { rx: /whey|case[ií]na|soro de leite/i, canon: "proteína isolada de soja (sem lactose e sem glúten)" },
  
  { rx: /gr[aã]o de bico\b(?!\s*cozido)/i, canon: "grão de bico cozido" },
  { rx: /smoothie.*prote[ií]na.*vegetal/i, canon: "proteína isolada de soja (sem lactose e sem glúten)" },
  { rx: /shake.*prote[ií]na.*vegetal/i, canon: "proteína isolada de soja (sem lactose e sem glúten)" },
  { rx: /biscoito.*nesfit.*laranja.*cenoura/i, canon: "biscoito integral" },
  { rx: /biscoito.*nesfit/i, canon: "biscoito integral" },
];

const canon = canonicalizeName(nome);
const alias = FOOD_ALIASES[canon] ?? canon;

const per100 =
  findBestFood(alias) ||
  HARD_PER100[alias.toLowerCase()] ||
  (await fetchOpenFood(req, alias)) ||
  null;

function tokens(s: string) {
  return normalizeStr(s).split(/[^a-z0-9]+/).filter(Boolean);
}
function jaccard(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  const inter = [...A].filter(x => B.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}
function findBestFood(query: string): FoodDB | null {
  const db = loadFoodsDB();
  const q0 = canonicalizeName(query);
  const qn = normalizeStr(q0);

  // 1) base local
  let best = db.find(f => normalizeStr(f.name) === qn);
  if (best) return best;
  const starts = db.filter(f => normalizeStr(f.name).startsWith(qn));
  if (starts[0]) return starts[0];
  const contains = db.filter(f => normalizeStr(f.name).includes(qn));
  if (contains[0]) return contains[0];

  // 2) hard fallback
  const hard = HARD_PER100[q0.toLowerCase()];
  if (hard) return hard;

  // 3) jaccard na base
  const qt = tokens(q0);
  let maxScore = 0;
  for (const f of db) {
    const sc = jaccard(qt, tokens(f.name));
    if (sc > maxScore) { maxScore = sc; best = f; }
  }
  if (maxScore >= 0.34 && best) return best;

  // 4) jaccard no hard
  let bestHard: FoodDB | null = null; maxScore = 0;
  for (const k of Object.keys(HARD_PER100)) {
    const sc = jaccard(qt, tokens(k));
    if (sc > maxScore) { maxScore = sc; bestHard = HARD_PER100[k]; }
  }
  return (maxScore >= 0.5 && bestHard) ? bestHard : null;
}

function stripBrand(q: string) {
  // normaliza e remove marcas/ruídos
  let s = normalizeStr(q)
    .replace(/\b(wickbold|nesfit|adria|piraque|bauducco|pacote|sache|sach[eê]|lata|garrafa|caixa)\b/g, " ")
    .replace(/\b(girassol|castanha|laranja|cenoura)\b/g, " ")
    .replace(/\b\d+\s*g\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // reconstrói com inicial maiúscula simples
  return s.split(" ").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

/* ================================
   Porções (com frações)
================================ */
const UNIT_DEFAULTS = {
  scoop_g: 30,
  fatia_g: 25,
  colher_sopa_g: 16,
  xicara_ml: 240,
  pote_g: 170,
  unidade_g: 100,
};

const NAME_PORTIONS: {
  rx: RegExp; gramsPerUnit?: number;
  unit?: "fatia"|"colher"|"unidade"|"xicara"
}[] = [
  { rx: /quinoa/i, gramsPerUnit: 185, unit: "xicara" },
  { rx: /gr[aã]o de bico/i, gramsPerUnit: 164, unit: "xicara" },
  { rx: /br[oó]colis/i, gramsPerUnit: 90, unit: "xicara" },
  { rx: /cenoura/i, gramsPerUnit: 128, unit: "xicara" },

  { rx: /hamb[uú]rguer.*lentilha/i, gramsPerUnit: 100, unit: "unidade" },
  { rx: /salada.*folhas|alface/i, gramsPerUnit: 50, unit: "xicara" },

  { rx: /p[aã]o.*gl[uú]ten|p[aã]o integral/i, gramsPerUnit: 25, unit: "fatia" },
  { rx: /pasta de amendoim/i, gramsPerUnit: 16, unit: "colher" },

  { rx: /iogurte.*soja/i, gramsPerUnit: 170, unit: "unidade" },
  { rx: /ovo/i, gramsPerUnit: 50, unit: "unidade" },
  { rx: /banana/i, gramsPerUnit: 120, unit: "unidade" },
  { rx: /abacate/i, gramsPerUnit: 200, unit: "unidade" },
  { rx: /p[aã]o de forma/i, gramsPerUnit: 25, unit: "fatia" },
  { rx: /biscoito.*integral/i, gramsPerUnit: 30, unit: "porcao" }, // ~ 5-6 unidades
  { rx: /arroz integral cozido/i, gramsPerUnit: 160, unit: "xicara" },
  { rx: /batata doce cozida/i, gramsPerUnit: 150, unit: "porcao" },
];

// Itens compostos (pão+abacate, mix de castanhas)
const COMPOSED: {
  rx: RegExp;
  components: Array<
    { name: string; gramsPerUnit: number; perUnitRef: "fatia" | "colher" | "unidade" | "xicara" | "prato" | "porcao" }
  >;
}[] = [
  {
    rx: /torrada.*(integral)?.*abacate/i,
    components: [
      { name: "pão integral", gramsPerUnit: 25, perUnitRef: "fatia" },
      { name: "abacate", gramsPerUnit: 20, perUnitRef: "fatia" },
    ],
  },
  {
    rx: /mix.*castanhas|mix de castanhas/i,
    components: [
      { name: "amêndoas", gramsPerUnit: 0, perUnitRef: "unidade" },
      { name: "castanha de caju", gramsPerUnit: 0, perUnitRef: "unidade" },
    ],
  },
];

const MIN_G = 12;   // ~ 1 colher de sopa
const MAX_G = 250;  // limite por item
function clampGrams(g: number) {
  return Math.max(MIN_G, Math.min(MAX_G, Math.round(g)));
}

function quantityToGrams(nome: string, quantidade: string): { grams: number; reason: string } {
  const qn = normalizeStr(quantidade);
  const name = canonicalizeName(nome);

  function parseNumberLike(s: string): number | null {
    s = s.trim();
    if (/^\d+(?:[.,]\d+)?$/.test(s)) return toNumber(s);
    if (/^\d+\s*\/\s*\d+$/.test(s)) {
      const [a, b] = s.split("/").map(toNumber);
      return b ? a / b : null;
    }
    if (/[½⅓¼¾]/.test(s)) {
      const map: Record<string, number> = { "½": 0.5, "⅓": 1 / 3, "¼": 0.25, "¾": 0.75 };
      return map[s] ?? null;
    }
    return null;
  }
  const numMatch = qn.match(/([0-9]+(?:[.,][0-9]+)?|[0-9]+\s*\/\s*[0-9]+|[½⅓¼¾])/);
  const n = numMatch ? parseNumberLike(numMatch[1]) ?? 1 : 1;

  // g / ml explícitos
  const gMatch = qn.match(/(-?\d+(?:[.,]\d+)?)\s*g\b/);
  if (gMatch) return { grams: clampGrams(toNumber(gMatch[1])), reason: "g-explicit" };
  const mlMatch = qn.match(/(-?\d+(?:[.,]\d+)?)\s*ml\b/);
  if (mlMatch) return { grams: clampGrams(toNumber(mlMatch[1])), reason: "ml≈g" };

  // scoops
  if (/\bscoops?\b/.test(qn)) return { grams: clampGrams((n ?? 1) * UNIT_DEFAULTS.scoop_g), reason: "scoop" };

  // colher de sopa
  if (/colher(?:es)?\s*de\s*sopa/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "colher")?.gramsPerUnit ?? UNIT_DEFAULTS.colher_sopa_g;
    return { grams: clampGrams((n ?? 1) * byName), reason: "colher-sopa" };
  }

  // fatia
  if (/fatia(?:s)?/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "fatia")?.gramsPerUnit ?? UNIT_DEFAULTS.fatia_g;
    return { grams: clampGrams((n ?? 1) * byName), reason: "fatia" };
  }

  // xícara
  if (/x[ií]cara(?:s)?/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "xicara")?.gramsPerUnit;
    if (byName) return { grams: clampGrams((n ?? 1) * byName), reason: "xic-por-nome" };
    return { grams: clampGrams((n ?? 1) * UNIT_DEFAULTS.xicara_ml), reason: "xic-ml" };
  }

  // pote
  if (/pote(?:s)?/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "unidade")?.gramsPerUnit ?? UNIT_DEFAULTS.pote_g;
    return { grams: clampGrams((n ?? 1) * byName), reason: "pote" };
  }

    // copo (~240 ml)
  if (/copo(?:s)?/.test(qn)) {
    return { grams: clampGrams((n ?? 1) * 240), reason: "copo-ml" };
  }

  // unidade
  if (/unidade(?:s)?|\bun\b/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "unidade")?.gramsPerUnit ?? UNIT_DEFAULTS.unidade_g;
    return { grams: clampGrams((n ?? 1) * byName), reason: "unidade" };
  }

  // porção
  if (/por[cç][aã]o(?:es)?/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.gramsPerUnit)?.gramsPerUnit ?? 150;
    return { grams: clampGrams((n ?? 1) * byName), reason: "porcao" };
  }

  // prato
  if (/prato/.test(qn)) {
    const byName = NAME_PORTIONS.find(r => r.rx.test(name) && r.unit === "xicara")?.gramsPerUnit ?? 200;
    return { grams: clampGrams((n ?? 1) * byName), reason: "prato" };
  }

  // concha
  if (/concha/.test(qn)) {
    return { grams: clampGrams((n ?? 1) * 100), reason: "concha" };
  }

  // fallback por nome
  const byName = NAME_PORTIONS.find(r => r.rx.test(name))?.gramsPerUnit;
  if (byName) return { grams: clampGrams(byName), reason: "nome-fallback" };

  // 100 g padrão
  return { grams: clampGrams(100), reason: "default-100g" };
}

/* ================================
   openfood fallback
================================ */
async function fetchOpenFood(req: NextRequest, query: string) {
  try {
    const host = req.headers.get("host") || "localhost:9002";
    const protocol = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
    const url = `${protocol}://${host}/api/openfood?q=${encodeURIComponent(query)}`;
    const r = await fetch(url, { method: "GET" });
    const j = await r.json().catch(() => null);
    if (j?.ok && j?.data) {
      const d = j.data;
      return {
        name: d.name || query,
        calories: toNumber(d.calories || 0),
        protein: toNumber(d.protein || 0),
        carbs: toNumber(d.carbs || 0),
        fat: toNumber(d.fat || 0),
        source: "openfood",
      } as FoodDB;
    }
  } catch {}
  return null;
}

/* ================================
   Recalcular macros a partir da base
================================ */
async function recalcItemFromDB(
  req: NextRequest,
  nome: string,
  quantidade: string
): Promise<z.infer<typeof AlimentoSchema>> {
  const originalName = nome;
  const canonical = canonicalizeName(nome);
  const { grams } = quantityToGrams(canonical, quantidade);

  // 0) forçar 30g se for "proteína isolada *" sem unidade
  if (
    /prote[ií]na isolada/.test(normalizeStr(canonical)) &&
    !/g\b|ml\b|scoop|colher|fatia|unidade|x[ií]cara/.test(normalizeStr(quantidade))
  ) {
    const per100Forced =
      findBestFood(canonical) ||
      HARD_PER100[canonical.toLowerCase()] ||
      (await fetchOpenFood(req, canonical));
    const factorF = 30 / 100;
    if (per100Forced) {
      return {
        nome: per100Forced.name,
        quantidade: "30g",
        proteinas: round1((per100Forced.protein || 0) * factorF),
        carboidratos: round1((per100Forced.carbs || 0) * factorF),
        gorduras: round1((per100Forced.fat || 0) * factorF),
        calorias: Math.max(0, Math.round((per100Forced.calories || 0) * factorF)),
      };
    }
  }

  // 1) Itens compostos
  const comp = COMPOSED.find((c) => c.rx.test(canonical));
  if (comp) {
    const explicitG = /(-?\d+(?:[.,]\d+)?)\s*g\b/.test(normalizeStr(quantidade));
    let totals = { p: 0, c: 0, f: 0, kcal: 0 };

    if (explicitG) {
      const each = Math.max(1, Math.floor(grams / comp.components.length));
      for (const part of comp.components) {
        const per100 =
          findBestFood(part.name) ||
          HARD_PER100[part.name.toLowerCase()] ||
          (await fetchOpenFood(req, part.name));

        if (per100) {
          const factor = each / 100;
          totals.p += (per100.protein || 0) * factor;
          totals.c += (per100.carbs || 0) * factor;
          totals.f += (per100.fat || 0) * factor;
          totals.kcal += (per100.calories || 0) * factor;
        }
      }
    } else {
      function unitsFor(ref: string) {
        const qn = normalizeStr(quantidade);
        const m = qn.match(/(\d+(?:[.,]\d+)?|[½⅓¼¾]|\d+\s*\/\s*\d+)/);
        const n = m ? parseFloat(m[1].replace(",", ".")) || 1 : 1;
        if (ref === "fatia" && /fatia/.test(qn)) return n;
        if (ref === "colher" && /colher(?:es)?\s*de\s*sopa/.test(qn)) return n;
        if (ref === "unidade" && /(unidade|un)\b/.test(qn)) return n;
        if (ref === "xicara" && /x[ií]cara/.test(qn)) return n;
        if (ref === "prato" && /prato/.test(qn)) return n;
        if (ref === "porcao" && /por[cç][aã]o/.test(qn)) return n;
        return 1;
      }

      for (const part of comp.components) {
        const units = unitsFor(part.perUnitRef);
        const gPart = Math.max(
          MIN_G,
          Math.min(MAX_G, Math.round(units * (part.gramsPerUnit || 1)))
        );
        if (gPart > 0) {
          let per100 =
            findBestFood(part.name) ||
            HARD_PER100[part.name.toLowerCase()] ||
            (await fetchOpenFood(req, part.name)) ||
            null;

          // fallback extra: remove marcas/ruídos do nome e tenta de novo
          if (!per100) {
            const stripped = stripBrand(part.name);
            if (stripped && stripped !== part.name) {
              per100 =
                findBestFood(stripped) ||
                HARD_PER100[stripped.toLowerCase()] ||
                (await fetchOpenFood(req, stripped)) ||
                null;
            }
          }

          if (per100) {
            const factor = gPart / 100;
            totals.p += (per100.protein || 0) * factor;
            totals.c += (per100.carbs || 0) * factor;
            totals.f += (per100.fat || 0) * factor;
            totals.kcal += (per100.calories || 0) * factor;
          }
        }
      }
    }

    return {
      nome: originalName,
      quantidade,
      proteinas: round1(totals.p),
      carboidratos: round1(totals.c),
      gorduras: round1(totals.f),
      calorias: Math.max(0, Math.round(totals.kcal)),
    };
  }

  // 2) Item simples → base local → hard → openfood
  const per100 =
    findBestFood(canonical) ||
    HARD_PER100[canonical.toLowerCase()] ||
    (await fetchOpenFood(req, canonical)) ||
    null;

  if (per100) {
    const factor = grams / 100;
    return {
      nome: per100.name,
      quantidade,
      proteinas: round1((per100.protein || 0) * factor),
      carboidratos: round1((per100.carbs || 0) * factor),
      gorduras: round1((per100.fat || 0) * factor),
      calorias: Math.max(0, Math.round((per100.calories || 0) * factor)),
    };
  }

  // 3) Sem match algum → zera
  return {
    nome: originalName,
    quantidade,
    proteinas: 0,
    carboidratos: 0,
    gorduras: 0,
    calorias: 0,
  };
}

function canonicalizeName(s: string) {
  return normalizeStr(s).replace(/\s+/g, " ").trim();
}

// Usa a sua tabela de regex ALIAS (já existente no arquivo)
function applyRegexAlias(raw: string): string | null {
  const hit = ALIAS.find(a => a.rx.test(raw));
  return hit ? hit.canon : null;
}

// Garante que o nome final é genérico: remove marca → aplica alias de regex → aplica FOOD_ALIASES → fallback
function resolveToGenericName(rawName: string): string {
  const stripped = stripBrand(rawName);                 // remove "Wickbold", "Adria", "Nesfit", tamanhos, etc.
  const fromRegex = applyRegexAlias(stripped);          // ex.: "torrada integral com abacate" → "pão integral" + "abacate" (quando composto)
  if (fromRegex) return fromRegex;
  const canon = canonicalizeName(stripped);
  const aliased = FOOD_ALIASES[canon] ?? cannonToPlain(canon);
  return aliased;
}

// Faz pequenos ajustes “plain” (ex.: plural/sinônimos simples) sem amarrar em marca
function cannonToPlain(c: string): string {
  // exemplos práticos de normalização leve
  if (/p[aã]o de forma/.test(c)) return "pão de forma";
  if (/p[aã]o integral/.test(c)) return "pão integral";
  if (/p[aã]o.*sem gl[uú]ten/.test(c)) return "pão sem glúten";
  if (/biscoito.*integral/.test(c)) return "biscoito integral";
  if (/iogurte.*soja/.test(c)) return "iogurte de soja";
  if (/clara.*ovo/.test(c)) return "clara de ovo pasteurizada";
  return c;
}

function sanitizePlanNames(rawParsed: any): { refeicao: string; alimentos: { nome: string; quantidade: string }[] }[] {
  const arr = normalizeFoodsJson(rawParsed);
  const out: { refeicao: string; alimentos: { nome: string; quantidade: string }[] }[] = [];

  for (const ref of arr) {
    const refeicao = String(ref?.refeicao ?? "").trim();
    const alimentosIn = Array.isArray(ref?.alimentos) ? ref.alimentos : [];
    const alimentosOut: any[] = [];

    for (const a of alimentosIn) {
      const rawNome = String(a?.nome ?? "").trim();
      const quantidade = String(a?.quantidade ?? "").trim();
      if (!rawNome || !quantidade) continue;

      // 🔴 força genérico aqui
      const nomeGenerico = resolveToGenericName(rawNome);
      alimentosOut.push({ nome: nomeGenerico, quantidade });
    }

    if (refeicao && alimentosOut.length > 0) {
      out.push({ refeicao, alimentos: alimentosOut });
    }
  }
  return out;
}

async function rebuildPlanWithDB(
  req: NextRequest,
  planNamesOnly: { refeicao: string; alimentos: { nome: string; quantidade: string }[] }[]
): Promise<Refeicao[]> {
  const out: Refeicao[] = [];
  for (const ref of planNamesOnly) {
    const recalcAlims = [];
    for (const a of ref.alimentos) recalcAlims.push(await recalcItemFromDB(req, a.nome, a.quantidade));
    out.push({ refeicao: ref.refeicao, alimentos: recalcAlims });
  }
  return out;
}

/* ================================
   Soma + render
================================ */
function sumMacros(plan: Refeicao[]) {
  let protein = 0, carbs = 0, fat = 0, calories = 0;
  for (const refeicao of plan) {
    for (const a of refeicao.alimentos) {
      protein += a.proteinas; carbs += a.carboidratos; fat += a.gorduras; calories += a.calorias;
    }
  }
  return { protein: round1(protein), carbs: round1(carbs), fat: round1(fat), calories };
}
function renderGroupedPlan(plan: Refeicao[], totals: any) {
  let out = "Plano de Dieta Diário\n";
  for (const refeicao of plan) {
    out += `\n${refeicao.refeicao}\n`;
    for (const a of refeicao.alimentos) {
      out += `${a.quantidade} de ${a.nome}: ${a.proteinas}g proteína, ${a.carboidratos}g carboidrato, ${a.gorduras}g gordura, ${a.calorias}kcal\n`;
    }
  }
  out += `\nTotais do Dia\n- Proteína: ${totals.protein}g\n- Carboidratos: ${totals.carbs}g\n- Gordura: ${totals.fat}g\n- Calorias: ${totals.calories}kcal\n`;
  return out;
}

/* ================================
   Classificação p/ preferências
================================ */
const RX = {
  meat: [/(carne|bovina|boi|vaca|patinho|alcatra|cox[aã]o|ac[eê]m)/i],
  poultry: [/(frango|peito de frango|sobrecoxa|peru|chester|ave|cox[aã])/i],
  pork: [/(porco|su[ií]na|bacon|lombo|lingui[cç]a|presunto)/i],
  seafood: [/(peixe|salm[aã]o|atum|til[aá]pia|bacalhau)/i],
  shellfish: [/(camar[aã]o|lula|polvo|ostra|marisco|caranguejo)/i],
  dairy: [/(leite|iogurte|queijo|manteiga|requeij|cottage|coalhada|ricota|case[ií]na|soro de leite|whey)/i],
  eggs: [/(ovo|ovos|clara de ovo|clara)/i],
  alcohol: [/(vinho|cerveja|cacha[cç]a|vodka|u[ií]sque|rum|licor)/i],
  gluten: [/(trigo|p[aã]o|macarr[aã]o|farinha de trigo|cuscuz|c[êe]vada|centeio)/i],
  nuts: [/(am[eê]ndoas|amendoim|castanha|avel[aã]|pec[aã]|pistache|noz)/i],
};
function matchesAny(name: string, arr: RegExp[]) { return arr.some((r) => r.test(name)); }
function classify(name: string) {
  const hit = (key: keyof typeof RX) => matchesAny(name, RX[key]);
  return {
    meat: hit("meat"), poultry: hit("poultry"), pork: hit("pork"), seafood: hit("seafood"),
    shellfish: hit("shellfish"), dairy: hit("dairy"), eggs: hit("eggs"), alcohol: hit("alcohol"),
    gluten: hit("gluten"), nuts: hit("nuts"),
  };
}

/* ================================
   Preferências (Firestore + mensagens)
================================ */
async function getUserPrefs(email: string): Promise<Partial<Prefs>> {
  try {
    const col: any = collection(db, "chatfit", email, "preferencias");
    const snap = await col.orderBy("updatedAt", "desc").limit(1).get();
    if (!snap.empty) return normalizePrefsDoc(snap.docs[0].data());
    const refDoc: any = doc(db, "chatfit", email, "preferencias", "perfil");
    const d = await refDoc.get();
    if (d.exists) return normalizePrefsDoc(d.data());
  } catch {}
  return {};
}
function normalizePrefsDoc(data: any): Partial<Prefs> {
  if (!data || typeof data !== "object") return {};
  const p: Partial<Prefs> = {
    dietType: normalizeDietType(data.dietType || data.dieta || data.estilo),
    avoidCategories: {
      dairy: !!(data.semLactose || data.semLaticinios || data.dairyFree),
      eggs: !!data.semOvos,
      pork: !!(data.semPorco || data.noPork),
      seafood: !!data.semPeixe,
      shellfish: !!(data.semFrutosDoMar || data.semMariscos),
      meat: !!data.semCarne,
      poultry: !!data.semFrango,
      alcohol: !!data.semAlcool,
      gluten: !!(data.semGluten || data.glutenFree || data.celiaco || data.celiaca),
      nuts: !!(data.semOleaginosas || data.semNozes || data.semAmendoim),
    },
    avoidIngredients: Array.isArray(data.evitar) ? data.evitar : [],
    dislikeIngredients: Array.isArray(data.naoGosto) ? data.naoGosto : [],
    preferredCuisines: Array.isArray(data.cozinhas) ? data.cozinhas : [],
  };
  return p;
}
function normalizeDietType(v: any): DietType | undefined {
  const s = normalizeStr(String(v || ""));
  if (!s) return undefined;
  if (/vegano|vegan/.test(s)) return "vegan";
  if (/vegetar/.test(s)) return "vegetarian";
  if (/pescet|pescatar/.test(s)) return "pescatarian";
  if (/halal/.test(s)) return "halal";
  if (/kosher|kash/.test(s)) return "kosher";
  return "omnivore";
}
function prefsFromMessages(messages: any[]): Partial<Prefs> {
  const txt = normalizeStr(
    messages.map((m) => (typeof m?.content === "string" ? m.content : (m?.content?.text ?? ""))).join("\n")
  );
  const out: Partial<Prefs> = { avoidCategories: {}, avoidIngredients: [], dislikeIngredients: [] };

  if (/vegano|vegan/.test(txt)) out.dietType = "vegan";
  else if (/vegetar/.test(txt)) out.dietType = "vegetarian";
  else if (/pescet|pescatar/.test(txt)) out.dietType = "pescatarian";
  else if (/halal/.test(txt)) out.dietType = "halal";
  else if (/kosher|kash/.test(txt)) out.dietType = "kosher";

  if (/(intolerante a lactose|intoler[âa]ncia? a? lactose|sem lactose|sem latic[ií]nios)/.test(txt)) {
    out.avoidCategories!.dairy = true;
  }
  if (/(intolerante a gl[uú]ten|intoler[âa]ncia? a? gl[uú]ten|cel[ií]ac[oa]|sem gl[uú]ten)/.test(txt)) {
    out.avoidCategories!.gluten = true;
  }
  if (/sem ovos?/.test(txt)) out.avoidCategories!.eggs = true;
  if (/sem porco|no pork|sem carne de porco/.test(txt)) out.avoidCategories!.pork = true;
  if (/al[eé]rgico a? nuts|al[eé]rgico a? nozes|al[eé]rgico a? amendoim|sem oleaginosas/.test(txt))
    out.avoidCategories!.nuts = true;

  const dislikeMatch = txt.match(/n[aã]o gosto de ([^.\n;]+)/g);
  if (dislikeMatch) for (const m of dislikeMatch) out.dislikeIngredients!.push(m.replace(/n[aã]o gosto de /, "").trim());
  const alergMatch = txt.match(/al[eé]rgic[oa] a ([^.\n;]+)/g);
  if (alergMatch) for (const m of alergMatch) out.avoidIngredients!.push(m.replace(/al[eé]rgic[oa] a /, "").trim());
  const evitarMatch = txt.match(/evitar ([^.\n;]+)/g);
  if (evitarMatch) for (const m of evitarMatch) out.avoidIngredients!.push(m.replace(/evitar /, "").trim());

  return out;
}
function mergePrefs(a: Partial<Prefs>, b: Partial<Prefs>): Prefs {
  const dietType = b.dietType || a.dietType || "omnivore";
  const avoidCategories = {
    dairy: !!(a.avoidCategories?.dairy || b.avoidCategories?.dairy),
    eggs: !!(a.avoidCategories?.eggs || b.avoidCategories?.eggs),
    pork: !!(a.avoidCategories?.pork || b.avoidCategories?.pork),
    seafood: !!(a.avoidCategories?.seafood || b.avoidCategories?.seafood),
    shellfish: !!(a.avoidCategories?.shellfish || b.avoidCategories?.shellfish),
    meat: !!(a.avoidCategories?.meat || b.avoidCategories?.meat),
    poultry: !!(a.avoidCategories?.poultry || b.avoidCategories?.poultry),
    alcohol: !!(a.avoidCategories?.alcohol || b.avoidCategories?.alcohol),
    gluten: !!(a.avoidCategories?.gluten || b.avoidCategories?.gluten),
    nuts: !!(a.avoidCategories?.nuts || b.avoidCategories?.nuts),
  };
  const avoidIngredients = Array.from(new Set([...(a.avoidIngredients || []), ...(b.avoidIngredients || [])]));
  const dislikeIngredients = Array.from(new Set([...(a.dislikeIngredients || []), ...(b.dislikeIngredients || [])]));
  const preferredCuisines = Array.from(new Set([...(a.preferredCuisines || []), ...(b.preferredCuisines || [])]));
  return { dietType, avoidCategories, avoidIngredients, dislikeIngredients, preferredCuisines };
}

/* ================================
   Aplicar preferências
================================ */
function shouldRemoveByDietType(flags: ReturnType<typeof classify>, prefs: Prefs) {
  switch (prefs.dietType) {
    case "vegan":       if (flags.meat || flags.poultry || flags.seafood || flags.shellfish || flags.dairy || flags.eggs) return true; break;
    case "vegetarian":  if (flags.meat || flags.poultry || flags.seafood || flags.shellfish) return true; break;
    case "pescatarian": if (flags.meat || flags.poultry) return true; break;
    case "halal":       if (flags.pork || flags.alcohol) return true; break;
    case "kosher":      if (flags.pork || flags.shellfish) return true; break;
  }
  return false;
}
function matchesWordList(name: string, items: string[]) {
  const n = normalizeStr(name);
  return items.some((it) => {
    const t = normalizeStr(String(it));
    return t && (n.includes(t) || new RegExp(`\\b${t}\\b`, "i").test(name));
  });
}
function applyPreferences(planIn: Refeicao[], prefs: Prefs): Refeicao[] {
  const plan: Refeicao[] = JSON.parse(JSON.stringify(planIn));
  for (const ref of plan) {
    const kept: any[] = [];
    for (const a of ref.alimentos) {
      const flags = classify(a.nome);
      if (shouldRemoveByDietType(flags, prefs)) continue;
      if (
        (prefs.avoidCategories.dairy && flags.dairy) ||
        (prefs.avoidCategories.eggs && flags.eggs) ||
        (prefs.avoidCategories.pork && flags.pork) ||
        (prefs.avoidCategories.seafood && flags.seafood) ||
        (prefs.avoidCategories.shellfish && flags.shellfish) ||
        (prefs.avoidCategories.meat && flags.meat) ||
        (prefs.avoidCategories.poultry && flags.poultry) ||
        (prefs.avoidCategories.alcohol && flags.alcohol) ||
        (prefs.avoidCategories.gluten && flags.gluten) ||
        (prefs.avoidCategories.nuts && flags.nuts)
      ) continue;
      if (matchesWordList(a.nome, prefs.avoidIngredients)) continue;
      if (matchesWordList(a.nome, prefs.dislikeIngredients)) continue;

      // troca whey/caseína/soro por isolado vegetal
      if (/(whey|case[ií]na|soro de leite)/i.test(a.nome) &&
          (prefs.dietType === "vegan" || prefs.dietType === "vegetarian" || prefs.avoidCategories.dairy || prefs.avoidCategories.gluten)) {
        const grams = 30;
        const SOY_P = 27/30, SOY_C = 1/30, SOY_F = 1/30;
        const addP = round1(grams * SOY_P), addC = round1(grams * SOY_C), addF = round1(grams * SOY_F);
        const kcal = Math.round(addP * 4 + addC * 4 + addF * 9);
        kept.push({ nome: "Proteína isolada de soja (sem lactose e sem glúten)", quantidade: `${grams}g`,
          proteinas: addP, carboidratos: addC, gorduras: addF, calorias: kcal });
        continue;
      }

      kept.push(a);
    }
    ref.alimentos = kept;
  }
  return plan.filter((r) => r.alimentos.length > 0);
}

/* ================================
   Regras por refeição
================================ */
const BREAKFAST_BANNED = [/arroz/i, /feij[aã]o/i];
function enforceMealSuitability(planIn: Refeicao[]): Refeicao[] {
  const plan = JSON.parse(JSON.stringify(planIn)) as Refeicao[];
  for (const ref of plan) {
    const name = normalizeStr(ref.refeicao);
    const isBreakfast = /(cafe da manha|café da manha|cafe da manhã)/.test(name);
    if (isBreakfast) ref.alimentos = ref.alimentos.filter((a) => !BREAKFAST_BANNED.some((r) => r.test(a.nome)));
  }
  return plan.filter((r) => r.alimentos.length > 0);
}

/* ================================
   Ajuste final (foco proteína)
================================ */
type Booster = { nome: string; p_per_g: number; c_per_g: number; f_per_g: number; allowed: (prefs: Prefs) => boolean; };
function getProteinBoosters(prefs: Prefs): Booster[] {
  return [
    { nome: "Clara de ovo pasteurizada", p_per_g: 0.11, c_per_g: 0, f_per_g: 0, allowed: p => !p.avoidCategories.eggs && p.dietType !== "vegan" },
    { nome: "Proteína isolada de soja (sem lactose e sem glúten)", p_per_g: 27/30, c_per_g: 1/30, f_per_g: 1/30, allowed: _ => true },
    { nome: "Proteína isolada de ervilha (sem lactose e sem glúten)", p_per_g: 24/30, c_per_g: 3/30, f_per_g: 2/30, allowed: _ => true },
  ].filter(b => b.allowed(prefs));
}
function totalGramsOf(plan: Refeicao[], itemName: string) {
  let g = 0;
  for (const ref of plan) for (const a of ref.alimentos) {
    if (new RegExp(itemName, "i").test(a.nome)) {
      const m = String(a.quantidade).match(/(-?\d+(?:[.,]\d+)?)\s*g\b/);
      if (m) g += toNumber(m[1]);
    }
  }
  return g;
}
function adjustPlanToTargets(
  planIn: Refeicao[],
  targets: { protein: number; carbs: number; fat: number },
  prefs: Prefs
) {
  const plan = JSON.parse(JSON.stringify(planIn)) as Refeicao[];

  let adjIdx = plan.findIndex((r) => /ajustes do dia|suplementos/i.test(r.refeicao));
  if (adjIdx === -1) { plan.push({ refeicao: "Ajustes do Dia", alimentos: [] as any }); adjIdx = plan.length - 1; }
  const ajustes = plan[adjIdx].alimentos as any[];

  let { protein, carbs, fat } = sumMacros(plan);
  const minProtein = targets.protein;
  const maxProtein = round1(targets.protein * 1.05);

  if (protein < minProtein) {
    const boosters = getProteinBoosters(prefs).sort((a, b) => {
      const az = (a.c_per_g === 0 && a.f_per_g === 0) ? -1 : 0;
      const bz = (b.c_per_g === 0 && b.f_per_g === 0) ? -1 : 0;
      if (az !== bz) return az - bz;
      return (a.c_per_g - b.c_per_g) || (a.f_per_g - b.f_per_g);
    });

    for (const b of boosters) {
      if (protein >= minProtein) break;

      const needP = Math.max(0, maxProtein - protein);
      if (needP <= 0) break;

      const carbRoom = Math.max(0, targets.carbs - carbs);
      const fatRoom  = Math.max(0, targets.fat   - fat);

      const gramsByP = needP / b.p_per_g;
      const gramsByC = b.c_per_g > 0 ? (carbRoom / b.c_per_g) : Number.POSITIVE_INFINITY;
      const gramsByF = b.f_per_g > 0 ? (fatRoom  / b.f_per_g) : Number.POSITIVE_INFINITY;
      const gByMax   = Math.floor((maxProtein - protein) / b.p_per_g);

      const already = totalGramsOf(plan, b.nome);
      const capacityLeft = Math.max(0, 250 - already);

      let grams: number;
      if (b.c_per_g === 0 && b.f_per_g === 0) {
        const gToHitMin = Math.ceil((minProtein - protein) / b.p_per_g);
        const gToStayMax = Math.floor((maxProtein - protein) / b.p_per_g);
        grams = Math.max(0, Math.min(gToHitMin, gToStayMax, capacityLeft));
      } else {
        grams = Math.floor(Math.max(0, Math.min(gramsByP, gramsByC, gramsByF, gByMax, capacityLeft)));
      }
      grams = Math.min(grams, 250);

      if (grams > 0) {
        const addP = round1(grams * b.p_per_g);
        const addC = round1(grams * b.c_per_g);
        const addF = round1(grams * b.f_per_g);
        const kcal = Math.round(addP * 4 + addC * 4 + addF * 9);

        ajustes.push({ nome: b.nome, quantidade: `${grams}g`, proteinas: addP, carboidratos: addC, gorduras: addF, calorias: kcal });
        protein = round1(protein + addP);
        carbs   = round1(carbs + addC);
        fat     = round1(fat + addF);
      }
    }

    // fallback zero C/F se ainda abaixo
    if (protein < minProtein) {
      const zeroCF = getProteinBoosters(prefs).find(b => b.c_per_g === 0 && b.f_per_g === 0);
      if (zeroCF) {
        const already = totalGramsOf(plan, zeroCF.nome);
        const capacityLeft = Math.max(0, 250 - already);
        const gToHitMin = Math.ceil((minProtein - protein) / zeroCF.p_per_g);
        const gToStayMax = Math.floor((maxProtein - protein) / zeroCF.p_per_g);
        let grams = Math.max(0, Math.min(gToHitMin, gToStayMax, capacityLeft));
        grams = Math.min(grams, 250);
        if (grams > 0) {
          const addP = round1(grams * zeroCF.p_per_g);
          const kcal = Math.round(addP * 4);
          ajustes.push({ nome: zeroCF.nome, quantidade: `${round1(grams)}g`, proteinas: addP, carboidratos: 0, gorduras: 0, calorias: kcal });
          protein = round1(protein + addP);
        }
      }
    }
  }

  // gordura
  let needFat = round1(Math.max(0, targets.fat - fat));
  if (needFat > 0) {
    const allowed = Math.min(needFat, 250 - totalGramsOf(plan, "Azeite de oliva extra virgem"));
    const addG = Math.max(0, Math.min(allowed, 250));
    if (addG > 0) {
      const kcal = Math.round(addG * 9);
      ajustes.push({ nome: "Azeite de oliva extra virgem", quantidade: `${round1(addG)}g`,
        proteinas: 0, carboidratos: 0, gorduras: round1(addG), calorias: kcal });
      fat = round1(fat + addG);
    }
  }

  // carbo
  let needCarb = round1(Math.max(0, targets.carbs - carbs));
  if (needCarb > 0) {
    const allowed = Math.min(needCarb, 250 - totalGramsOf(plan, "Maltodextrina"));
    const addG = Math.max(0, Math.min(allowed, 250));
    if (addG > 0) {
      const kcal = Math.round(addG * 4);
      ajustes.push({ nome: "Maltodextrina", quantidade: `${round1(addG)}g`,
        proteinas: 0, carboidratos: round1(addG), gorduras: 0, calorias: kcal });
      carbs = round1(carbs + addG);
    }
  }

  return plan;
}

/* ================================
   Firestore: metas estritas
================================ */
async function getUserMeta(email: string): Promise<{ proteina: number; carboidrato: number; gordura: number } | null> {
  try {
    const metasRef: any = collection(db, "chatfit", email, "metasusuario");
    const snap = await metasRef.orderBy("createdAt", "desc").limit(1).get();
    if (snap.empty) return null;
    const data = snap.docs[0].data() || {};
    const proteina = toNumber(data.proteina);
    const carboidrato = toNumber(data.carboidrato);
    const gordura = toNumber(data.gordura);
    if (proteina <= 0 || carboidrato <= 0 || gordura <= 0) return null;
    return { proteina, carboidrato, gordura };
  } catch (err) {
    console.error("Erro ao buscar metas do usuário:", err);
    return null;
  }
}

/* ================================
   Handler principal
================================ */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const { messages, userEmail } = body ?? {};

    if (!userEmail || typeof userEmail !== "string") {
      return NextResponse.json({ error: "userEmail não informado." }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Campo 'messages' ausente ou inválido." }, { status: 400 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY ausente." }, { status: 500 });
    }

    // metas obrigatórias
    const userMeta = await getUserMeta(userEmail);
    if (!userMeta) {
      return NextResponse.json({ error: `Metas do usuário não encontradas para ${userEmail}.` }, { status: 404 });
    }

    // preferências
    const prefsDoc = await getUserPrefs(userEmail);
    const prefsMsg = prefsFromMessages(messages);
    const prefs = mergePrefs(prefsDoc, prefsMsg);

    // prompt
    const prefsLines: string[] = [];
    if (prefs.dietType && prefs.dietType !== "omnivore") prefsLines.push(`- Estilo: ${prefs.dietType}`);
    const catMap = {
      dairy: "sem laticínios/lactose", eggs: "sem ovos", pork: "sem porco", seafood: "sem peixe", shellfish: "sem frutos do mar",
      meat: "sem carne vermelha", poultry: "sem frango/aves", alcohol: "sem álcool", gluten: "sem glúten", nuts: "sem oleaginosas",
    } as const;
    for (const k of Object.keys(prefs.avoidCategories) as (keyof Prefs["avoidCategories"])[]) {
      if (prefs.avoidCategories[k]) prefsLines.push(`- ${catMap[k]}`);
    }
    if (prefs.avoidIngredients.length) prefsLines.push(`- Evitar: ${prefs.avoidIngredients.join(", ")}`);
    if (prefs.dislikeIngredients.length) prefsLines.push(`- Não gosto: ${prefs.dislikeIngredients.join(", ")}`);

    const systemPrompt = `
    Você deve gerar um plano alimentar de 1 dia, seguindo METAS e PREFERÊNCIAS **sem citar marcas**.

    ***REGRAS IMPORTANTES***
    - Use APENAS **nomes genéricos de alimentos**, sem marca (ex.: "pão integral", "queijo minas", "iogurte de soja").
    - Se o usuário tiver restrições (ex.: sem lactose/glúten/vegano/vegetariano), **NÃO** use whey/caseína/soro de leite; prefira proteína vegetal isolada.
    - Café da Manhã: evite pratos típicos de almoço/jantar (ex.: arroz/feijão).
    - Cada refeição deve ter **no mínimo 2 itens**.
    - Limite por item **≤ 250g**. Se usar medidas caseiras, informe **quantidade + unidade** (g, ml, fatia, colher de sopa, xícara, unidade).
    - Preencha **proteínas, carboidratos, gorduras e calorias** de cada item (valores > 0).
    - **Priorize bater a PROTEÍNA** (pode passar até +5%). Carboidrato e gordura **não podem ultrapassar** as metas.
    - Se faltar proteína, complemente com **proteína vegetal isolada** (ex.: soja/ervilha). 
    - Se faltar gordura, **azeite de oliva extra virgem**. Se faltar carboidrato, **maltodextrina**.

    METAS (Firestore):
    - Proteína: ${userMeta.proteina}g (PRIORIDADE: atingir; pode passar até +5%)
    - Carboidratos: ${userMeta.carboidrato}g (NÃO ultrapassar)
    - Gordura: ${userMeta.gordura}g (NÃO ultrapassar)

    PREFERÊNCIAS DO USUÁRIO:
    ${prefsLines.length ? prefsLines.join("\n") : "- (Nenhuma explícita)"}

    RETORNO OBRIGATÓRIO:
    - **Apenas** o bloco <FOODS_JSON>...</FOODS_JSON> contendo um **ARRAY JSON** no formato:
    <FOODS_JSON>[
      {
        "refeicao": "Café da Manhã",
        "alimentos": [
          {"nome": "pão integral", "quantidade": "2 fatias", "proteinas": 8, "carboidratos": 30, "gorduras": 2, "calorias": 160},
          {"nome": "ovo de galinha", "quantidade": "2 unidades", "proteinas": 12, "carboidratos": 2, "gorduras": 10, "calorias": 140}
        ]
      }
    ]</FOODS_JSON>
    `.trim();


    const openAIMessages = [{ role: "system", content: systemPrompt }, ...messages];

    // OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o", messages: openAIMessages, max_tokens: 1800, temperature: 0.2 }),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      console.error("[OpenAI] HTTP error:", response.status, response.statusText, txt);
      return NextResponse.json({ error: "Falha na geração do plano." }, { status: 502 });
    }
    const data = await response.json().catch(() => ({} as any));
    if (data?.error) {
      console.error("[OpenAI] API error:", data.error);
      return NextResponse.json({ error: "Falha na geração do plano." }, { status: 502 });
    }

    // Parse do LLM (pega NOME/QUANTIDADE)
    const rawContent: string = data?.choices?.[0]?.message?.content ?? "[]";
    const foodsBlock = extractFoodsBlock(rawContent);
    let planNames: { refeicao: string; alimentos: { nome: string; quantidade: string }[] }[];
    try {
      const parsedRaw: any = JSON.parse(foodsBlock);
      planNames = sanitizePlanNames(parsedRaw);
    } catch (err) {
      console.error("Erro de parse JSON do LLM:", err, foodsBlock);
      return NextResponse.json({ error: "Plano retornado em formato inválido." }, { status: 422 });
    }

    // (1) Recalcula com base local + hard + openfood
    let plan = await rebuildPlanWithDB(req, planNames);

    // (2) Preferências
    plan = applyPreferences(plan, prefs);

    // (3) Suitability
    plan = enforceMealSuitability(plan);

    // (4) Estrutura mínima se necessário
    if (!plan.length) {
      plan = [
        { refeicao: "Café da Manhã", alimentos: [] as any },
        { refeicao: "Almoço", alimentos: [] as any },
        { refeicao: "Lanche da Tarde", alimentos: [] as any },
        { refeicao: "Jantar", alimentos: [] as any },
      ];
    }

    // (5) Ajuste final (proteína primeiro; clamps 250 g por item)
    plan = adjustPlanToTargets(
      plan,
      { protein: userMeta.proteina, carbs: userMeta.carboidrato, fat: userMeta.gordura },
      prefs
    );

    // Validação final
    let groupedPlan: Refeicao[];
    try {
      groupedPlan = PlanoSchema.parse(plan.filter((r) => r.alimentos.length > 0));
    } catch (err) {
      console.error("Erro de validação final do plano:", err);
      return NextResponse.json({ error: "Plano final inválido." }, { status: 422 });
    }

    const totals = sumMacros(groupedPlan);
    const content = renderGroupedPlan(groupedPlan, totals);

    // Salvar
    await setDoc(
      doc(db, "chatfit", userEmail, "planos", "dieta"),
      {
        content, alimentos: groupedPlan, updatedAt: new Date().toISOString(), totals,
        meta: { proteina: userMeta.proteina, carboidrato: userMeta.carboidrato, gordura: userMeta.gordura },
        prefs, source: "alimentos_br.json|hard-fallback|openfood",
      },
      { merge: false } as any
    );

    return NextResponse.json({
      reply: content, alimentos: groupedPlan, totals,
      meta: { proteina: userMeta.proteina, carboidrato: userMeta.carboidrato, gordura: userMeta.gordura },
      prefs, source: "alimentos_br.json|hard-fallback|openfood",
    });
  } catch (err: any) {
    console.error("Erro inesperado no endpoint:", err);
    return NextResponse.json({ error: "Erro inesperado: " + (err?.message || "") }, { status: 500 });
  }
}
