import { NextResponse } from "next/server";

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

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) throw new Error(`AI error: ${aiRes.status}`);

    const aiData = await aiRes.json();
    const raw    = (aiData.content?.[0]?.text ?? "{}").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);

    return NextResponse.json({ success: true, summary: String(parsed.summary ?? "") });
  } catch (err) {
    console.error("[generate-product-summary]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
