import type { Bindings } from "../../../config/env";

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicContentBlock = { type: string; input?: unknown };
type AnthropicMessagesResponse = { content: AnthropicContentBlock[] };

/**
 * Calls Anthropic's Messages API through Cloudflare AI Gateway (for logging/caching/cost
 * tracking) with a forced tool call, guaranteeing a structured JSON response matching
 * `tool.input_schema`. Swapping providers means writing a new `providers/<name>` adapter
 * behind the same ports — this function is the only place that knows about Anthropic.
 */
export async function callAnthropicTool<T>(
  env: Bindings,
  params: { system: string; userMessage: string; tool: AnthropicTool; maxTokens?: number },
): Promise<T> {
  const url = `https://gateway.ai.cloudflare.com/v1/${env.CF_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/anthropic/v1/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
      tools: [params.tool],
      tool_choice: { type: "tool", name: params.tool.name },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`anthropic_request_failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as AnthropicMessagesResponse;
  const toolUse = data.content.find((block) => block.type === "tool_use");

  if (!toolUse || toolUse.input === undefined) {
    throw new Error("anthropic_no_tool_use_response");
  }

  return toolUse.input as T;
}
