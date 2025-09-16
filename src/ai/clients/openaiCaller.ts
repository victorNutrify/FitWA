// src/ai/clients/openaiCaller.ts
type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; name?: string };

type ToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: any; // JSON Schema
  };
};

type CallerArgs = {
  apiKey: string;
  model: string;
  temperature?: number;
  messages: ChatMsg[];
  response_format?: { type: "json_object" } | { type: "text" };
  tools?: ToolDef[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
};

function parseJsonLoose(s: string) {
  const trimmed = (s || "").trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(trimmed.slice(start, end + 1)); } catch {}
    }
    return undefined;
  }
}

export async function openAIChatCaller(args: CallerArgs): Promise<{
  text: string;
  json?: any;
  toolCall?: { name: string; arguments: string };
  raw: any;
}> {
  const { apiKey, model, temperature = 0.2, messages, response_format, tools, tool_choice } = args;

  const body: any = {
    model,
    temperature,
    messages,
  };
  if (response_format) body.response_format = response_format;
  if (tools?.length) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`[openAIChatCaller] ${res.status} ${res.statusText} ${errTxt}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const msg = choice?.message ?? {};
  const content = typeof msg.content === "string" ? msg.content : (Array.isArray(msg.content) ? msg.content.join("") : "");

  // Se for tool_call, devolvemos os argumentos crus (string JSON)
  const toolCall = Array.isArray(msg.tool_calls) && msg.tool_calls[0]?.type === "function"
    ? {
        name: msg.tool_calls[0].function?.name as string,
        arguments: String(msg.tool_calls[0].function?.arguments ?? ""),
      }
    : undefined;

  // Tenta extrair JSON do próprio content (caso não use tool)
  const j = toolCall ? undefined : parseJsonLoose(content);

  return {
    text: content || "",
    json: j,
    toolCall,
    raw: data,
  };
}
