export type AgentDomain = "food" | "exercise" | "diet" | "recipes" | "shopping" | "unknown";

export interface AgentContext {
  userEmail: string;
  hasImage?: boolean;
  imageBase64?: string;   // <- adicionado para o agente de comidas usar a imagem
  nowISO?: string;
  locale?: string;
}

export interface AgentResult {
  domain: AgentDomain;
  reply?: string;
  data?: any;
}

// Opcional (usado em outras variantes). Mantido aqui para compatibilidade.
export type LLMCaller = (opts: {
  system?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  json?: boolean;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}) => Promise<{ content: string }>;


