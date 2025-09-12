// src/lib/openFoodFacts.ts
// Base local + OFF robusto com scoring, filtros pt-BR e sanity-check
// Mantém API pública: getFoodData, gramsPerUnitFor, calcMacros

import { parseNumberSafe } from "./utils";

// =====================
// 1) MAPA LOCAL (manual)
// =====================

const foodMapping: {
  [key: string]: { calories: number; protein: number; carbs: number; fat: number; category: string }
} = {
  "aveia em flocos":      { calories: 366, protein: 13.9, carbs: 67.7, fat: 6.9, category: "cereals" },
  "banana":               { calories: 89,  protein: 1.1,  carbs: 22.8, fat: 0.3, category: "fruits" },
  "arroz integral":       { calories: 124, protein: 2.6,  carbs: 25.8, fat: 1.0, category: "cereals" },
  "feijão preto":         { calories: 77,  protein: 4.5,  carbs: 14.0, fat: 0.5, category: "legumes" },
  "ovo":                  { calories: 143, protein: 13.0, carbs: 1.1,  fat: 9.5, category: "eggs" },
  "ovos":                 { calories: 143, protein: 13.0, carbs: 1.1,  fat: 9.5, category: "eggs" },
  "tofu":                 { calories: 76,  protein: 8.0,  carbs: 1.9,  fat: 4.8, category: "tofu" },
  "amêndoas":             { calories: 579, protein: 21.2, carbs: 21.7, fat: 49.9, category: "nuts" },
  "maçã":                 { calories: 52,  protein: 0.3,  carbs: 13.8, fat: 0.2, category: "fruits" },
  "iogurte grego":        { calories: 59,  protein: 10.0, carbs: 3.6,  fat: 0.4, category: "dairies" },
  "iogurte natural":      { calories: 61,  protein: 3.5, carbs: 4.7,  fat: 3.3, category: "dairies" },
  "peito de peru defumado": { calories: 109, protein: 17.8, carbs: 1.2, fat: 3.5, category: "meats" },
  "filé de soja":         { calories: 140, protein: 10.0, carbs: 7.0,  fat: 7.0, category: "proteins" },
  "batata-doce":          { calories: 86,  protein: 1.6,  carbs: 20.1, fat: 0.1, category: "roots" },
  "hambúrguer de lentilha": { calories: 130, protein: 7.0, carbs: 18.0, fat: 2.0, category: "proteins" },
  "brócolis":             { calories: 34,  protein: 2.8,  carbs: 6.6,  fat: 0.4, category: "vegetables" },
  "salada mista":         { calories: 20,  protein: 1.0,  carbs: 4.0,  fat: 0.2, category: "vegetables" },
  "chia":                 { calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7, category: "seeds" },
  "lentilha":             { calories: 92,  protein: 7.6,  carbs: 16.9, fat: 0.4, category: "legumes" },
  "pão integral":         { calories: 247, protein: 9.0,  carbs: 41.0, fat: 3.4, category: "bread" },
  "azeite de oliva":      { calories: 884, protein: 0.0,  carbs: 0.0,  fat: 100.0, category: "fats" },
  "quinoa":               { calories: 120, protein: 4.1,  carbs: 21.3, fat: 1.9, category: "cereals" },
  "morangos":             { calories: 32,  protein: 0.7,  carbs: 7.7,  fat: 0.3, category: "fruits" },
  "whey protein":         { calories: 400, protein: 80.0, carbs: 7.0,  fat: 6.0, category: "proteins" }
};

// =====================
// 2) PORÇÕES MÉDIAS
// =====================

const PORTION_GRAMS: Record<string, number> = {
  "ovo":50, "banana":100, "pao integral":50, "fatia de pao integral":50, "maçã":130,
  "iogurte natural":170, "pao frances":50, "queijo minas":30, "amendoas":15
};

// Equivalências de unidades comuns (aproximadas)
const UNIT_EQUIVALENTS: Record<string, number> = {
  "xicara": 120,
  "xícara": 120,
  "colher sopa": 15,
  "colher cha": 5,
  "colher chá": 5,
  "pote": 170,
  "scoop": 30,
  "fatia": 50
};

// =====================
// 3) HELPERS
// =====================

function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getManualFood(foodName: string) {
  const normalized = normalizeFoodName(foodName);
  for (const key of Object.keys(foodMapping)) {
    if (normalized.includes(normalizeFoodName(key))) {
      return { name: key, ...foodMapping[key], source: "manual" as const };
    }
  }
  return null;
}

// =====================
// 4) OFF UTILITÁRIOS
// =====================

type OFFProduct = {
  product_name?: string;
  nutriments?: Record<string, any>;
  lc?: string;
  countries_tags?: string[];
  categories_tags?: string[];
  languages_tags?: string[];
  code?: string;
  brands?: string;
  serving_size?: string;
};

function kjToKcal(kj: number): number {
  return kj * 0.2390057361;
}

function readPer100g(nutr: Record<string, any>) {
  const kcal =
    parseNumberSafe(nutr?.["energy-kcal_100g"]) ||
    parseNumberSafe(nutr?.energy_kcal_100g) ||
    (nutr?.energy_100g ? kjToKcal(parseNumberSafe(nutr.energy_100g)) : 0);

  const protein =
    parseNumberSafe(nutr?.["proteins_100g"]) ||
    parseNumberSafe(nutr?.proteins_100g) ||
    parseNumberSafe(nutr?.protein_100g);

  const carbs =
    parseNumberSafe(nutr?.["carbohydrates_100g"]) ||
    parseNumberSafe(nutr?.carbohydrates_100g) ||
    parseNumberSafe(nutr?.carbs_100g);

  const fat =
    parseNumberSafe(nutr?.["fat_100g"]) ||
    parseNumberSafe(nutr?.fat_100g);

  return { kcal, protein, carbs, fat };
}

// =====================
// 5) SIMILARIDADE
// =====================

function jaroWinkler(a: string, b: string): number {
  const s1 = a, s2 = b;
  const m = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (!s1.length || !s2.length) return 0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - m);
    const end = Math.min(i + m + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++; break;
    }
  }
  if (!matches) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  t = t / 2;

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - t) / matches) / 3;

  let l = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) l++; else break;
  }
  return jaro + l * 0.1 * (1 - jaro);
}

function tokens(s: string): Set<string> {
  return new Set(normalizeFoodName(s).split(" ").filter(Boolean));
}

function tokenOverlap(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  return inter / A.size;
}

function plausibleMacros(name: string, per: { kcal: number; protein: number; carbs: number; fat: number }): boolean {
  const { kcal, protein, carbs, fat } = per;
  if (!(kcal > 0 && kcal < 1000)) return false;
  if (protein < 0 || protein > 100) return false;
  if (carbs   < 0 || carbs   > 100) return false;
  if (fat     < 0 || fat     > 100) return false;

  const n = normalizeFoodName(name);

  if (/\bovo|ovos\b/.test(n)) {
    if (carbs > 3) return false;
    if (protein < 8 || protein > 20) return false;
    if (fat < 5 || fat > 15) return false;
  }
  if (/\barroz\b/.test(n)) {
    if (protein > 10) return false;
    if (fat > 10) return false;
  }
  if (/\bbrocolis\b/.test(n)) {
    if (fat > 5) return false;
    if (carbs > 20) return false;
  }
  return true;
}

function scoreProduct(p: OFFProduct, query: string): number {
  const name = p.product_name || "";
  const jw = jaroWinkler(normalizeFoodName(name), normalizeFoodName(query));
  const overlap = tokenOverlap(name, query);

  let localeBonus = 0;
  if ((p.lc || "").toLowerCase() === "pt") localeBonus += 0.05;
  if (Array.isArray(p.languages_tags) && p.languages_tags.some(t => /portuguese/i.test(t))) localeBonus += 0.03;
  if (Array.isArray(p.countries_tags)  && p.countries_tags.some(t => /brazil/i.test(t))) localeBonus += 0.05;

  const cats = (p.categories_tags || []).join(" ").toLowerCase();
  const qn = normalizeFoodName(query);
  if ((/\bovo|egg\b/.test(qn)) && /egg|ovo/.test(cats)) localeBonus += 0.03;
  if ((/\bpao|p[aã]o|bread\b/.test(qn)) && /bread/.test(cats)) localeBonus += 0.03;
  if ((/\barroz|rice\b/.test(qn)) && /rice/.test(cats)) localeBonus += 0.03;

  return 0.7 * overlap + 0.2 * jw + localeBonus;
}

// =====================
// 6) FETCH OFF
// =====================

async function offFetch(query: string): Promise<OFFProduct[]> {
  const url =
    `https://world.openfoodfacts.org/api/v2/search` +
    `?search_terms=${encodeURIComponent(query)}` +
    `&page_size=20` +
    `&fields=code,product_name,brands,lc,nutriments,serving_size,countries_tags,languages_tags,categories_tags`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FitWA/1.0 (+github.com/victorNutrify/FitWA)" }
  });
  if (!res.ok) throw new Error(`OFF HTTP ${res.status}`);
  const json = await res.json();
  return json?.products ?? [];
}

function pickBest(products: OFFProduct[], query: string) {
  const ranked = products
    .map(p => {
      const per = readPer100g(p.nutriments || {});
      return { p, per };
    })
    .filter(({ p, per }) => per.kcal > 0 && plausibleMacros(p.product_name || query, per))
    .map(({ p, per }) => ({ p, per, score: scoreProduct(p, query) }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;
  const best = ranked[0];
  if (best.score < 0.75) return null;
  return best;
}

function logChoice(info: any) {
  try { console.log("[OPENFOODFACTS]", JSON.stringify(info)); } catch { /* noop */ }
}

async function offSearchText(q: string) {
  try {
    const products = await offFetch(q);
    if (!products.length) {
      logChoice({ q, reason: "no_products" });
      return null;
    }
    const best = pickBest(products, q);
    if (!best) {
      logChoice({ q, reason: "no_plausible_choice" });
      return null;
    }
    const { p, per, score } = best;
    logChoice({ q, picked: p.product_name, code: p.code, lc: p.lc, score, countries: p.countries_tags });

    return {
      name: p.product_name || q,
      calories: +per.kcal.toFixed(1),
      protein:  +per.protein.toFixed(1),
      carbs:    +per.carbs.toFixed(1),
      fat:      +per.fat.toFixed(1),
      source: "openfoodfacts" as const
    };
  } catch (e) {
    console.log("[OPENFOODFACTS] error", q, e);
    return null;
  }
}

// =====================
// 7) API PÚBLICA
// =====================

export async function getFoodData(foodName: string) {
  const manual = getManualFood(foodName);
  if (manual) return manual;

  const api = await offSearchText(foodName);
  if (api) return api;

  return { name: foodName, calories: 0, protein: 0, carbs: 0, fat: 0, source: "notfound" as const };
}

export function gramsPerUnitFor(name: string) {
  const k = normalizeFoodName(name);

  // procura no PORTION_GRAMS (frutas, pães, etc.)
  for (const key of Object.keys(PORTION_GRAMS)) {
    if (k.includes(key)) return PORTION_GRAMS[key];
  }

  // procura equivalências de unidades
  for (const key of Object.keys(UNIT_EQUIVALENTS)) {
    if (k.includes(key)) return UNIT_EQUIVALENTS[key];
  }

  return 100; // fallback
}

export function calcMacros(
  macro: { name?: string; calories: number; protein: number; carbs: number; fat: number; source: string },
  qty: number,
  unit: string
) {
  let factor = 1;
  if (unit === "g" || unit === "ml") factor = qty / 100;
  else if (unit === "unid" || unit === "fatia" || unit === "scoop" || unit === "xicara" || unit === "colher sopa" || unit === "colher cha" || unit === "pote") {
    factor = (gramsPerUnitFor(macro.name || unit) * qty) / 100;
  }

  return {
    calories: +(macro.calories * factor).toFixed(1),
    protein:  +(macro.protein  * factor).toFixed(1),
    carbs:    +(macro.carbs    * factor).toFixed(1),
    fat:      +(macro.fat      * factor).toFixed(1),
    source: macro.source
  };
}
