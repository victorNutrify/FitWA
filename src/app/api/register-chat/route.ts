import { NextRequest, NextResponse } from "next/server";
import { db, doc, setDoc, getDocs, collection, runTransaction, deleteDoc } from "@/lib/firestore.admin.compat";
import fs from "fs";
import path from "path";
import { getAuth } from "firebase-admin/auth";
import { FOOD_SYSTEM_PROMPT } from "@/ai/prompts/foodLogger";
import { parseNumberSafe } from "@/lib/utils";
import { EXERCISE_SYSTEM_PROMPT } from "@/ai/prompts/exerciseLogger";
import { UNIFIED_LOGGER_PROMPT } from "@/ai/prompts/unifiedLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // opcional, evita cache

// Carrega alimentos_br.json da raiz
let alimentosBr: any[] = [];
try {
  const jsonPath = path.resolve(process.cwd(), "alimentos_br.json");
  const jsonContent = fs.readFileSync(jsonPath, "utf-8");
  alimentosBr = JSON.parse(jsonContent);
  console.log("alimentos_br.json carregado com", alimentosBr.length, "alimentos.");
} catch (e) {
  alimentosBr = [];
  console.error("Erro ao carregar alimentos_br.json:", e);
}

// ---------- Funções utilitárias ----------
function getBrasiliaDate() {
  const now = new Date();
  const brasiliaOffsetMs = -3 * 60 * 60 * 1000;
  return new Date(now.getTime() + brasiliaOffsetMs);
}
function pad2(n: number) { return String(n).padStart(2, "0"); }

function getHorarioBrasilISO() {
  const d = getBrasiliaDate();
  const year = d.getUTCFullYear();
  const month = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const hour = pad2(d.getUTCHours());
  const minute = pad2(d.getUTCMinutes());
  const second = pad2(d.getUTCSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}
function getDiaAtual() {
  return getHorarioBrasilISO().slice(0, 10);
}

const pesoMedioPorUnidade: Record<string, number> = {
  // frutas
  melancia: 5000, melao: 1500, "maçã": 130, maca: 130, laranja: 150, banana: 120, pera: 160, manga: 300, abacaxi: 1400,
  tomate: 110, cenoura: 70, batata: 90,

  // itens comuns
  "pão francês": 50, pao: 50, pao_frances: 50, "pão de forma": 25, "fatia de pão": 25, "fatia de pão de forma": 25,
  bife: 120, "bife de carne": 120, frango: 120, ovo: 50,

  // sushi
  sushi: 30, temaki: 120, nigiri: 25, sashimi: 15,

  // snacks/petit-fours
  biscoito: 6, bolacha: 7, cookie: 15, bombom: 20, chocolate: 25,
  pastel: 80, coxinha: 70, quibe: 90, empada: 60,

  // medidas caseiras (peso médio do “conteúdo”)
  "colher de geleia": 15, "colher de sopa": 15, "colher": 15,
  "prato de salada": 100, "salada": 100, "salada verde": 100, "folhas": 30,
  "prato": 300, "porção": 100, "tigela": 250, "bowl": 250,

  // castanhas / nozes / sementes
  amendoim: 1,             // ~1 g por grão
  "amendoim japones": 2,   // grão com cobertura
  "castanha de caju": 5,
  "castanha-do-para": 5, "castanha do para": 5,
  nozes: 5, noz: 5,
  amendoa: 1.2, "amêndoa": 1.2,
  pistache: 0.8,
  avela: 1.2, "avelã": 1.2,
};

const unidadeParaGramas: Record<string, number> = {
  colher: 15,
  colher_cha: 5,
  xicara: 120,
  copo: 200,
  lata: 350,
  bife: 120,
  fatia: 25,
  prato: 300,
  tigela: 250,
  bowl: 250,
  ml: 1,
};

function stripAccents(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarNome(nome: string) {
  if (!nome) return "";
  let txt = stripAccents(nome.toLowerCase())
    .replace(/(\s|_|-)+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
  txt = txt.replace(/\bovos\b/g, "ovo")
    .replace(/\bbananas\b/g, "banana")
    .replace(/\bpães\b/g, "pao")
    .replace(/\bfatias\b/g, "fatia");
  return txt;
}

function ehAgua(texto: string) {
  // normaliza: minúsculas + sem acentos
  const n = stripAccents(String(texto || "").toLowerCase()).trim();
  if (!n) return false;

  // cobre "d'agua" / "dagua" -> "agua" para o \b funcionar
  const n2 = n.replace(/\bd['’]?agua\b/g, "agua");

  // palavra "agua" isolada em qualquer ponto da expressão
  return /\bagua\b/.test(n2);
}

function normalizarUnidade(u: string) {
  const x = stripAccents((u || "").toLowerCase().trim());
  if (!x) return "";
  if (/^(unid|unidade|unidades|u|und|x)$/.test(x)) return "unidade";
  if (/^(g|grama|gramas)$/.test(x)) return "g";
  if (/^(kg|quilo|quilos)$/.test(x)) return "kg";
  if (/^(ml|mililitro|mililitros)$/.test(x)) return "ml";
  if (/^(l|litro|litros)$/.test(x)) return "l";
  if (/^(colher|colheres|csp|cs)$/.test(x)) return "colher";
  if (/^(colhercha|colherdecha|cc|ccha|cch)$/.test(x)) return "colher_cha";
  if (/^(xicara|xicaras)$/.test(x)) return "xicara";
  if (/^(fatia|fatias)$/.test(x)) return "fatia";
  if (/^(bife|bifes)$/.test(x)) return "bife";
  if (/^(pato|patos)$/.test(x)) return "pato";
  if (/^(copo|copos)$/.test(x)) return "copo";
  if (/^(lata|latas)$/.test(x)) return "lata";
  if (/^(prato|pratos)$/.test(x)) return "prato";
  if (/^(tigela|tigelas|bowl|bowls)$/.test(x)) return "tigela";
  return x;
}

// --- Mapas normalizados (adicione logo após normalizarNome/normalizarUnidade) ---
const pesoMedioPorUnidadeNorm: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(pesoMedioPorUnidade)) {
    out[normalizarNome(k)] = pesoMedioPorUnidade[k];
  }
  return out;
})();

const unidadeParaGramasNorm: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(unidadeParaGramas)) {
    out[normalizarUnidade(k)] = unidadeParaGramas[k];
  }
  return out;
})();

// Tolerante: aceita number ou string
function parseQuantidade(qtd: string | number) {
  if (qtd == null) return { valor: 1, unidade: "" };
  const s = String(qtd).trim();
  if (!s) return { valor: 1, unidade: "" };
  const qtdNorm = s.toLowerCase().replace(",", ".").replace(/\s+/g, " ").trim();
  const match = qtdNorm.match(/([\d\.]+)\s*([a-zA-Zµ]*)/);
  if (match) {
    const valor = parseFloat(match[1]) || 1;
    const unidade = normalizarUnidade(match[2] || "");
    return { valor, unidade };
  }
  return { valor: 1, unidade: "" };
}

function alimentoDocId(nomeNorm: string, unidadeCanon: string) {
  const safeNome = encodeURIComponent(nomeNorm || "sem");
  const safeUni = encodeURIComponent(unidadeCanon || "sem");
  return `${safeNome}__${safeUni}`;
}

function buscarPorcaoJson(nomeNorm: string) {
  for (const alimento of alimentosBr) {
    const nomeAlimento = normalizarNome(alimento.name || alimento.nome || "");
    if (nomeAlimento === nomeNorm) return alimento;
  }
  if (["agua"].includes(nomeNorm)) {
    for (const alimento of alimentosBr) {
      const nomeAlimento = normalizarNome(alimento.name || alimento.nome || "");
      const categoria = stripAccents((alimento.category || "").toLowerCase());
      if (nomeAlimento === "agua" && (categoria.includes("agua") || categoria.includes("bebidas"))) {
        return alimento;
      }
    }
    return null;
  }
  for (const alimento of alimentosBr) {
    const nomeAlimento = normalizarNome(alimento.name || alimento.nome || "");
    const categoria = stripAccents((alimento.category || "").toLowerCase());
    if (nomeAlimento.startsWith(nomeNorm) &&
        !categoria.includes("doce") &&
        !categoria.includes("sobremesa") &&
        !categoria.includes("confeitaria")) {
      return alimento;
    }
  }
  const partes = nomeNorm.split(" ");
  for (const alimento of alimentosBr) {
    const nomeAlimento = normalizarNome(alimento.name || alimento.nome || "");
    const partesAlimento = nomeAlimento.split(" ");
    const categoria = stripAccents((alimento.category || "").toLowerCase());
    const matches = partes.filter(p => partesAlimento.includes(p)).length;
    if (matches > 0 &&
        (matches >= partes.length / 2 || matches >= partesAlimento.length / 2) &&
        !categoria.includes("doce") &&
        !categoria.includes("sobremesa") &&
        !categoria.includes("confeitaria")) {
      if (nomeNorm === "agua" && nomeAlimento !== "agua") continue;
      return alimento;
    }
  }
  return null;
}

function buscarMacrosBr(nomeNorm: string) {
  const alimento = buscarPorcaoJson(nomeNorm);
  if (alimento) {
    const nutr = alimento.nutriments || {};
    const porcao = Number(alimento.portion_grams) || 100;

    // Normaliza macros por 100g
    const calorias100g = Number(nutr.calories || 0) * (100 / porcao);
    const proteina100g = Number(nutr.protein_g || 0) * (100 / porcao);
    const carbo100g = Number(nutr.carbs_g || 0) * (100 / porcao);
    const gordura100g = Number(nutr.fat_g || 0) * (100 / porcao);

    return {
      calorias: calorias100g,
      proteina: proteina100g,
      carboidrato: carbo100g,
      gordura: gordura100g,
      fonteMacros: "Match via alimentos_br.json",
      porcaoPadrao: porcao,
      nomeUsado: alimento.name || alimento.nome || "",
    };
  }
  return null;
}

async function buscarOpenFood(alimentoNome: string) {
  const nomeNorm = normalizarNome(alimentoNome);
  try {
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(nomeNorm)}&search_simple=1&json=1&page_size=10`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.products || data.products.length === 0) return null;

    for (const produto of data.products) {
      const nomeProduto = normalizarNome(produto.product_name || produto.generic_name || "");
      const categoria = ((produto.categories_tags || []).map((c: string) => c.toLowerCase()).join(" "));
      if (nomeProduto === nomeNorm &&
          !categoria.includes("doce") &&
          !categoria.includes("dessert") &&
          !categoria.includes("confeitaria")) {
        return extrairMacrosOpenFood(produto, nomeNorm, nomeProduto);
      }
    }
    for (const produto of data.products) {
      const nomeProduto = normalizarNome(produto.product_name || produto.generic_name || "");
      const categoria = ((produto.categories_tags || []).map((c: string) => c.toLowerCase()).join(" "));
      if (nomeProduto.startsWith(nomeNorm) &&
          !categoria.includes("doce") &&
          !categoria.includes("dessert") &&
          !categoria.includes("confeitaria")) {
        return extrairMacrosOpenFood(produto, nomeNorm, nomeProduto);
      }
    }
    if (["agua"].includes(nomeNorm)) {
      for (const produto of data.products) {
        const nomeProduto = normalizarNome(produto.product_name || produto.generic_name || "");
        const categoria = ((produto.categories_tags || []).map((c: string) => c.toLowerCase()).join(" "));
        if ((nomeProduto === "agua") && (categoria.includes("water") || categoria.includes("agua") || categoria.includes("bebida"))) {
          return extrairMacrosOpenFood(produto, nomeNorm, nomeProduto);
        }
      }
      return null;
    }
    const partes = nomeNorm.split(" ");
    for (const produto of data.products) {
      const nomeProduto = normalizarNome(produto.product_name || produto.generic_name || "");
      const partesProduto = nomeProduto.split(" ");
      const categoria = ((produto.categories_tags || []).map((c: string) => c.toLowerCase()).join(" "));
      const matches = partes.filter(p => partesProduto.includes(p)).length;
      if (matches > 0 &&
          (matches >= partes.length / 2 || matches >= partesProduto.length / 2) &&
          !categoria.includes("doce") &&
          !categoria.includes("dessert") &&
          !categoria.includes("confeitaria")) {
        if (["agua"].includes(nomeNorm)) {
          if (categoria.includes("water") || categoria.includes("agua") || categoria.includes("bebida")) {
            if (nomeProduto !== "agua") continue;
          } else { continue; }
        }
        return extrairMacrosOpenFood(produto, nomeNorm, nomeProduto);
      }
    }
  } catch (err) {
    console.error("[OpenFood] Erro ao buscar alimento:", alimentoNome, err);
  }
  return null;
}

function extrairMacrosOpenFood(produto: any, nomeNorm: string, nomeEncontrado: string) {
  let porcaoPadrao = 100;
  if (nomeNorm.includes("pao") && nomeNorm.includes("fatia")) porcaoPadrao = 25;
  else if (nomeNorm.includes("salada") || nomeNorm.includes("folha")) porcaoPadrao = 100;
  else if (nomeNorm.includes("colher")) porcaoPadrao = 15;

  const nutr = produto.nutriments || {};
  return {
    calorias: Number(nutr.energy_kcal_100g || nutr.energy_kcal || (nutr.energy_100g ? nutr.energy_100g / 4.184 : 0) || 0),
    proteina: Number(nutr.proteins_100g || nutr.proteins || 0),
    carboidrato: Number(nutr.carbohydrates_100g || nutr.carbohydrates || 0),
    gordura: Number(nutr.fat_100g || nutr.fat || 0),
    fonteMacros: "Match via OpenFoodFacts API",
    porcaoPadrao,
    nomeUsado: produto.product_name || produto.generic_name || nomeEncontrado
  };
}

function evalNumber(val: any): number {
  const n = parseNumberSafe(val);
  return Number.isFinite(n) ? n : 0;
}

function normalizarEntradaLLM(alimento: any) {
  const out = { ...alimento };
  const nomeNorm = normalizarNome(out.nome || "");

  // normaliza 'quantidade'
  if (typeof out.quantidade === "number") {
    const hintRaw = String(out.unidade || out.porcaoUnitaria || "").toLowerCase();
    const hint = normalizarUnidade(hintRaw);
    if (hint === "g" || hint === "kg" || hint === "ml" || hint === "l") {
      out.quantidade = `${out.quantidade}${hint}`;
    } else {
      out.quantidade = `${out.quantidade} unidade`;
    }
  } else if (typeof out.quantidade === "string") {
    out.quantidade = out.quantidade.replace(",", ".").replace(/\s+/g, " ").trim();
  } else if (!out.quantidade) {
    out.quantidade = "1 unidade";
  }

  // se vier "porcaoUnitaria" textual da LLM, interpretamos:
  if (typeof out.porcaoUnitaria === "string") {
    const u = normalizarUnidade(out.porcaoUnitaria);
    if (u === "unidade") {
      if (typeof out.pesoEstimado === "number" && out.pesoEstimado > 0) {
        out.porcaoUnitaria = out.pesoEstimado;
      } else {
        // tenta peso por unidade conhecido; fallback seguro = 30g
        let pesoMedio = 0;
        for (const chave of Object.keys(pesoMedioPorUnidadeNorm)) {
          if (nomeNorm.includes(chave)) { pesoMedio = pesoMedioPorUnidadeNorm[chave]; break; }
        }
        out.porcaoUnitaria = pesoMedio || 30;
      }
    } else {
      // se não é "unidade", não forçamos nada aqui
      delete out.porcaoUnitaria;
    }
  }

  // se a LLM mandou pesoEstimado e a quantidade foi em "unidade/fatia/colher", guarda como porção unitária
  if (
    !out.porcaoUnitaria &&
    typeof out.pesoEstimado === "number" &&
    /(^|\W)(unidade|unidades|fatia|fatias|colher|colheres)(\W|$)/i.test(String(out.quantidade))
  ) {
    out.porcaoUnitaria = out.pesoEstimado;
  }

  return out;
}

function toGramas(alimento: any): { quantidade: string; valorQtd: number; unidade: string } {
  if (alimento._ml_total && alimento._ml_total > 0) {
    return { quantidade: `${alimento._ml_total} ml`, valorQtd: alimento._ml_total, unidade: "ml" };
  }

  const nomeNorm = normalizarNome(alimento.nome);
  const pq = parseQuantidade(alimento.quantidade ?? "");
  let unidadeCanon = normalizarUnidade(pq.unidade);
  let valor = pq.valor;

  const jsonInfo = buscarPorcaoJson(nomeNorm);
  const temFatia = nomeNorm.includes("fatia") || unidadeCanon === "fatia";
  const temPrato = nomeNorm.includes("prato") || unidadeCanon === "prato";
  const temColher = nomeNorm.includes("colher") || unidadeCanon === "colher";

  // porção unitária explícita (ex.: 10 unidades * 1.2 g por unidade)
  if (alimento.porcaoUnitaria && Number(alimento.porcaoUnitaria) > 0) {
    if (unidadeCanon === "unidade" || unidadeCanon === "fatia" || unidadeCanon === "") {
      const g = valor * Number(alimento.porcaoUnitaria);
      return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
    }
  }

  // usa portion_grams do JSON apenas quando a unidade NÃO for "unidade"/"fatia"
  if (jsonInfo?.portion_grams > 0) {
    if (unidadeCanon === "") {
      const g = valor * jsonInfo.portion_grams;
      return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
    }
  }

  if (temFatia && nomeNorm.includes("pao de forma")) {
    const g = valor * 25;
    return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
  }
  if (temPrato && (nomeNorm.includes("salada") || nomeNorm.includes("folha"))) {
    const g = valor * 100;
    return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
  }
  if (temColher) {
    const g = valor * 15;
    return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
  }

  // unidade/unidade vazia → tenta peso específico por item; fallback 30 g
  if (unidadeCanon === "unidade" || unidadeCanon === "") {
    let pesoMedio = 0;
    for (const chave of Object.keys(pesoMedioPorUnidadeNorm)) {
      if (nomeNorm.includes(chave)) { pesoMedio = pesoMedioPorUnidadeNorm[chave]; break; }
    }
    if (!pesoMedio) pesoMedio = 30;
    const g = valor * pesoMedio;
    return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
  }

  // copo/lata/xícara → converte para ml
  if (unidadeCanon === "copo" || unidadeCanon === "lata" || unidadeCanon === "xicara") {
    const bebidaMlMatch = String(alimento.quantidade || alimento.nome || "").match(
      /(\d+)[^\d]+(copo|lata|xicara)[^\d]*(\d+)\s*ml/i
    );
    if (bebidaMlMatch) {
      const qtd = parseInt(bebidaMlMatch[1], 10);
      const mlPor = parseInt(bebidaMlMatch[3], 10);
      if (qtd > 0 && mlPor > 0) {
        const ml = qtd * mlPor;
        return { quantidade: `${ml} ml`, valorQtd: ml, unidade: "ml" };
      }
    }
    if (unidadeCanon in unidadeParaGramasNorm) {
      const ml = valor * (unidadeParaGramasNorm[unidadeCanon] || unidadeParaGramasNorm["unidade"]);
      return { quantidade: `${ml} ml`, valorQtd: ml, unidade: "ml" };
    }
  }

  // ml / litro
  if (unidadeCanon === "ml" || unidadeCanon === "l") {
    const ml = unidadeCanon === "l" ? valor * 1000 : valor;
    return { quantidade: `${Math.round(ml * 10) / 10} ml`, valorQtd: ml, unidade: "ml" };
  }

  // outras medidas caseiras conhecidas → converte para g
  if (unidadeCanon !== "g") {
    if (unidadeCanon !== "unidade" && (unidadeCanon in unidadeParaGramasNorm)) {
      const g = valor * unidadeParaGramasNorm[unidadeCanon];
      return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
    } else if (unidadeCanon === "kg") {
      const g = valor * 1000;
      return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
    } else {
      const g = valor * 100;
      return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
    }
  }

  // já está em g
  const g = valor;
  return { quantidade: `${Math.round(g * 10) / 10} g`, valorQtd: g, unidade: "g" };
}

async function adicionarAlimentosFirestore(
  userEmail: string,
  alimentos: any[],
  diaPadrao: string
) {
  if (!Array.isArray(alimentos)) return;

  const TZ_OFFSET = "-03:00";

  function todayYMD_BRT(): string {
    const d = getBrasiliaDate();
    const y = d.getUTCFullYear();
    const m = pad2(d.getUTCMonth() + 1);
    const dd = pad2(d.getUTCDate());
    return `${y}-${m}-${dd}`;
  }
  function ymdAddDays(ymd: string, days: number): string {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }
  function toBrasilISO(ymd: string, h = 12, m = 0, s = 0): string {
    return `${ymd}T${pad2(h)}:${pad2(m)}:${pad2(s)}${TZ_OFFSET}`;
  }
  function parseDiaFromText(input?: string): string | null {
    if (!input) return null;
    const raw = stripAccents(String(input).trim().toLowerCase());

    if (raw.includes("ontem")) return ymdAddDays(todayYMD_BRT(), -1);
    if (raw.includes("hoje")) return todayYMD_BRT();
    if (raw.includes("amanha")) return ymdAddDays(todayYMD_BRT(), +1);

    const mIso = raw.match(/(\d{4}-\d{2}-\d{2})/);
    if (mIso) return mIso[1];

    const mBr = raw.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
    if (mBr) {
      const dd = pad2(Number(mBr[1]));
      const mm = pad2(Number(mBr[2]));
      const yyyy = mBr[3] ? String(Number(mBr[3])) : String(getBrasiliaDate().getUTCFullYear());
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }
  function parseHoraMin(str?: string): { h: number; m: number } | null {
    if (!str) return null;
    const m = String(str).match(/(^|\D)(\d{1,2}):(\d{2})(\D|$)/);
    if (!m) return null;
    const h = Number(m[2]), mi = Number(m[3]);
    if (h >= 0 && h < 24 && mi >= 0 && mi < 60) return { h, m: mi };
    return null;
  }
  function inferMealFromText(txt?: string): string | null {
    if (!txt) return null;
    const r = stripAccents(txt.toLowerCase());
    if (r.includes("lanche da manha") || r.includes("lanche da manhã")) return "lanche da manhã";
    if (r.includes("lanche da tarde")) return "lanche da tarde";
    if (r.includes("cafe da manha") || r.includes("café da manhã") || r.includes("cafe ")) return "café da manhã";
    if (r.includes("almoco") || r.includes("almoço")) return "almoço";
    if (r.includes("jantar")) return "jantar";
    if (r.includes("ceia") || r.includes("noite")) return "ceia";
    return null;
  }
  function defaultHourByMeal(ref: string): { h: number; m: number } {
    const r = stripAccents((ref || "").toLowerCase());
    if (r.includes("cafe")) return { h: 4,  m: 0 };
    if (r.includes("lanche da manha")) return { h: 10, m: 0 };
    if (r.includes("almoco")) return { h: 12, m: 0 };
    if (r.includes("lanche da tarde")) return { h: 16, m: 0 };
    if (r.includes("jantar")) return { h: 19, m: 0 };
    if (r.includes("ceia") || r.includes("noite") || r.includes("lanche da noite")) return { h: 21, m: 0 };
    return { h: 12, m: 0 };
  }
  function periodoPorHorario(horarioISO: string) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(horarioISO)) return "Indefinido";
    const h = Number(horarioISO.slice(11, 13));
    const mi = Number(horarioISO.slice(14, 16));
    const t = h * 60 + mi;
    if (t >= 240 && t < 600)   return "café da manhã";
    if (t >= 600 && t < 720)   return "lanche da manhã";
    if (t >= 720 && t < 900)   return "almoço";
    if (t >= 900 && t < 1140)  return "lanche da tarde";
    if (t >= 1140 && t < 1260) return "jantar";
    if (t >= 1260 || t < 240)  return "ceia";
    return "Indefinido";
  }
  function nowHM_BRT(): { h: number; m: number } {
    const d = getBrasiliaDate();
    return { h: d.getUTCHours(), m: d.getUTCMinutes() };
  }

  const diasUsados = new Set<string>();
  const diaFromUser = parseDiaFromText(diaPadrao);

  for (const _alimento of alimentos) {
    if (!_alimento || !_alimento.nome) continue;

    const alimento = normalizarEntradaLLM ? normalizarEntradaLLM(_alimento) : _alimento;

    try {
      // ---------- DIA / HORA ----------
      const diaRegistro = diaFromUser || todayYMD_BRT();
      const hmFromText = parseHoraMin(diaPadrao);
      const isPureTimeField = typeof alimento?.horario === "string" && /^\s*\d{1,2}:\d{2}\s*$/.test(alimento.horario);
      const hmFromField = isPureTimeField ? parseHoraMin(alimento.horario) : null;

      let hFromISO: number | null = null;
      let mFromISO: number | null = null;
      if (typeof alimento?.horario === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(alimento.horario)) {
        hFromISO = Number(alimento.horario.slice(11, 13));
        mFromISO = Number(alimento.horario.slice(14, 16));
        if (!(hFromISO >= 0 && hFromISO < 24 && mFromISO >= 0 && mFromISO < 60)) {
          hFromISO = mFromISO = null;
        }
      }

      const refeicaoFromItem = typeof alimento?.refeicao === "string" ? alimento.refeicao : "";
      const refeicaoFromText = inferMealFromText(diaPadrao) || "";
      const refeicaoRef = refeicaoFromItem || refeicaoFromText;

      const hFinal =
        hmFromText?.h ?? hmFromField?.h ?? hFromISO ?? (refeicaoRef ? defaultHourByMeal(refeicaoRef).h : nowHM_BRT().h);
      const mFinal =
        hmFromText?.m ?? hmFromField?.m ?? mFromISO ?? (refeicaoRef ? defaultHourByMeal(refeicaoRef).m : nowHM_BRT().m);

      const horarioFinal = toBrasilISO(diaRegistro, hFinal, mFinal);

      // ---------- QUANTIDADE (g/ml) ----------
      const gramasObj = toGramas(alimento);
      const unidadeCanon = gramasObj.unidade;

      // ---------- MACROS ----------
      const nomeNorm = normalizarNome(alimento.nome);
      let macros = {
        calorias: evalNumber(alimento.calorias),
        proteina: evalNumber(alimento.proteina),
        carboidrato: evalNumber(alimento.carboidrato),
        gordura: evalNumber(alimento.gordura),
        fonteMacros: alimento.fonteMacros || "",
      };
      let nomeUtilizado = alimento.nome;

      const macrosAusentes =
        (!macros.calorias && !macros.proteina && !macros.carboidrato && !macros.gordura) ||
        [macros.calorias, macros.proteina, macros.carboidrato, macros.gordura].some(
          (v) => typeof v !== "number" || isNaN(v as any)
        );

      if (macrosAusentes) {
        const br = buscarMacrosBr(nomeNorm);
        if (br) {
          const f = gramasObj.valorQtd / 100;
          macros = {
            calorias: Math.round(br.calorias * f * 10) / 10,
            proteina: Math.round(br.proteina * f * 10) / 10,
            carboidrato: Math.round(br.carboidrato * f * 10) / 10,
            gordura: Math.round(br.gordura * f * 10) / 10,
            fonteMacros: br.fonteMacros,
          };
          nomeUtilizado = alimento.nome;
        } else {
          const of = await buscarOpenFood(alimento.nome);
          if (of) {
            const f = gramasObj.valorQtd / 100;
            macros = {
              calorias: Math.round(of.calorias * f * 10) / 10,
              proteina: Math.round(of.proteina * f * 10) / 10,
              carboidrato: Math.round(of.carboidrato * f * 10) / 10,
              gordura: Math.round(of.gordura * f * 10) / 10,
              fonteMacros: of.fonteMacros,
            };
            nomeUtilizado = alimento.nome;
          }
        }
      }

      // ---------- ÁGUA (ml) ----------
      // ATENÇÃO: só somamos água se o item for "água" e a unidade final for ML (copo/xícara/lata -> ml já tratado em toGramas)
      const isAgua = ehAgua(alimento.nome);
      const aguaMlToAdd = (isAgua && unidadeCanon === "ml") ? Math.round(gramasObj.valorQtd) : 0;

      // ---------- FIRESTORE ----------
      const docId = alimentoDocId(normalizarNome(nomeUtilizado || alimento.nome), unidadeCanon);
      const itemRef = doc(db, "chatfit", userEmail, "refeicoes", diaRegistro, "historicoAlimentos", docId);
      const aguaRef = doc(db, "chatfit", userEmail, "agua", diaRegistro);

      await runTransaction(db, async (tx) => {
        // 🔹 LEITURAS PRIMEIRO (regra de transação do Firestore)
        const snap = await tx.get(itemRef);

        let prevAguaTotal = 0;
        if (aguaMlToAdd > 0) {
          const aguaSnap = await tx.get(aguaRef);
          prevAguaTotal = aguaSnap.exists ? (Number((aguaSnap.data() as any).totalMl) || 0) : 0;
        }

        // 🔹 ESCRITAS
        if (!snap.exists) {
          tx.set(itemRef, {
            nome: alimento.nome,
            nome_normalizado: normalizarNome(alimento.nome),
            unidade: unidadeCanon,
            quantidade: gramasObj.quantidade,
            calorias: Math.round((macros.calorias || 0) * 10) / 10,
            proteina: Math.round((macros.proteina || 0) * 10) / 10,
            carboidrato: Math.round((macros.carboidrato || 0) * 10) / 10,
            gordura: Math.round((macros.gordura || 0) * 10) / 10,
            horario: horarioFinal,
            criadoPor: userEmail,
            fonteMacros: macros.fonteMacros || "",
            nomeUtilizado,
            refeicao: periodoPorHorario(horarioFinal),
            dia: diaRegistro,
            // registra água por item (usado no resumo)
            agua: aguaMlToAdd || 0,
          });
        } else {
          const data = snap.data() as any;
          const qtdBanco = parseQuantidade(String(data.quantidade || "")).valor || 0;
          const novaQtd = (qtdBanco || 0) + (gramasObj.valorQtd || 0);
          const novaQtdStr = `${Math.round(novaQtd * 10) / 10} ${unidadeCanon}`;

          tx.update(itemRef, {
            quantidade: novaQtdStr,
            calorias: (evalNumber(data.calorias) || 0) + Math.round((macros.calorias || 0) * 10) / 10,
            proteina: (evalNumber(data.proteina) || 0) + Math.round((macros.proteina || 0) * 10) / 10,
            carboidrato: (evalNumber(data.carboidrato) || 0) + Math.round((macros.carboidrato || 0) * 10) / 10,
            gordura: (evalNumber(data.gordura) || 0) + Math.round((macros.gordura || 0) * 10) / 10,
            horario: horarioFinal,
            fonteMacros: macros.fonteMacros || "",
            nomeUtilizado,
            refeicao: periodoPorHorario(horarioFinal),
            dia: diaRegistro,
            // acumula água neste item
            agua: (evalNumber((data as any).agua) || 0) + (aguaMlToAdd || 0),
          });
        }

        if (aguaMlToAdd > 0) {
          tx.set(
            aguaRef,
            { totalMl: prevAguaTotal + aguaMlToAdd, updatedAt: getHorarioBrasilISO() },
            { merge: true }
          );
        }
      });

      console.log(
        `[REGISTRO] OK: ${nomeUtilizado} (${gramasObj.quantidade}) em ${diaRegistro} @ ${horarioFinal}` +
        (aguaMlToAdd ? ` | água +${aguaMlToAdd} ml` : "")
      );

      diasUsados.add(diaRegistro);
    } catch (err) {
      console.error(`[REGISTRO] Falha ao salvar alimento "${_alimento?.nome ?? "?"}":`, err);
    }
  }

  for (const dia of diasUsados) {
    await salvarResumoAcumulado(userEmail, dia);
  }
}

async function excluirAlimentosFirestore(userEmail: string, alimentos: any[], dia: string) {
  if (!Array.isArray(alimentos)) return;

  async function tryDeleteOrUpdateByUnit(
    nomeNorm: string,
    unidadeTentativa: string,
    originalAlimento: any
  ) {
    const itemRef = doc(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos", alimentoDocId(nomeNorm, unidadeTentativa));
    const aguaRef = doc(db, "chatfit", userEmail, "agua", dia);

    await runTransaction(db, async (tx) => {
      // 🔹 TODOS os reads primeiro
      const [snap, aguaSnap0] = await Promise.all([tx.get(itemRef), tx.get(aguaRef)]);
      if (!snap.exists) return;

      const data = snap.data() as any;
      const qtdBanco = parseQuantidade(String(data.quantidade || "")).valor || 0;
      const totalAguaItem = Number(data.agua) || 0;

      // calcula quanto remover
      let removeTudo = false;
      let qtdExcluir = 0;

      if (!originalAlimento.quantidade || originalAlimento.quantidade === "") {
        removeTudo = true;
      } else {
        const conv = toGramas({
          nome: originalAlimento.nome,
          quantidade: originalAlimento.quantidade,
          porcaoUnitaria: originalAlimento.porcaoUnitaria,
        });
        if (data.unidade === "ml" && conv.unidade === "g") {
          qtdExcluir = conv.valorQtd;
        } else if (data.unidade === "g" && conv.unidade === "ml") {
          qtdExcluir = conv.valorQtd;
        } else {
          qtdExcluir = conv.valorQtd || 0;
        }
        if (qtdExcluir >= qtdBanco) removeTudo = true;
      }

      const prevAguaDia = aguaSnap0.exists ? (Number((aguaSnap0.data() as any).totalMl) || 0) : 0;

      if (removeTudo || qtdBanco <= 0) {
        // 🔸 writes depois dos reads
        if (totalAguaItem > 0) {
          tx.set(aguaRef, { totalMl: Math.max(prevAguaDia - totalAguaItem, 0), updatedAt: getHorarioBrasilISO() }, { merge: true });
        }
        tx.delete(itemRef);
        return;
      }

      // parcial
      const novaQtd = Math.max(qtdBanco - qtdExcluir, 0);
      const fator = qtdBanco > 0 ? novaQtd / qtdBanco : 0;
      const novaQtdStr = `${Math.round(novaQtd * 10) / 10} ${data.unidade}`;

      const c = evalNumber(data.calorias) || 0;
      const p = evalNumber(data.proteina) || 0;
      const cb = evalNumber(data.carboidrato) || 0;
      const g = evalNumber(data.gordura) || 0;
      const a = evalNumber(data.agua) || 0;

      const novoAgua = Math.round((a * fator) * 10) / 10;
      const deltaAgua = a - novoAgua; // quanto abater do doc diário

      // 🔸 writes depois dos reads
      tx.update(itemRef, {
        quantidade: novaQtdStr,
        calorias: c * fator,
        proteina: p * fator,
        carboidrato: cb * fator,
        gordura: g * fator,
        agua: novoAgua,
      });

      if (deltaAgua > 0) {
        tx.set(aguaRef, { totalMl: Math.max(prevAguaDia - deltaAgua, 0), updatedAt: getHorarioBrasilISO() }, { merge: true });
      }
    });
  }

  for (const alimento of alimentos) {
    if (!alimento || !alimento.nome) continue;
    try {
      const nomeNorm = normalizarNome(alimento.nome);
      const unidadeCanon = alimento.unidade ? normalizarUnidade(alimento.unidade) : "";
      if (unidadeCanon) {
        await tryDeleteOrUpdateByUnit(nomeNorm, unidadeCanon, alimento);
      } else {
        await tryDeleteOrUpdateByUnit(nomeNorm, "g", alimento);
        await tryDeleteOrUpdateByUnit(nomeNorm, "ml", alimento);
      }
    } catch (err) {
      console.error(`[EXCLUSAO] Falha ao excluir alimento "${alimento?.nome ?? "?"}":`, err);
    }
  }

  await salvarResumoAcumulado(userEmail, dia);
}

async function substituirAlimentosFirestore(userEmail: string, substituicoes: any[], dia: string) {
  if (!Array.isArray(substituicoes)) return null;

  let multiMatchMsg = null;

  for (const sub of substituicoes) {
    if (!sub.de || !sub.de.nome) continue;

    const nomeNormAlvo = normalizarNome(sub.de.nome);
    const historicoRef = collection(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos");
    const snap = await getDocs(historicoRef);

    const candidatos = snap.docs.filter(docu => {
      const d = docu.data();
      const nomeDoc = normalizarNome(d.nome || "");
      return (
        nomeDoc === nomeNormAlvo ||
        nomeDoc.includes(nomeNormAlvo) ||
        nomeNormAlvo.includes(nomeDoc)
      );
    });

    if (candidatos.length === 0) {
      if (sub.para && sub.para.nome) {
        await adicionarAlimentosFirestore(userEmail, [sub.para], dia);
      }
      continue;
    }

    if (candidatos.length > 1) {
      const nomesEncontrados = candidatos.map(docu => docu.data().nome).join(", ");
      multiMatchMsg = `Foram encontrados múltiplos alimentos similares a '${sub.de.nome}': ${nomesEncontrados}. Por favor, especifique qual deles você deseja substituir.`;
      continue;
    }

    await deleteDoc(candidatos[0].ref);

    if (sub.para && sub.para.nome) {
      await adicionarAlimentosFirestore(userEmail, [sub.para], dia);
    }
  }

  return multiMatchMsg;
}

async function salvarResumoAcumulado(userEmail: string, dia: string) {
  try {
    const historicoRef = collection(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos");
    const snap = await getDocs(historicoRef);
    let total = {
      calorias: 0, proteina: 0, carboidrato: 0, gordura: 0, agua: 0, acucar: 0, sodio: 0, cafeina: 0
    };
    snap.forEach(doc => {
      const d = doc.data() as any;
      total.calorias += Number(d.calorias) || 0;
      total.proteina += Number(d.proteina) || 0;
      total.carboidrato += Number(d.carboidrato) || 0;
      total.gordura += Number(d.gordura) || 0;
      total.agua += Number(d.agua) || 0;
      total.acucar += Number(d.acucar) || 0;
      total.sodio += Number(d.sodio) || 0;
      total.cafeina += Number(d.cafeina) || 0;
    });
    const resumoRef = doc(db, "chatfit", userEmail, "refeicoes", dia, "resumo", "acumulado");
    await setDoc(resumoRef, total, { merge: true });
  } catch (err) {
    console.error("[RESUMO] Falha ao salvar resumo/acumulado:", err);
  }
}

// --------- Exercícios -----------
async function adicionarExerciciosFirestore(userEmail: string, exercicios: any[], dia: string) {
  if (!Array.isArray(exercicios) || !exercicios.length) return;
  try {
    const docRef = doc(db, "chatfit", userEmail, "exerciciosDoDia", dia);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      let lista: any[] = [];
      if (snap.exists) {
        lista = Array.isArray(snap.data().exercicios) ? [...snap.data().exercicios] : [];
      }
      lista.push(...exercicios);
      tx.set(docRef, { exercicios: lista }, { merge: true });
    });
  } catch (err) {
    console.error("[EXERCICIO] Falha ao adicionar exercícios:", err);
  }
}

async function excluirExerciciosFirestore(userEmail: string, exercicios: any[], dia: string) {
  if (!Array.isArray(exercicios) || !exercicios.length) return;

  // Helpers locais
  const tipoKey = (s: string) => stripAccents((s || "").toLowerCase().trim());
  const round1 = (n: number) => Math.round(n * 10) / 10;

  function subtrairPorMinutos(lista: any[], tipoNorm: string, minutosAlvo: number, horario?: string) {
    let restante = Math.max(0, minutosAlvo || 0);
    if (!restante) return { lista, restante };

    for (let i = 0; i < lista.length && restante > 0; i++) {
      const e = lista[i];
      if (!e || tipoKey(e.tipo) !== tipoNorm) continue;
      if (horario && e.horario && e.horario !== horario) continue;

      const dur = extrairMinutos(String(e.duracao || ""));
      if (dur <= 0) continue;

      const delta = Math.min(dur, restante);
      const novoDur = dur - delta;

      // ajusta calorias proporcionalmente, se houver
      if (typeof e.calorias === "number" && dur > 0) {
        e.calorias = round1((e.calorias || 0) * (novoDur / dur));
      }

      if (novoDur <= 0) {
        // remove a entrada
        lista[i] = null;
      } else {
        e.duracao = formatarDuracaoMinutos(novoDur);
      }

      restante -= delta;
    }

    const filtrada = (lista.filter(Boolean) as any[]);
    return { lista: filtrada, restante };
  }

  function subtrairPorCalorias(lista: any[], tipoNorm: string, kcalAlvo: number, horario?: string) {
    let restante = Math.max(0, kcalAlvo || 0);
    if (!restante) return { lista, restante };

    for (let i = 0; i < lista.length && restante > 0; i++) {
      const e = lista[i];
      if (!e || tipoKey(e.tipo) !== tipoNorm) continue;
      if (horario && e.horario && e.horario !== horario) continue;

      const kcal = Number(e.calorias || 0);
      if (kcal <= 0) continue;

      const delta = Math.min(kcal, restante);
      const novaKcal = kcal - delta;

      // se tiver duração, ajusta proporcionalmente
      const dur = extrairMinutos(String(e.duracao || ""));
      if (dur > 0) {
        const novoDur = (novaKcal <= 0) ? 0 : Math.max(0, Math.round((dur * novaKcal) / kcal));
        e.duracao = formatarDuracaoMinutos(novoDur);
      }

      if (novaKcal <= 0) {
        lista[i] = null;
      } else {
        e.calorias = round1(novaKcal);
      }

      restante -= delta;
    }

    const filtrada = (lista.filter(Boolean) as any[]);
    return { lista: filtrada, restante };
  }

  try {
    const docRef = doc(db, "chatfit", userEmail, "exerciciosDoDia", dia);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;

      let lista: any[] = Array.isArray(snap.data().exercicios) ? [...snap.data().exercicios] : [];

      for (const ex of exercicios) {
        const tipoNorm = tipoKey(ex?.tipo || "");
        if (!tipoNorm) continue;

        const hasDur = typeof ex?.duracao === "string" && extrairMinutos(ex.duracao) > 0;
        const hasKcal = typeof ex?.calorias === "number" && ex.calorias > 0;
        const horario = typeof ex?.horario === "string" ? ex.horario : undefined;

        if (hasDur) {
          const minutosAlvo = extrairMinutos(ex.duracao);
          const r = subtrairPorMinutos(lista, tipoNorm, minutosAlvo, horario);
          lista = r.lista;
          // se sobrar "restante", ignoramos (não há mais do que subtrair)
          continue;
        }

        if (hasKcal) {
          const r = subtrairPorCalorias(lista, tipoNorm, ex.calorias, horario);
          lista = r.lista;
          continue;
        }

        // Sem duração nem kcal → exclusão total do tipo (ou do horário específico, se passado)
        lista = lista.filter((e) => {
          if (!e || tipoKey(e.tipo) !== tipoNorm) return true;
          if (horario && e.horario && e.horario !== horario) return true;
          return false; // remove
        });
      }

      tx.set(docRef, { exercicios: lista }, { merge: true });
    });
  } catch (err) {
    console.error("[EXERCICIO] Falha ao excluir exercícios (robusto):", err);
  }
}

async function excluirParcialExerciciosFirestore(userEmail: string, exercicios: any[], dia: string) {
  if (!Array.isArray(exercicios) || !exercicios.length) return;

  const tipoKey = (s: string) => stripAccents((s || "").toLowerCase().trim());
  const round1 = (n: number) => Math.round(n * 10) / 10;

  function subtrairPorMinutos(lista: any[], tipoNorm: string, minutosAlvo: number, horario?: string) {
    let restante = Math.max(0, minutosAlvo || 0);
    if (!restante) return { lista, restante };

    for (let i = 0; i < lista.length && restante > 0; i++) {
      const e = lista[i];
      if (!e || tipoKey(e.tipo) !== tipoNorm) continue;
      if (horario && e.horario && e.horario !== horario) continue;

      const dur = extrairMinutos(String(e.duracao || ""));
      if (dur <= 0) continue;

      const delta = Math.min(dur, restante);
      const novoDur = dur - delta;

      if (typeof e.calorias === "number" && dur > 0) {
        e.calorias = round1((e.calorias || 0) * (novoDur / dur));
      }

      if (novoDur <= 0) {
        lista[i] = null;
      } else {
        e.duracao = formatarDuracaoMinutos(novoDur);
      }

      restante -= delta;
    }

    return { lista: (lista.filter(Boolean) as any[]), restante };
  }

  function subtrairPorCalorias(lista: any[], tipoNorm: string, kcalAlvo: number, horario?: string) {
    let restante = Math.max(0, kcalAlvo || 0);
    if (!restante) return { lista, restante };

    for (let i = 0; i < lista.length && restante > 0; i++) {
      const e = lista[i];
      if (!e || tipoKey(e.tipo) !== tipoNorm) continue;
      if (horario && e.horario && e.horario !== horario) continue;

      const kcal = Number(e.calorias || 0);
      if (kcal <= 0) continue;

      const delta = Math.min(kcal, restante);
      const novaKcal = kcal - delta;

      const dur = extrairMinutos(String(e.duracao || ""));
      if (dur > 0) {
        const novoDur = (novaKcal <= 0) ? 0 : Math.max(0, Math.round((dur * novaKcal) / kcal));
        e.duracao = formatarDuracaoMinutos(novoDur);
      }

      if (novaKcal <= 0) {
        lista[i] = null;
      } else {
        e.calorias = round1(novaKcal);
      }

      restante -= delta;
    }

    return { lista: (lista.filter(Boolean) as any[]), restante };
  }

  try {
    const docRef = doc(db, "chatfit", userEmail, "exerciciosDoDia", dia);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;

      let lista: any[] = Array.isArray(snap.data().exercicios) ? [...snap.data().exercicios] : [];

      for (const ex of exercicios) {
        const tipoNorm = tipoKey(ex?.tipo || "");
        if (!tipoNorm) continue;

        const hasDur = typeof ex?.duracao === "string" && extrairMinutos(ex.duracao) > 0;
        const hasKcal = typeof ex?.calorias === "number" && ex.calorias > 0;
        const horario = typeof ex?.horario === "string" ? ex.horario : undefined;

        if (hasDur) {
          const minutosAlvo = extrairMinutos(ex.duracao);
          const r = subtrairPorMinutos(lista, tipoNorm, minutosAlvo, horario);
          lista = r.lista;
          continue;
        }

        if (hasKcal) {
          const r = subtrairPorCalorias(lista, tipoNorm, ex.calorias, horario);
          lista = r.lista;
          continue;
        }

        // Se cair aqui sem duração nem kcal, não faz nada (parcial exige magnitude)
      }

      tx.set(docRef, { exercicios: lista }, { merge: true });
    });
  } catch (err) {
    console.error("[EXERCICIO] Falha ao excluir parcialmente exercícios (robusto):", err);
  }
}

function extrairMinutos(duracao: string): number {
  if (!duracao) return 0;
  let min = 0;
  const horaMatch = duracao.match(/(\d+)\s*h/);
  if (horaMatch) min += parseInt(horaMatch[1], 10) * 60;
  const minMatch = duracao.match(/(\d+)\s*min/);
  if (minMatch) min += parseInt(minMatch[1], 10);
  return min;
}

function formatarDuracaoMinutos(min: number): string {
  if (min <= 0) return "0min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  let str = "";
  if (h) str += `${h}h`;
  if (m) str += `${m}min`;
  return str || "0min";
}

async function substituirExerciciosFirestore(userEmail: string, substituicoes: any[], dia: string) {
  for (const sub of substituicoes) {
    if (!sub.de || !sub.para) continue;
    await excluirExerciciosFirestore(userEmail, [sub.de], dia);
    await adicionarExerciciosFirestore(userEmail, [sub.para], dia);
  }
}

function guessDomainSimple(text: string, hasImage?: boolean): "food" | "exercise" {
  if (hasImage) return "food"; // imagem → prato/alimento

  const t = (text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // palavras de comida
  if (/\b(alimento|comi|comida|lanche|refeic(a|ç)ao|calorias|macro|almoco|jantar|cafe|ceia)\b/.test(t))
    return "food";

  // exercícios (verbos + esportes + pistas de tempo)
  const hasExerciseVerb =
    /\b(exercicio|exercicios|treino|treinar|musculacao|corri|correr|corrida|pedalei|pedalar|caminhei|caminhar|caminhada|nadei|nadar|natacao|remada|eliptico|esteira|agachamento|supino|abd(o|ô)minal|prancha|yoga|pilates|hiit|hit)\b/.test(t);
  const hasSport =
    /\b(tenis|t[eê]nis|futebol|basquete|volei|bicicleta|bike|spinning|corrida)\b/.test(t);
  const hasTimeUnits = /\b\d+\s?(min|mins|minutos|km|kcal|h|hr|hora|horas)\b/.test(t);

  if (hasExerciseVerb || hasSport || (hasTimeUnits && /\b(corr|bike|bicic|caminh|nada|exerc|trein)\w*/.test(t)))
    return "exercise";

  return "food";
}

// --------- PARSER GPT -----------
async function parseMacros(rawText: string) {
  // Remove cercas de código ```json ... ```
  let text = rawText;
  text = text.replace(/```(?:json)?([\s\S]*?)```/gi, (_m, p1) => p1.trim());

  try {
    // Caso seja um objeto JSON
    if (/^\s*{/.test(text)) {
      const obj = JSON.parse(text);

      // Heurísticas de normalização:
      // - Se vierem pares {de, para} dentro de "alimentos" => mover para "alimentos_a_substituir"
      if (Array.isArray(obj.alimentos) && obj.alimentos.length > 0 && obj.alimentos[0]?.de && obj.alimentos[0]?.para) {
        obj.alimentos_a_substituir = obj.alimentos;
        obj.alimentos = [];
      }
      // - Se vierem alimentos e a reply sugerir remoção => mover para "alimentos_a_excluir"
      if (Array.isArray(obj.alimentos) && obj.alimentos.length > 0 && obj.alimentos[0]?.nome && typeof obj.reply === "string" && obj.reply.toLowerCase().includes("removid")) {
        obj.alimentos_a_excluir = obj.alimentos;
        obj.alimentos = [];
      }
      // - Se vierem alimentos e a reply sugerir "saldo" (remoção parcial) => mover para "alimentos_a_subtrair"
      if (Array.isArray(obj.alimentos) && obj.alimentos.length > 0 && obj.alimentos[0]?.nome && typeof obj.reply === "string" && obj.reply.toLowerCase().includes("saldo")) {
        obj.alimentos_a_subtrair = obj.alimentos;
        obj.alimentos = [];
      }

      // Exercícios: mesmas heurísticas
      if (Array.isArray(obj.exercicios) && obj.exercicios.length > 0 && obj.exercicios[0]?.de && obj.exercicios[0]?.para) {
        obj.exercicios_a_substituir = obj.exercicios;
        obj.exercicios = [];
      }
      if (Array.isArray(obj.exercicios) && obj.exercicios.length > 0 && obj.exercicios[0]?.tipo && typeof obj.reply === "string" && obj.reply.toLowerCase().includes("removid")) {
        obj.exercicios_a_excluir = obj.exercicios;
        obj.exercicios = [];
      }
      if (Array.isArray(obj.exercicios) && obj.exercicios.length > 0 && obj.exercicios[0]?.tipo && typeof obj.reply === "string" && obj.reply.toLowerCase().includes("saldo")) {
        obj.exercicios_a_subtrair = obj.exercicios;
        obj.exercicios = [];
      }
      return obj;
    }

    // Caso seja um array JSON (lista de alimentos simples)
    if (/^\s*\[/.test(text)) {
      return { alimentos: JSON.parse(text), reply: "" };
    }
  } catch (err) {
    console.log("[PARSE] Falha ao parsear resposta da LLM!", err, rawText);
  }
  // Fallback: trate tudo como reply textual
  return { reply: text };
}

function buildOpenAIMessages({
  systemPrompt,
  messages,
  imageBase64,
}: {
  systemPrompt: string;
  messages: any[];
  imageBase64?: string;
}) {
  // Suporte a entrada multimodal (imagem inline em base64/data URL)
  if (imageBase64) {
    return [
      { role: "system", content: systemPrompt },
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Analise a imagem de alimentos e identifique todos os itens e porções. " +
              "Responda EXCLUSIVAMENTE em JSON conforme instruções do sistema.",
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" },
          },
        ],
      },
    ];
  }
  return [{ role: "system", content: systemPrompt }, ...messages];
}

function buildUnifiedMessages(messages: any[], imageBase64?: string) {
  // sempre usa o prompt unificado; se houver imagem, ela entra como multimodal
  return buildOpenAIMessages({
    systemPrompt: UNIFIED_LOGGER_PROMPT,
    messages: getLastRelevantMessages(messages, 3),
    imageBase64,
  });
}

function getLastRelevantMessages(messages: any[], n = 3) {
  // Mantém apenas últimas trocas user/assistant para dar contexto sem poluir
  const filtered = (Array.isArray(messages) ? messages : []).filter(
    (msg) => msg && (msg.role === "user" || msg.role === "assistant")
  );
  return filtered.slice(-n * 2);
}

async function extractUserEmailFromRequest(
  req: NextRequest,
  fallbackEmail?: string | null
): Promise<string | null> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = await getAuth().verifyIdToken(token);
      if (decoded?.email) return decoded.email;
    } catch (e) {
      console.error("[AUTH] Falha ao verificar ID token do Firebase:", e);
      // cai para fallback
    }
  }

  return fallbackEmail ?? null;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Lê corpo (JSON ou multipart) normalmente
    let body: any = {};
    let isMultipart = false;

    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      isMultipart = true;
      const formData = await req.formData();

      body.userEmail = formData.get("userEmail") as string;

      const messagesStr = formData.get("messages");
      body.messages = typeof messagesStr === "string" ? JSON.parse(messagesStr) : [];

      const imageFile: any = formData.get("image");
      if (imageFile) {
        if (typeof imageFile === "object" && "arrayBuffer" in imageFile) {
          try {
            const buffer = Buffer.from(await imageFile.arrayBuffer());
            const contentType = imageFile.type || "image/jpeg";
            body.imageBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
          } catch (e) {
            console.error("Erro ao processar arquivo de imagem:", e);
          }
        } else if (typeof imageFile === "string" && imageFile.startsWith("data:image/")) {
          body.imageBase64 = imageFile;
        }
      }
    } else {
      body = await req.json();
    }

    const { messages, imageBase64 } = body;

    // 2) Resolve userEmail prioritariamente pelo ID token Firebase
    let userEmail: string | null = null;

    // 2a) Lê Authorization: Bearer <token>
    const authHeader =
      req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const idToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

    if (idToken) {
      try {
        // Tenta verificar token via firebase-admin/auth
        const { getAuth } = await import("firebase-admin/auth");
        const decoded = await getAuth().verifyIdToken(idToken);
        userEmail = decoded?.email ?? null;
      } catch (err) {
        console.warn(
          "[AUTH] Falha ao verificar ID token com firebase-admin/auth. " +
            "Prosseguindo com fallback body.userEmail, se houver.",
          err
        );
      }
    }

    // 2b) Fallback p/ body.userEmail (ex.: scripts de teste)
    if (!userEmail && typeof body.userEmail === "string" && body.userEmail.includes("@")) {
      userEmail = body.userEmail;
    }

    // 2c) Se ainda não temos e-mail, não dá pra salvar nada com segurança
    if (!userEmail) {
      console.error(
        "[AUTH] Requisição sem usuário autenticado. Nenhum alimento/exercício será salvo."
      );
      return NextResponse.json(
        {
          error:
            "Usuário não autenticado. Inclua Authorization: Bearer <ID_TOKEN> ou envie userEmail no body para ambiente de testes.",
        },
        { status: 401 }
      );
    }

    // 3) Chave da OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing." }, { status: 500 });
    }

    // 4) Extrai último input do usuário (texto) — útil p/ diaPadrao
    let userInput = "";
    if (Array.isArray(messages) && messages.length) {
      const last = messages[messages.length - 1]?.content;
      if (typeof last === "string") userInput = last;
      else if (last && typeof (last as any)?.text === "string") userInput = (last as any).text;
    }

    // 5) Monta mensagens p/ OpenAI **usando o prompt oficial**
    const openAIMessages = buildUnifiedMessages(messages, imageBase64);

    // 6) Chama OpenAI (json strict)
    let data: any = null;
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
          temperature: 0.2,
          top_p: 0.95,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Erro na resposta da OpenAI:", errText);
        return NextResponse.json(
          { error: "Erro ao conectar com a IA (OpenAI). " + errText },
          { status: 500 }
        );
      }

      data = await response.json();
    } catch (err: any) {
      console.error("Erro na comunicação com OpenAI:", err);
      return NextResponse.json(
        { error: "Erro ao conectar com a IA (fetch). " + (err?.message || "") },
        { status: 500 }
      );
    }

    if (data?.error) {
      console.error("Erro retornado pela OpenAI:", data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const replyRaw = data?.choices?.[0]?.message?.content ?? "";
    if (imageBase64) {
      console.log("[IMAGE] Resposta crua da LLM:", String(replyRaw).slice(0, 200) + "...");
    }

    // 7) Interpreta JSON
    const macros = await parseMacros(replyRaw);
    const diaHoje = getDiaAtual();

    // 8) Garante reply amigável
    if (!macros.reply && replyRaw) {
      macros.reply = replyRaw;
    } else if (!macros.reply && !replyRaw) {
      macros.reply = imageBase64
        ? "Analisei sua imagem e registrei os alimentos identificados."
        : "Entendido! Registrei seus alimentos.";
    }

    // 9) Executa ações no Firestore
    let multiMatchMsg: string | null = null;

    const diaPadraoParaAdicionar = String(
      userInput || (macros as any).diaPadrao || (macros as any).dia || ""
    );

    try {
      if (Array.isArray(macros.alimentos) && macros.alimentos.length) {
        await adicionarAlimentosFirestore(userEmail, macros.alimentos, diaPadraoParaAdicionar);
      } else {
        if (Array.isArray(macros.alimentos)) {
          console.log(
            "[SAVE] Nenhum alimento para adicionar. Itens:", macros.alimentos.length
          );
        }
      }

      if (Array.isArray(macros.alimentos_a_subtrair) && macros.alimentos_a_subtrair.length) {
        await excluirAlimentosFirestore(userEmail, macros.alimentos_a_subtrair, diaHoje);
      }

      if (Array.isArray(macros.alimentos_a_excluir) && macros.alimentos_a_excluir.length) {
        await excluirAlimentosFirestore(userEmail, macros.alimentos_a_excluir, diaHoje);
      }

      if (Array.isArray(macros.alimentos_a_substituir) && macros.alimentos_a_substituir.length) {
        multiMatchMsg = await substituirAlimentosFirestore(
          userEmail,
          macros.alimentos_a_substituir,
          diaHoje
        );
      }

      if (Array.isArray(macros.exercicios) && macros.exercicios.length) {
        await adicionarExerciciosFirestore(userEmail, macros.exercicios, diaHoje);
      }

      if (Array.isArray(macros.exercicios_a_excluir) && macros.exercicios_a_excluir.length) {
        await excluirExerciciosFirestore(userEmail, macros.exercicios_a_excluir, diaHoje);
      }

      if (Array.isArray(macros.exercicios_a_subtrair) && macros.exercicios_a_subtrair.length) {
        await excluirParcialExerciciosFirestore(userEmail, macros.exercicios_a_subtrair, diaHoje);
      }

      if (Array.isArray(macros.exercicios_a_substituir) && macros.exercicios_a_substituir.length) {
        await substituirExerciciosFirestore(userEmail, macros.exercicios_a_substituir, diaHoje);
      }
    } catch (saveErr) {
      console.error("[SAVE] Falha durante operações de persistência:", saveErr);
    }

    // 10) Se houve ambiguidade em substituição
    if (multiMatchMsg) {
      return NextResponse.json(
        {
          reply: multiMatchMsg,
          alimentos_lancados: [],
          alimentos_excluidos: [],
          alimentos_substituidos: [],
          alimentos: [],
          exercicios: [],
          tinha_imagem: !!imageBase64,
        },
        { status: 200 }
      );
    }

    // 11) Resposta OK
    return NextResponse.json({
      reply: macros.reply || replyRaw,
      alimentos_lancados:
        macros.alimentos?.map((a: any) => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ?? [],
      alimentos_excluidos: [
        ...(macros.alimentos_a_subtrair?.map((a: any) => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ??
          []),
        ...(macros.alimentos_a_excluir?.map((a: any) => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ??
          []),
      ],
      alimentos_substituidos:
        macros.alimentos_a_substituir?.map((sub: any) => {
          return {
            de: `${sub.de?.nome ?? ""} (${sub.de?.quantidade ?? ""})`,
            para: `${sub.para?.nome ?? ""} (${sub.para?.quantidade ?? ""})`,
          };
        }) ?? [],
      alimentos: macros.alimentos ?? [],
      exercicios: macros.exercicios ?? [],
      tinha_imagem: !!imageBase64,
    });
  } catch (err: any) {
    console.error("Erro inesperado no servidor:", err);
    return NextResponse.json(
      {
        error: "Erro inesperado no servidor: " + (err?.message || ""),
        reply:
          "Ocorreu um erro inesperado no servidor. Tente novamente ou contate o suporte.",
        alimentos_lancados: [],
        alimentos_excluidos: [],
        alimentos_substituidos: [],
        alimentos: [],
        exercicios: [],
        tinha_imagem: false,
      },
      { status: 500 }
    );
  }
}
