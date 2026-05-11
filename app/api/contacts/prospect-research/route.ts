/**
 * POST /api/contacts/prospect-research
 *
 * Applies the prospect-research-integration sales skill:
 * trigger detection + personalisation angles + hooks for a specific contact.
 *
 * Fast path — uses Haiku, returns in ~2s.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic/client";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      recipient_first_name,
      recipient_last_name,
      recipient_title,
      company_name,
      company_description,
      company_industry,
      latest_funding_stage,
      headcount_growth,
      suggested_angle,
      icp_pain_points,
      icp_goals,
    } = await req.json();

    if (!recipient_first_name || !company_name)
      return NextResponse.json({ error: "recipient_first_name and company_name required" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name, pitch, company_analysis")
      .eq("id", user.id)
      .single();

    const senderName     = profile?.full_name || profile?.business_name || "the sender";
    const senderValueProp = (profile?.company_analysis as { value_proposition?: string } | null)?.value_proposition
                          ?? profile?.pitch ?? "";

    // Build trigger context from company signals
    const triggers: string[] = [];
    if (latest_funding_stage?.match(/seed|series [a-c]/i))
      triggers.push(`Recently raised ${latest_funding_stage} — actively building out their stack`);
    if (headcount_growth && headcount_growth > 0.08)
      triggers.push(`${Math.round(headcount_growth * 100)}% headcount growth in 6 months — scaling fast`);

    const prompt = `You are a B2B sales research assistant. Apply the prospect-research-integration methodology to generate hyper-specific outreach intelligence for one prospect.

SELLER: ${senderName}
SELLER VALUE PROP: ${senderValueProp || "B2B software/services"}

PROSPECT:
- Name: ${recipient_first_name}${recipient_last_name ? ` ${recipient_last_name}` : ""}
- Title: ${recipient_title ?? "Unknown"}
- Company: ${company_name}${company_industry ? ` (${company_industry})` : ""}
- Company summary: ${company_description ?? "Not available"}
${triggers.length ? `- Timing signals: ${triggers.join("; ")}` : ""}

KNOWN ICP DATA:
- Pain points for this role: ${Array.isArray(icp_pain_points) && icp_pain_points.length ? icp_pain_points.join("; ") : "Not specified"}
- Goals for this role: ${Array.isArray(icp_goals) && icp_goals.length ? icp_goals.join("; ") : "Not specified"}

INITIAL ANGLE: ${suggested_angle || "None set"}

Generate SPECIFIC, NON-GENERIC research for ${recipient_first_name}:

1. Three personalisation angles — each must reference their exact title, company context, or a timing signal. Not generic pain points. Each max 20 words.
2. Two outreach hooks — specific openers or observations that would make ${recipient_first_name} stop and engage. Reference a real signal (funding, growth, role, industry trend). Each max 20 words.

Return JSON only:
{
  "angles": ["<angle 1>", "<angle 2>", "<angle 3>"],
  "hooks":  ["<hook 1>", "<hook 2>"]
}`;

    const raw = await callClaude({
      model:     "claude-haiku-4-5-20251001",
      maxTokens: 400,
      prompt,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Failed to parse research" }, { status: 500 });

    return NextResponse.json(JSON.parse(jsonMatch[0]));

  } catch (err) {
    console.error("[contacts/prospect-research]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
