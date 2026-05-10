/**
 * lib/anthropic/client.ts
 *
 * Shared Anthropic API client. Single source of truth for headers,
 * version string, error handling, and JSON cleaning.
 *
 * Uses raw fetch (no SDK) — keeps Vercel build cache happy.
 */

export type AnthropicModel =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20251001"
  | "claude-opus-4-5";

export interface CallClaudeOptions {
  model:      AnthropicModel;
  maxTokens:  number;
  /** Optional system prompt (prepended to conversation). */
  system?:    string;
  /** User message content. */
  prompt:     string;
}

/**
 * Call the Anthropic Messages API and return the raw text response.
 * Throws on non-OK HTTP status or missing API key.
 */
export async function callClaude(opts: CallClaudeOptions): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const body: Record<string, unknown> = {
    model:      opts.model,
    max_tokens: opts.maxTokens,
    messages:   [{ role: "user", content: opts.prompt }],
  };
  if (opts.system) body.system = opts.system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:  "POST",
    headers: {
      "x-api-key":         key,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.content?.[0]?.text ?? "") as string;
}

/** Strip markdown code fences and parse JSON. Throws on invalid JSON. */
export function parseClaudeJson<T = Record<string, unknown>>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as T;
}
