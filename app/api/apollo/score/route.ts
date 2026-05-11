import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { ApolloCompany, ApolloPerson } from "@/lib/apollo";
import type { ICP, CompanyAnalysis } from "@/lib/types";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

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
    icp?:                 ICP;
    company_analysis?:    CompanyAnalysis;
    opportunity_id?:      string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const {
    company, contacts,
    user_profession, user_about, user_speciality_tags, user_location,
    icp, company_analysis, opportunity_id,
  } = body;
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 });

  const contactLines = contacts?.length
    ? contacts.map((c) => `${c.title ?? "Unknown role"} - ${c.first_name} ${c.last_name}`).join("\n")
    : "No key contacts found";

  // ── B2B mode (ICP present) ────────────────────────────────────────────────
  const isB2B = !!(icp && company_analysis);

  const prompt = isB2B
    ? `You are scoring a B2B sales prospect for a company that sells: ${company_analysis!.value_proposition || company_analysis!.description || "B2B software/services"}.

Seller's product: ${company_analysis!.description}
Value proposition: ${company_analysis!.value_proposition}
Key capabilities: ${company_analysis!.key_features?.join(", ") || "Not specified"}
ICP target industries: ${icp!.industries?.join(", ") || "Any"}
ICP company sizes: ${icp!.company_sizes?.join(", ") || "Any"}
ICP champions: ${(icp!.champions ?? []).join(", ") || "Any"}
ICP decision makers: ${(icp!.decision_makers ?? []).join(", ") || "Any"}
ICP pain points: ${Object.values(icp!.pain_points ?? {}).flat().join(", ") || "Not specified"}
ICP geography: ${icp!.geography?.join(", ") || "United Kingdom"}

Prospect company: ${company.name}
Industry: ${company.industry ?? "Unknown"}
Description: ${company.short_description ?? "Not provided"}
Size: ${company.estimated_num_employees != null ? `${company.estimated_num_employees} employees` : "Unknown"}
Keywords: ${company.keywords?.join(", ") || "None"}
Location: ${[company.city, company.country].filter(Boolean).join(", ") || "Unknown"}

Key contacts found:
${contactLines}

Score this prospect from 0-100 based on:
- Industry match with ICP target industries
- Company size match with ICP company sizes
- Contact job titles match with ICP personas
- Location match with ICP geography
- Keyword/description alignment with seller's capabilities

Also provide:
- suggested_angle: one specific, personalised cold outreach opener referencing the prospect's industry or a known pain point; mention the contact's name and role if available. Reference the seller's value proposition naturally.
- caution: one sentence about any risk or mismatch, or null if none
- why_good: 2-3 bullet points explaining the ICP fit
- score_label: 'Strong lead' if 70+, 'Good lead' if 40-69, 'Weak lead' if under 40

Return as JSON only.

{
  "score": <0-100 integer>,
  "score_label": "Strong lead" | "Good lead" | "Weak lead",
  "suggested_angle": "<string>",
  "caution": "<string or null>",
  "why_good": ["<bullet>", "<bullet>", "<bullet>"]
}`
    : `You are scoring a potential business contact for a ${user_profession || "freelancer"} based in ${user_location || "Unknown"}.

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
    const raw = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 512, prompt });
    const parsed = parseClaudeJson<Record<string, any>>(raw);

    const score       = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const score_label = (["Strong lead", "Good lead", "Weak lead"] as const).includes(parsed.score_label)
      ? parsed.score_label as "Strong lead" | "Good lead" | "Weak lead"
      : "Good lead";
    const account_tier: "T1" | "T2" | "T3" = score >= 75 ? "T1" : score >= 50 ? "T2" : "T3";

    const result = {
      score,
      score_label,
      account_tier,
      suggested_angle: String(parsed.suggested_angle || ""),
      caution:         parsed.caution ?? null,
      why_good:        Array.isArray(parsed.why_good) ? parsed.why_good : [],
    };

    // Persist score to opportunity row if caller provides opportunity_id
    if (opportunity_id) {
      await supabase
        .from("opportunities")
        .update({
          signal_score:    score,
          score_breakdown: { account_tier, score_label, why_good: result.why_good, caution: result.caution },
          ai_analysis:     { suggested_angle: result.suggested_angle, scored_at: new Date().toISOString() },
        })
        .eq("id", opportunity_id)
        .eq("user_id", user.id);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[apollo/score] Claude failed:", err);
    return NextResponse.json({ error: "Scoring failed" }, { status: 500 });
  }
}
