import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    company:              ApolloCompany;
    contacts:             ApolloPerson[];
    user_profession:      string;
    user_about:           string;
    user_speciality_tags: string[];
    user_location:        string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { company, contacts, user_profession, user_about, user_speciality_tags, user_location } = body;
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 });

  const contactLines = contacts?.length
    ? contacts.map((c) => `${c.title ?? "Unknown role"} - ${c.first_name} ${c.last_name}`).join("\n")
    : "No key contacts found";

  const prompt = `You are scoring a potential business contact for a ${user_profession || "freelancer"} based in ${user_location || "Unknown"}.

Company: ${company.name}
Industry: ${company.industry ?? "Unknown"}
Description: ${company.short_description ?? "Not provided"}
Size: ${company.estimated_num_employees != null ? `${company.estimated_num_employees} employees` : "Unknown"}
Keywords: ${company.keywords?.join(", ") || "None"}
Location: ${[company.city, company.country].filter(Boolean).join(", ") || "Unknown"}

Key contacts found:
${contactLines}

User's specialities: ${user_speciality_tags?.join(", ") || "Not specified"}
User's positioning: ${user_about || "Not provided"}

Score this lead from 0-100 based on:
- How likely this company is to hire/book this type of freelancer
- Quality and seniority of contacts found
- Proximity to user location
- Company size fit (not too small, not so big they only use in-house)
- Keyword relevance to user's specialities

Also provide:
- suggested_angle: one specific, personalised sentence about how to approach this contact (mention the contact's name and role if available)
- caution: one sentence about any risk or mismatch, or null if none
- why_good: 2-3 bullet points explaining the score
- score_label: 'Strong lead' if 70+, 'Good lead' if 40-69, 'Weak lead' if under 40

Return as JSON only.

{
  "score": <0-100 integer>,
  "score_label": "Strong lead" | "Good lead" | "Weak lead",
  "suggested_angle": "<string>",
  "caution": "<string or null>",
  "why_good": ["<bullet>", "<bullet>", "<bullet>"]
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);

    const aiData = await res.json();
    const raw = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    return NextResponse.json({
      score:           Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      score_label:     (["Strong lead", "Good lead", "Weak lead"] as const).includes(parsed.score_label)
                         ? parsed.score_label
                         : "Good lead",
      suggested_angle: String(parsed.suggested_angle || ""),
      caution:         parsed.caution ?? null,
      why_good:        Array.isArray(parsed.why_good) ? parsed.why_good : [],
    });
  } catch (err) {
    console.error("[apollo/score] Claude failed:", err);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}
