// src/ai/agents/exercise.ts
import { AgentContext, AgentResult } from "./types";
import { EXERCISE_SYSTEM_PROMPT } from "@/ai/prompts/exerciseLogger";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import { db, doc, setDoc, collection } from "@/lib/firestore.admin.compat";

function parseJsonLoose(rawText: string): any {
  let text = String(rawText || "");
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, p1) => String(p1 || "").trim());
  try {
    if (/^\s*{/.test(text)) return JSON.parse(text);
    if (/^\s*\[/.test(text)) return { exercicios: JSON.parse(text), reply: "" };
  } catch {
    /* ignore */
  }
  return { reply: rawText ?? "" };
}

function todayKey(): string {
  // YYYY-MM-DD (UTC)
  return new Date().toISOString().slice(0, 10);
}

function newId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistExerciseOps(args: {
  userEmail?: string;
  reply: string;
  model: string;
  data: {
    exercicios?: any[];
    exercicios_a_excluir?: any[];
    exercicios_a_subtrair?: any[];
    exercicios_a_substituir?: Array<{ de: any; para: any }>;
  };
}) {
  const { userEmail, reply, model, data } = args;
  if (!userEmail) return; // sem email, não persiste

  const day = todayKey();
  const rootRef = doc(db, "chatfit", userEmail, "exerciciosDoDia", day);
  const opsCol = collection(db, "chatfit", userEmail, "exerciciosDoDia", day, "ops");

  // Doc resumo do dia (metadados)
  await setDoc(
    rootRef,
    {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastReply: reply ?? "",
      model,
      source: "agent",
      hasOps: true,
    },
    { merge: true }
  );

  // Grava eventos individuais (append-only)
  const writeOp = async (type: "add" | "remove" | "sub" | "swap", payload: any) => {
    const evRef = doc(opsCol, newId());
    await setDoc(evRef, {
      type,
      payload,
      ts: Date.now(),
      source: "agent",
      model,
    });
  };

  for (const it of data.exercicios ?? []) {
    await writeOp("add", it);
  }
  for (const it of data.exercicios_a_excluir ?? []) {
    await writeOp("remove", it);
  }
  for (const it of data.exercicios_a_subtrair ?? []) {
    await writeOp("sub", it);
  }
  for (const it of data.exercicios_a_substituir ?? []) {
    await writeOp("swap", it);
  }
}

export async function runExerciseAgent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  model: string;
}): Promise<AgentResult> {
  const { messages, ctx, openAIApiKey, model } = args;

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const userText = typeof lastUser === "string" ? lastUser : "";

  const { text } = await openAIChatCaller({
    apiKey: openAIApiKey,
    model,
    system: EXERCISE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText || "Registrar exercícios" }],
    // não enviamos temperature para evitar erro de modelos que não suportam custom
    forceJson: true,
  });

  const parsed = parseJsonLoose(text);
  const reply = parsed?.reply || "Entendido! Registrei seus exercícios.";

  // >>> Persistência no Firestore (subcoleção ops + doc do dia)
  try {
    await persistExerciseOps({
      userEmail: ctx?.userEmail,
      reply,
      model,
      data: {
        exercicios: parsed?.exercicios,
        exercicios_a_excluir: parsed?.exercicios_a_excluir,
        exercicios_a_subtrair: parsed?.exercicios_a_subtrair,
        exercicios_a_substituir: parsed?.exercicios_a_substituir,
      },
    });
  } catch (err) {
    console.error("[exercise.persist] erro:", err);
    // segue sem quebrar a resposta ao usuário
  }

  return {
    domain: "exercise",
    reply,
    data: parsed,
  };
}
