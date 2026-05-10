import { NextResponse } from "next/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

export async function POST(req: Request) {
  try {
    const {
      companyName,
      description,
      valueProp,
      keyProducts,
      persona,
    } = await req.json();

    if (!persona) {
      return NextResponse.json({ error: "persona required" }, { status: 400 });
    }

    const prompt = `You are a B2B sales expert. Given the company below, list the top pain points that a ${persona} at a prospect company would have — pain points that this seller's product/service directly solves.

Seller company: ${companyName || "Unknown"}
What they do: ${description || "Not provided"}
Value proposition: ${valueProp || "Not provided"}
Key products / services: ${(keyProducts as string[] | undefined)?.join(", ") || "Not provided"}

Return ONLY valid JSON — no markdown, no explanation:
{
  "pain_points": ["4 to 6 specific, concrete pain points a ${persona} faces that this company solves"]
}`;

    const raw = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 300, prompt });
    const parsed = parseClaudeJson(raw);

    const pain_points: string[] = Array.isArray(parsed.pain_points)
      ? parsed.pain_points.map(String)
      : [];

    return NextResponse.json({ success: true, pain_points });
  } catch (err) {
    console.error("[generate-pain-points]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
