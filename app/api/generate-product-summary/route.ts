import { NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

export async function POST(req: Request) {
  try {
    const { companyName, description, productName } = await req.json();

    if (!productName) {
      return NextResponse.json({ error: "productName required" }, { status: 400 });
    }

    const prompt = `You are a B2B sales expert. Write a concise 1–2 sentence summary of the product/service below, written from the seller's perspective for use in sales outreach.

Company: ${companyName || "Unknown"}
Company description: ${description || "Not provided"}
Product / service name: ${productName}

Return ONLY valid JSON — no markdown:
{"summary": "1-2 sentence plain-language product summary focused on the value it delivers"}`;

    const raw    = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 200, prompt });
    const parsed = parseClaudeJson(raw);

    return NextResponse.json({ success: true, summary: String(parsed.summary ?? "") });
  } catch (err) {
    console.error("[generate-product-summary]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
