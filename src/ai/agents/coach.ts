// src/ai/agents/coach.ts
import type { AgentContext, AgentResult } from "./types";
import { openAIChatCaller } from "@/ai/clients/openaiCaller";
import { COACH_SYSTEM_PROMPT } from "@/ai/prompts/coach";

export async function runCoachAgent(args: {
  messages: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  ctx: AgentContext;
  openAIApiKey: string;
  model: string;
}): Promise<AgentResult> {
  const { messages, openAIApiKey, model } = args;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const userText = typeof lastUser === "string" ? lastUser : "";

  const { text } = await openAIChatCaller({
    apiKey: openAIApiKey,
    model,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userText || "Dicas gerais de bem-estar" }],
  });

  return {
    domain: "coach",
    reply: text || "Posso orientar hábitos saudáveis. Quer um plano de dieta ou registrar exercícios?",
    data: null
  };
}
