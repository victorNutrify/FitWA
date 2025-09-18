// src/ai/clients/openaiCaller.ts
type Role = "system" | "user" | "assistant" | "tool";
type ChatMsg =
  | { role: Role; content: string; name?: string }
  | {
      role: Role;
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
      name?: string;
    };

type ToolDef = {
  type: "function";
  function: { name: string; description?: string; parameters: any };
};

type CallerArgs = {
  apiKey: string;
  model: string;
  temperature?: number;       // agora é opcional; omitimos p/ modelos que não suportam custom
  max_tokens?: number;
  system?: string;
  messages: ChatMsg[];
  forceJson?: boolean;        // response_format: { type: "json_object" }
  tools?: ToolDef[];
  tool_choice?: "auto" | { type: "function"; function: { name: string } };
  baseUrl?: string;
};

function stripCodeFences(s: string) {
  return String(s || "")
    .replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, p1) => (p1 || "").trim())
    .trim();
}

function parseJsonLoose(s: string) {
  const txt = stripCodeFences(s);
  try {
    if (/^\s*[{[]/.test(txt)) return JSON.parse(txt);
  } catch {}
  return null;
}

// Alguns modelos (ex.: "gpt-5") não aceitam temperature != 1.
// Nesses casos, melhor OMITIR o campo.
function supportsCustomTemperature(model: string): boolean {
  const m = (model || "").toLowerCase().trim();
  // ajuste aqui se você usar outros modelos com a mesma restrição
  if (m.startsWith("gpt-5")) return false;
  return true;
}

export async function openAIChatCaller({
  apiKey,
  model,
  temperature,
  max_tokens,
  system,
  messages,
  forceJson,
  tools,
  tool_choice,
  baseUrl,
}: CallerArgs): Promise<{
  text: string;
  json: any | null;
  toolCall?: { name: string; arguments: string } | undefined;
  raw: any;
}> {
  const url = `${baseUrl ?? "https://api.openai.com"}/v1/chat/completions`;
  const msgs: any[] = [];

  if (system) msgs.push({ role: "system", content: system });
  for (const m of messages) msgs.push(m);

  const body: any = { model, messages: msgs };

  // Só envia temperature se explicitamente pedido e suportado
  if (typeof temperature === "number" && supportsCustomTemperature(model)) {
    body.temperature = temperature;
  }

  if (typeof max_tokens === "number") body.max_tokens = max_tokens;
  if (forceJson) body.response_format = { type: "json_object" };
  if (tools?.length) body.tools = tools;
  if (tool_choice) body.tool_choice = tool_choice;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errTxt || res.statusText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const message = choice?.message ?? {};
  const content: string = typeof message.content === "string" ? message.content : "";

  let toolCall: { name: string; arguments: string } | undefined = undefined;
  const firstTool = message?.tool_calls?.[0]?.function;
  if (firstTool?.name) {
    toolCall = { name: firstTool.name, arguments: String(firstTool.arguments ?? "") };
  }

  const j = toolCall ? null : parseJsonLoose(content);

  return { text: content || "", json: j, toolCall, raw: data };
}
