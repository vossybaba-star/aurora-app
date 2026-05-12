import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

// Must match CONTACT_ALL_ROLES in discover-page.tsx exactly
const ALL_ROLES = [
  // C-Suite
  "CEO","COO","CFO","CTO","CMO","CPO","CRO","CHRO","CSO",
  // VP level
  "VP of Sales","VP of Marketing","VP of Engineering","VP of Product","VP of Operations","VP of Business Development",
  // Director
  "Sales Director","Marketing Director","Growth Director","Operations Director","Business Development Director","IT Director",
  // Manager / Head
  "Head of Sales","Head of Marketing","Head of Growth","Head of Product","Head of Engineering","Sales Manager","Account Manager",
  // Individual contributor
  "Account Executive","SDR","BDR","Sales Representative","Marketing Manager","Product Manager","Software Engineer",
  // Founder
  "Founder","Co-Founder","Managing Director","General Manager","Owner",
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { description, valueProp, industries, keyProducts } = await req.json();

    if (!description && !valueProp) {
      return NextResponse.json({ error: "description or valueProp required" }, { status: 400 });
    }

    const prompt = `You are a B2B sales expert. Based on the company below, identify which job titles are most likely to be:
1. Champions — mid-level roles who use or benefit from the product daily and advocate internally
2. Decision Makers — C-suite or senior titles who control budget and give final sign-off

Company description: ${description || "Not provided"}
Value proposition: ${valueProp || "Not provided"}
Target industries: ${Array.isArray(industries) && industries.length ? industries.join(", ") : "Not specified"}
Key products / services: ${Array.isArray(keyProducts) && keyProducts.length ? keyProducts.join(", ") : "Not specified"}

You MUST ONLY select from this exact list of roles (copy the titles exactly as they appear):
${ALL_ROLES.join(", ")}

Rules:
- Champions: pick 2–4 roles that would use this product day-to-day
- Decision Makers: pick 1–3 senior roles (C-suite, VP, or Director level) who would sign off on the purchase
- Do NOT invent titles — only use titles from the list above
- Prioritise the most relevant roles, not all possible ones

Return ONLY valid JSON:
{
  "champions": ["<role from list>", ...],
  "decision_makers": ["<role from list>", ...]
}`;

    const raw = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 200, prompt });
    const parsed = parseClaudeJson<{ champions?: unknown; decision_makers?: unknown }>(raw);

    const champions = (Array.isArray(parsed.champions) ? parsed.champions.map(String) : [])
      .filter(r => ALL_ROLES.includes(r));
    const decision_makers = (Array.isArray(parsed.decision_makers) ? parsed.decision_makers.map(String) : [])
      .filter(r => ALL_ROLES.includes(r));

    return NextResponse.json({ champions, decision_makers });
  } catch (err) {
    console.error("[generate-personas]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
