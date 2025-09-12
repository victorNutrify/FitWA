import { NextRequest, NextResponse } from "next/server";
import { db, doc, setDoc, getDocs, collection, runTransaction, deleteDoc } from "@/lib/firestore.admin.compat";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { db } from "../../../../libBACK/firebase";

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

// Horário Brasília (GMT-3)
function getBrasiliaDate() {
  const now = new Date();
  const brasiliaOffsetMs = -3 * 60 * 60 * 1000;
  const brasiliaDate = new Date(now.getTime() + brasiliaOffsetMs);
  return brasiliaDate;
}
function getHorarioBrasilISO() {
  const d = getBrasiliaDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getUTCFullYear();
  const month = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hour = pad(d.getUTCHours());
  const minute = pad(d.getUTCMinutes());
  const second = pad(d.getUTCSeconds());
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}
function getDiaAtual() {
  return getHorarioBrasilISO().slice(0, 10);
}

const pesoMedioPorUnidade: Record<string, number> = {
  melancia: 5000, melao: 1500, maçã: 130, laranja: 150, banana: 120,
  "pão francês": 50, pao: 50, pao_frances: 50, "bife de carne": 120,
  bife: 120, frango: 120, ovo: 50, pera: 160, manga: 300, abacaxi: 1400, tomate: 110, cenoura: 70, batata: 90
};
const unidadeParaGramas: Record<string, number> = {
  ovo: 50, banana: 120, maçã: 130, pão: 50, frango: 120, arroz: 100, linguiça: 80,
  couve: 50, farofa: 30, purê: 60, carne: 100, peixe: 100, unidade: 100, xicara: 120,
  colher: 15, bife: 120, pato: 300, copo: 200, lata: 350, ml: 1
};

function normalizarNome(nome: string) {
  if (!nome) return "";
  let txt = nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\s|_|-)+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
  txt = txt.replace(/\bovos\b/g, "ovo")
    .replace(/\bbananas\b/g, "banana");
  return txt;
}
function normalizarUnidade(u: string) {
  const x = (u || "").toLowerCase().trim();
  if (!x) return "";
  if (/^(unid|unidade|unidades|u|und|x)$/.test(x)) return "unidade";
  if (/^(g|grama|gramas)$/.test(x)) return "g";
  if (/^(kg|quilo|quilos)$/.test(x)) return "kg";
  if (/^(ml|mililitro|mililitros)$/.test(x)) return "ml";
  if (/^(l|litro|litros)$/.test(x)) return "l";
  if (/^(colher|colheres|csp|cs)$/.test(x)) return "colher";
  if (/^(colhercha|colherdecha|cc|cchá|cch)$/.test(x)) return "colher_cha";
  if (/^(xicara|xicaras)$/.test(x)) return "xicara";
  if (/^(fatia|fatias)$/.test(x)) return "fatia";
  if (/^(bife|bifes)$/.test(x)) return "bife";
  if (/^(pato|patos)$/.test(x)) return "pato";
  if (/^(copo|copos)$/.test(x)) return "copo";
  if (/^(lata|latas)$/.test(x)) return "lata";
  return x;
}
function parseQuantidade(qtd: string) {
  if (!qtd) return { valor: 1, unidade: "" };
  const qtdNorm = qtd.toLowerCase().replace(",", ".").replace(/\s+/g, " ").trim();
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
function toGramas(alimento: any): { quantidade: string, valorQtd: number, unidade: string } {
  if (alimento._ml_total && alimento._ml_total > 0) {
    return {
      quantidade: `${alimento._ml_total} ml`,
      valorQtd: alimento._ml_total,
      unidade: "ml"
    };
  }
  let pq = parseQuantidade(alimento.quantidade || "");
  let unidadeCanon = normalizarUnidade(pq.unidade);
  let gramas = pq.valor;

  if (unidadeCanon === "unidade") {
    const nomeNorm = normalizarNome(alimento.nome);
    let pesoMedio = 100;
    for (const chave of Object.keys(pesoMedioPorUnidade)) {
      if (nomeNorm.includes(chave)) {
        pesoMedio = pesoMedioPorUnidade[chave];
        break;
      }
    }
    gramas = pq.valor * pesoMedio;
    return {
      quantidade: `${Math.round(gramas * 10) / 10} g`,
      valorQtd: gramas,
      unidade: "g"
    };
  }
  if (unidadeCanon === "copo" || unidadeCanon === "lata" || unidadeCanon === "xicara") {
    const bebidaMlMatch = String(alimento.quantidade || alimento.nome || "")
      .match(/(\d+)[^\d]+(copo|lata|xicara)[^\d]*(\d+)\s*ml/i);
    if (bebidaMlMatch) {
      const qtdCopos = parseInt(bebidaMlMatch[1]);
      const mlPorCopo = parseInt(bebidaMlMatch[3]);
      if (qtdCopos > 0 && mlPorCopo > 0) {
        return {
          quantidade: `${qtdCopos * mlPorCopo} ml`,
          valorQtd: qtdCopos * mlPorCopo,
          unidade: "ml"
        };
      }
    }
    if (unidadeCanon in unidadeParaGramas) {
      let pesoMedio = unidadeParaGramas[unidadeCanon] || unidadeParaGramas["unidade"];
      gramas = pq.valor * pesoMedio;
      return {
        quantidade: `${gramas} ml`,
        valorQtd: gramas,
        unidade: "ml"
      };
    }
  }
  if (unidadeCanon === "ml" || unidadeCanon === "l") {
    if (unidadeCanon === "l") gramas = pq.valor * 1000;
    return {
      quantidade: `${Math.round(gramas * 10) / 10} ml`,
      valorQtd: gramas,
      unidade: "ml"
    };
  }
  if (unidadeCanon !== "g") {
    if (unidadeCanon in unidadeParaGramas) {
      let pesoMedio = unidadeParaGramas[unidadeCanon] || unidadeParaGramas["unidade"];
      gramas = pq.valor * pesoMedio;
    } else if (unidadeCanon === "kg") {
      gramas = pq.valor * 1000;
    } else {
      gramas = pq.valor * 100;
    }
  }
  return {
    quantidade: `${Math.round(gramas * 10) / 10} g`,
    valorQtd: gramas,
    unidade: "g"
  };
}

// Busca macros no alimentos_br.json
function buscarMacrosBr(nomeNorm: string) {
  for (const alimento of alimentosBr) {
    if (normalizarNome(alimento.nome) === nomeNorm) {
      return {
        calorias: Number(alimento.calorias) || 0,
        proteina: Number(alimento.proteina) || 0,
        carboidrato: Number(alimento.carboidrato) || 0,
        gordura: Number(alimento.gordura) || 0,
        fonteMacros: "Match via alimentos_br.json"
      }
    }
  }
  return null;
}

async function buscarOpenFood(alimentoNome: string) {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(alimentoNome)}&search_simple=1&json=1&page_size=1`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.products && data.products.length > 0 && data.products[0].nutriments) {
      const nutr = data.products[0].nutriments;
      return {
        calorias: nutr.energy_kcal || 0,
        proteina: nutr.proteins || 0,
        carboidrato: nutr.carbohydrates || 0,
        gordura: nutr.fat || 0,
        fonteMacros: "Match via OpenFoodFacts API"
      };
    }
  } catch (err) {
    console.error("[OpenFood] Erro ao buscar alimento:", alimentoNome, err);
  }
  return null;
}

function evalNumber(val: any) {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const clean = val.replace(/,/g, ".").replace(/\s+/g, "");
    if (/^\d+(\.\d+)?$/.test(clean)) return parseFloat(clean);
    if (/^[\d\.\+\-\*\/\(\)]+$/.test(clean)) {
      try {
        return Function(`"use strict";return (${clean})`)();
      } catch {
        return 0;
      }
    }
  }
  return 0;
}

/**
 * Adiciona todos os alimentos enviados pelo usuário, inclusive os que não existem previamente.
 * Preenche macros antes de salvar, buscando alimentos_br.json e OpenFoodFacts se necessário!
 */
async function adicionarAlimentosFirestore(userEmail: string, alimentos: any[], dia: string) {
  if (!Array.isArray(alimentos)) return;
  for (const alimento of alimentos) {
    if (!alimento || !alimento.nome) continue;
    try {
      const nomeNorm = normalizarNome(alimento.nome);
      const gramasObj = toGramas(alimento);
      const unidadeCanon = gramasObj.unidade;
      const docId = alimentoDocId(nomeNorm, unidadeCanon); // <-- SEMPRE usar docId normalizado!
      const itemRef = doc(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos", docId);

      // Preencher macros caso estejam zerados ou ausentes
      let macros = {
        calorias: evalNumber(alimento.calorias),
        proteina: evalNumber(alimento.proteina),
        carboidrato: evalNumber(alimento.carboidrato),
        gordura: evalNumber(alimento.gordura),
        fonteMacros: alimento.fonteMacros || ""
      };

      // Se todos macros estiverem 0 ou ausentes, busca no alimentos_br.json
      if (
        (!macros.calorias && !macros.proteina && !macros.carboidrato && !macros.gordura)
      ) {
        const brMacros = buscarMacrosBr(nomeNorm);
        if (brMacros) {
          macros = brMacros;
        } else {
          // Se não achar, busca na OpenFoodFacts
          const openFoodMacros = await buscarOpenFood(alimento.nome);
          if (openFoodMacros) {
            macros = openFoodMacros;
          }
        }
      }

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(itemRef);
        const nowISO = getHorarioBrasilISO();

        if (!snap.exists()) {
          tx.set(itemRef, {
            nome: alimento.nome,
            nome_normalizado: nomeNorm,
            unidade: unidadeCanon,
            quantidade: gramasObj.quantidade,
            calorias: Math.round(macros.calorias * 10) / 10,
            proteina: Math.round(macros.proteina * 10) / 10,
            carboidrato: Math.round(macros.carboidrato * 10) / 10,
            gordura: Math.round(macros.gordura * 10) / 10,
            horario: nowISO,
            criadoPor: userEmail,
            fonteMacros: macros.fonteMacros || "",
          });
        } else {
          const data = snap.data() as any;
          const qtdBanco = parseQuantidade(String(data.quantidade || "")).valor || 0;
          const novaQtd = (qtdBanco || 0) + (gramasObj.valorQtd || 0);
          const novaQtdStr = `${Math.round(novaQtd * 10) / 10} ${unidadeCanon}`;
          tx.update(itemRef, {
            quantidade: novaQtdStr,
            calorias: evalNumber(data.calorias) + Math.round(macros.calorias * 10) / 10,
            proteina: evalNumber(data.proteina) + Math.round(macros.proteina * 10) / 10,
            carboidrato: evalNumber(data.carboidrato) + Math.round(macros.carboidrato * 10) / 10,
            gordura: evalNumber(data.gordura) + Math.round(macros.gordura * 10) / 10,
            horario: nowISO,
            fonteMacros: macros.fonteMacros || "",
          });
        }
      });
    } catch (err) {
      console.error(`[REGISTRO] Falha ao salvar alimento "${alimento?.nome ?? "?"}":`, err);
    }
  }
  await salvarResumoAcumulado(userEmail, dia);
}

async function excluirAlimentosFirestore(userEmail: string, alimentos: any[], dia: string) {
  if (!Array.isArray(alimentos)) return;
  for (const alimento of alimentos) {
    if (!alimento || !alimento.nome) continue;
    try {
      const nomeNorm = normalizarNome(alimento.nome);
      const gramasObj = toGramas(alimento);
      const unidadeCanon = gramasObj.unidade;
      const docId = alimentoDocId(nomeNorm, unidadeCanon);
      const itemRef = doc(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos", docId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(itemRef);
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const qtdBanco = parseQuantidade(String(data.quantidade || "")).valor || 0;
        const qtdExcluir = gramasObj.valorQtd || 0;
        let novaQtd = qtdBanco - qtdExcluir;
        if (novaQtd <= 0) {
          tx.delete(itemRef);
        } else {
          const novaQtdStr = `${Math.round(novaQtd * 10) / 10} ${unidadeCanon}`;
          tx.update(itemRef, {
            quantidade: novaQtdStr,
            calorias: evalNumber(data.calorias) * (novaQtd / qtdBanco),
            proteina: evalNumber(data.proteina) * (novaQtd / qtdBanco),
            carboidrato: evalNumber(data.carboidrato) * (novaQtd / qtdBanco),
            gordura: evalNumber(data.gordura) * (novaQtd / qtdBanco),
          });
        }
      });
    } catch (err) {
      console.error(`[EXCLUSAO] Falha ao excluir alimento "${alimento?.nome ?? "?"}":`, err);
    }
  }
  await salvarResumoAcumulado(userEmail, dia);
}

async function substituirAlimentosFirestore(userEmail: string, substituicoes: any[], dia: string) {
  for (const sub of substituicoes) {
    if (!sub.de || !sub.para) continue;
    await excluirAlimentosFirestore(userEmail, [sub.de], dia);
    await adicionarAlimentosFirestore(userEmail, [sub.para], dia);
  }
}

async function salvarResumoAcumulado(userEmail: string, dia: string) {
  try {
    const historicoRef = collection(db, "chatfit", userEmail, "refeicoes", dia, "historicoAlimentos");
    const snap = await getDocs(historicoRef);
    let total = {
      calorias: 0, proteina: 0, carboidrato: 0, gordura: 0, agua: 0, acucar: 0, sodio: 0, cafeina: 0
    };
    snap.forEach(doc => {
      const d = doc.data();
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

// Parser robusto permanece igual
async function parseMacros(rawText: string, userInput?: string) {
  let text = rawText;
  text = text.replace(/```(?:json)?([\s\S]*?)```/gi, (_m, p1) => p1.trim());
  try {
    if (/^\s*{/.test(text)) {
      const obj = JSON.parse(text);
      if (Array.isArray(obj.alimentos)) return obj;
      for (const k of Object.keys(obj)) {
        if (Array.isArray(obj[k])) return { alimentos: obj[k], reply: obj.reply || "" };
      }
      return obj;
    }
    if (/^\s*\[/.test(text)) {
      return { alimentos: JSON.parse(text), reply: "" };
    }
  } catch (err) {
    console.log("[PARSE] Falha ao parsear resposta da LLM!", err, rawText);
  }
  return { reply: text };
}

function buildOpenAIMessages({ systemPrompt, messages, imageBase64 }: {
  systemPrompt: string, messages: any[], imageBase64?: string
}) {
  if (imageBase64) {
    return [
      { role: "system", content: systemPrompt },
      ...messages,
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Identifique todos os alimentos presentes ou corrigidos na imagem, e se houver instruções de exclusão, correção ou substituição, retorne sempre em JSON conforme exemplos, priorizando alimentos_br.json. Sempre explique o que foi alterado."
          },
          {
            type: "image_url",
            image_url: { url: imageBase64, detail: "high" }
          }
        ]
      }
    ];
  }
  return [
    { role: "system", content: systemPrompt },
    ...messages,
  ];
}

// NOVO: systemPrompt para lançamento, exclusão e substituição
const systemPrompt = `
Você é um assistente de saúde, nutrição e atividade física.
Sempre responda em formato JSON estruturado, conforme exemplos abaixo.
Agora, além de lançar alimentos, você pode receber comandos para EXCLUIR (remover parte ou tudo de um alimento já registrado) e SUBSTITUIR (corrigir alimento lançado).

Exemplo de exclusão parcial:
Usuário: Remover 130g de laranja.
{
  reply: "Removido 130g de laranja. Saldo: 170g de laranja.",
  alimentos_a_subtrair: [{ nome: "Laranja", quantidade: "130g" }]
}

Exemplo de exclusão total:
Usuário: Excluir farofa.
{
  reply: "Alimento farofa removido.",
  alimentos_a_excluir: [{ nome: "Farofa", quantidade: "50g" }]
}

Exemplo de substituição:
Usuário: Não é farofa, é 500g de arroz.
{
  reply: "Substituído 50g de farofa por 500g de arroz.",
  alimentos_a_substituir: [{ de: { nome: "Farofa", quantidade: "50g" }, para: { nome: "Arroz", quantidade: "500g" } }]
}

Exemplo de lançamento normal:
Usuário: Comi 120g de banana.
{
  reply: "Alimento banana registrado!",
  alimentos: [{ nome: "Banana", quantidade: "120g", ... }]
}

Sempre inclua TODOS os alimentos informados, nunca ignore nenhum. Explique no reply o que foi feito.
`.trim();

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    let isMultipart = false;
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      isMultipart = true;
      const formData = await req.formData();
      body.userEmail = formData.get("userEmail") as string;
      body.messages = JSON.parse(formData.get("messages") as string);
      const imageFile = formData.get("image");
      if (imageFile && typeof imageFile === "object" && "arrayBuffer" in imageFile) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        body.imageBase64 = "data:image/jpeg;base64," + buffer.toString("base64");
      } else if (typeof imageFile === "string" && imageFile.startsWith("data:image/")) {
        body.imageBase64 = imageFile;
      }
    } else {
      body = await req.json();
    }
    const { messages, userEmail, imageBase64 } = body;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing." }, { status: 500 });
    }

    let userInput = "";
    if (Array.isArray(messages) && messages.length) {
      userInput = messages[messages.length - 1].content;
      if (typeof userInput !== "string" && typeof userInput?.text === "string") userInput = userInput.text;
    }

    const openAIMessages = buildOpenAIMessages({ systemPrompt, messages, imageBase64 });

    let response: Response;
    let data: any = null;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: openAIMessages,
          max_tokens: 900,
        }),
      });
      if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: "Erro ao conectar com a IA (OpenAI). " + errText }, { status: 500 });
      }
      data = await response.json();
    } catch (err: any) {
      return NextResponse.json({ error: "Erro ao conectar com a IA (fetch). " + (err?.message || "") }, { status: 500 });
    }
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const replyRaw = data.choices?.[0]?.message?.content ?? "";
    const macros = await parseMacros(replyRaw, userInput);

    const dia = getDiaAtual();

    // Lançamento normal
    if (Array.isArray(macros.alimentos) && macros.alimentos.length && userEmail) {
      await adicionarAlimentosFirestore(userEmail, macros.alimentos, dia);
    }
    // Exclusão parcial
    if (Array.isArray(macros.alimentos_a_subtrair) && macros.alimentos_a_subtrair.length && userEmail) {
      await excluirAlimentosFirestore(userEmail, macros.alimentos_a_subtrair, dia);
    }
    // Exclusão total
    if (Array.isArray(macros.alimentos_a_excluir) && macros.alimentos_a_excluir.length && userEmail) {
      await excluirAlimentosFirestore(userEmail, macros.alimentos_a_excluir, dia);
    }
    // Substituição/correção
    if (Array.isArray(macros.alimentos_a_substituir) && macros.alimentos_a_substituir.length && userEmail) {
      await substituirAlimentosFirestore(userEmail, macros.alimentos_a_substituir, dia);
    }

    return NextResponse.json({
      reply: macros.reply || replyRaw,
      alimentos_lancados: macros.alimentos?.map(a => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ?? [],
      alimentos_excluidos: [
        ...(macros.alimentos_a_subtrair?.map(a => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ?? []),
        ...(macros.alimentos_a_excluir?.map(a => `${a.nome ?? ""} (${a.quantidade ?? ""})`) ?? [])
      ],
      alimentos_substituidos: macros.alimentos_a_substituir?.map(sub => {
        return {
          de: `${sub.de?.nome ?? ""} (${sub.de?.quantidade ?? ""})`,
          para: `${sub.para?.nome ?? ""} (${sub.para?.quantidade ?? ""})`
        };
      }) ?? [],
      alimentos: macros.alimentos ?? [],
      exercicios: []
    });

  } catch (err: any) {
    console.error("Erro inesperado no servidor:", err);
    return NextResponse.json({ error: "Erro inesperado no servidor: " + (err?.message || "") }, { status: 500 });
  }
}