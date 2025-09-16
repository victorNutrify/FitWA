// src/ia/clients/openaiCaller.ts
import type { LLMCaller } from "../agents/types";

export const openAIChatCaller: LLMCaller = async ({
  system,
  messages,
  json = false,
  model = "gpt-4o-mini",
  temperature = 0,
  max_tokens = 800,
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ausente nas variáveis de ambiente.");
  }

  const payload: any = {
    model,
    temperature,
    max_tokens,
    messages: [],
  };

  if (system) {
    payload.messages.push({ role: "system", content: system });
  }
  for (const m of messages || []) {
    payload.messages.push({ role: m.role, content: String(m.content ?? "") });
  }

  if (json) {
    payload.response_format = { type: "json_object" };
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI HTTP ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "");
  return { content };
};
