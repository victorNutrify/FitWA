// src/lib/nutrition-utils.ts
import alimentosBr, { AlimentoBR } from "@/lib/data/alimentos";
import { stripAccents, toDocId } from "@/lib/sanitize";

// ---------- Normalização & helpers ----------
export function normalizarNome(nome: string) {
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

export function normalizarUnidade(u: string) {
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

export function parseQuantidade(qtd: string | number) {
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

export function alimentoDocId(nomeNorm: string, unidadeCanon: string) {
  // Usa toDocId para garantir compatibilidade com Firestore (sem "/")
  const nomeId = toDocId(nomeNorm || "sem");
  const uniId  = toDocId(unidadeCanon || "sem");
  return `${nomeId}__${uniId}`;
}

// src/lib/nutrition-utils.ts
export function evalNumber(val: any): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    // normaliza vírgula para ponto e remove espaços
    const clean = val.replace(/,/g, ".").trim();
    // apenas números simples (ex: "120", "45.6")
    if (/^-?\d+(\.\d+)?$/.test(clean)) {
      const n = parseFloat(clean);
      return Number.isFinite(n) ? n : 0;
    }
  }
  return 0;
}
console.log(evalNumber(123));        // 123
console.log(evalNumber("123"));      // 123
console.log(evalNumber("45,6"));     // 45.6
console.log(evalNumber("45.6"));     // 45.6
console.log(evalNumber("abc"));      // 0
console.log(evalNumber("1+2"));      // 0
// ---------- Mapas de porções ----------
export const pesoMedioPorUnidade: Record<string, number> = {
  melancia: 5000, melao: 1500, maçã: 130, maca: 130, laranja: 150, banana: 120,
  "pão francês": 50, "pao frances": 50, pao: 50, pao_frances: 50, "bife de carne": 120,
  bife: 120, frango: 120, ovo: 50, pera: 160, manga: 300, abacaxi: 1400, tomate: 110, cenoura: 70, batata: 90,
  abacate: 200,
  sushi: 30, temaki: 120, nigiri: 25, sashimi: 15,
  biscoito: 6, bolacha: 7, cookie: 15, bombom: 20, chocolate: 25,
  pastel: 80, coxinha: 70, quibe: 90, empada: 60,
  "pão de forma": 25, "pao de forma": 25, "fatia de pão": 25, "fatia de pao": 25, "fatia": 25,
  "colher de geleia": 15, "colher de sopa": 15, "colher": 15,
  "prato de salada": 100, "salada": 100, "salada verde": 100, "folhas": 30,
  "prato": 300, "porção": 100, "porcao": 100, "tigela": 250, "bowl": 250
};

const pesoMedioPorUnidadeNorm: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(pesoMedioPorUnidade)) out[normalizarNome(k)] = pesoMedioPorUnidade[k];
  return out;
})();

export const unidadeParaGramas: Record<string, number> = {
  ovo: 50, banana: 120, maçã: 130, maca: 130, pão: 50, pao: 50, frango: 120, arroz: 100, linguiça: 80, linguica: 80,
  couve: 50, farofa: 30, purê: 60, pure: 60, carne: 100, peixe: 100, unidade: 100, xicara: 120,
  colher: 15, bife: 120, pato: 300, copo: 200, lata: 350, ml: 1,
  sushi: 30, temaki: 120, nigiri: 25, sashimi: 15, biscoito: 6, bolacha: 7, cookie: 15,
  pedaço: 70, pedaco: 70, porção: 100, porcao: 100, prato: 300, tigela: 250, bowl: 250,
  fatia: 25, "fatia de pão": 25, "fatia de pao": 25, "fatia de pão de forma": 25, "fatia de pao de forma": 25
};

const unidadeParaGramasNorm: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const k of Object.keys(unidadeParaGramas)) out[normalizarUnidade(k)] = unidadeParaGramas[k];
  return out;
})();

// ---------- Busca por porção/macro no JSON ----------
export function buscarPorcaoJson(nomeNorm: string): AlimentoBR | null {
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

export function buscarMacrosBr(nomeNorm: string) {
  const alimento = buscarPorcaoJson(nomeNorm);
  if (alimento) {
    const nutr = alimento.nutriments || {};
    const porcao = alimento.portion_grams || 100;
    return {
      calorias: Number(nutr.calories || 0) * (100 / porcao),
      proteina: Number(nutr.protein_g || 0) * (100 / porcao),
      carboidrato: Number(nutr.carbs_g || 0) * (100 / porcao),
      gordura: Number(nutr.fat_g || 0) * (100 / porcao),
      fonteMacros: "Match via alimentos_br.json",
      porcaoPadrao: porcao,
      nomeUsado: alimento.name || alimento.nome || "",
    };
  }
  return null;
}

export async function buscarOpenFood(alimentoNome: string) {
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
      const matches = partes.filter((p: string) => partesProduto.includes(p)).length;
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

export function extrairMacrosOpenFood(produto: any, nomeNorm: string, nomeEncontrado: string) {
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

// ---------- Normalização de entrada LLM ----------
export function normalizarEntradaLLM(alimento: any) {
  const out = { ...alimento };
  const nomeNorm = normalizarNome(out.nome || "");

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

  if (typeof out.porcaoUnitaria === "string") {
    const u = normalizarUnidade(out.porcaoUnitaria);
    if (u === "unidade") {
      if (typeof out.pesoEstimado === "number" && out.pesoEstimado > 0) {
        out.porcaoUnitaria = out.pesoEstimado;
      } else {
        let pesoMedio = 100;
        for (const chave of Object.keys(pesoMedioPorUnidadeNorm)) {
          if (nomeNorm.includes(chave)) { pesoMedio = pesoMedioPorUnidadeNorm[chave]; break; }
        }
        out.porcaoUnitaria = pesoMedio;
      }
    } else {
      delete out.porcaoUnitaria;
    }
  }

  if (!out.porcaoUnitaria &&
      typeof out.pesoEstimado === "number" &&
      /unidade|unidades/.test(String(out.quantidade))) {
    out.porcaoUnitaria = out.pesoEstimado;
  }

  return out;
}

// ---------- Conversão para gramas/ml ----------
export function toGramas(alimento: any): { quantidade: string, valorQtd: number, unidade: string } {
  if (alimento._ml_total && alimento._ml_total > 0) {
    return { quantidade: `${alimento._ml_total} ml`, valorQtd: alimento._ml_total, unidade: "ml" };
  }
  const nomeNorm = normalizarNome(alimento.nome);
  const pq = parseQuantidade(alimento.quantidade ?? "");
  let unidadeCanon = normalizarUnidade(pq.unidade);
  let gramas = pq.valor;

  const jsonInfo = buscarPorcaoJson(nomeNorm);
  const temFatia = nomeNorm.includes("fatia") || unidadeCanon === "fatia";
  const temPrato = nomeNorm.includes("prato") || unidadeCanon === "prato";
  const temColher = nomeNorm.includes("colher") || unidadeCanon === "colher";

  if (alimento.porcaoUnitaria && Number(alimento.porcaoUnitaria) > 0) {
    if (unidadeCanon === "unidade" || unidadeCanon === "fatia" || unidadeCanon === "") {
      gramas = pq.valor * Number(alimento.porcaoUnitaria);
      return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
    }
  }
  if (jsonInfo?.portion_grams && jsonInfo.portion_grams > 0) {
    if (unidadeCanon === "unidade" || unidadeCanon === "fatia" || unidadeCanon === "") {
      gramas = pq.valor * jsonInfo.portion_grams;
      return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
    }
  }
  if (temFatia && nomeNorm.includes("pao de forma")) {
    gramas = pq.valor * 25;
    return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
  }
  if (temPrato && (nomeNorm.includes("salada") || nomeNorm.includes("folha"))) {
    gramas = pq.valor * 100;
    return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
  }
  if (temColher) {
    gramas = pq.valor * 15;
    return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
  }
  if (unidadeCanon === "unidade" || unidadeCanon === "") {
    let pesoMedio = 100;
    for (const chave of Object.keys(pesoMedioPorUnidadeNorm)) {
      if (nomeNorm.includes(chave)) { pesoMedio = pesoMedioPorUnidadeNorm[chave]; break; }
    }
    gramas = pq.valor * pesoMedio;
    return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
  }
  if (unidadeCanon === "copo" || unidadeCanon === "lata" || unidadeCanon === "xicara") {
    const bebidaMlMatch = String(alimento.quantidade || alimento.nome || "")
      .match(/(\d+)[^\d]+(copo|lata|xicara)[^\d]*(\d+)\s*ml/i);
    if (bebidaMlMatch) {
      const qtdCopos = parseInt(bebidaMlMatch[1]);
      const mlPorCopo = parseInt(bebidaMlMatch[3]);
      if (qtdCopos > 0 && mlPorCopo > 0) {
        return { quantidade: `${qtdCopos * mlPorCopo} ml`, valorQtd: qtdCopos * mlPorCopo, unidade: "ml" };
      }
    }
    if (unidadeCanon in unidadeParaGramasNorm) {
      let pesoMedio = unidadeParaGramasNorm[unidadeCanon] || unidadeParaGramasNorm["unidade"];
      gramas = pq.valor * pesoMedio;
      return { quantidade: `${gramas} ml`, valorQtd: gramas, unidade: "ml" };
    }
  }
  if (unidadeCanon === "ml" || unidadeCanon === "l") {
    if (unidadeCanon === "l") gramas = pq.valor * 1000;
    return { quantidade: `${Math.round(gramas * 10) / 10} ml`, valorQtd: gramas, unidade: "ml" };
  }
  if (unidadeCanon !== "g") {
    if (unidadeCanon in unidadeParaGramasNorm) {
      let pesoMedio = unidadeParaGramasNorm[unidadeCanon] || unidadeParaGramasNorm["unidade"];
      gramas = pq.valor * pesoMedio;
    } else if (unidadeCanon === "kg") {
      gramas = pq.valor * 1000;
    } else {
      gramas = pq.valor * 100;
    }
  }
  return { quantidade: `${Math.round(gramas * 10) / 10} g`, valorQtd: gramas, unidade: "g" };
}
