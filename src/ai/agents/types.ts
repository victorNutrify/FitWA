// src/ia/agents/types.ts
export type AgentDomain = "food" | "exercise" | "diet" | "recipes" | "shopping" | "unknown";

export interface AgentContext {
  userEmail: string;
  hasImage?: boolean;       // se a mensagem veio com imagem
  nowISO?: string;          // data/hora atual (ISO -03:00 opcional)
  locale?: string;          // "pt-BR" por padrão
}

export interface AgentResult {
  domain: AgentDomain;
  reply?: string; // resposta amigável ao usuário (opcional nesta fase)
  data?: any;     // payload estruturado (o agente específico preenche)
}

export type LLMCaller = (opts: {
  system?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  json?: boolean;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}) => Promise<{ content: string }>;
