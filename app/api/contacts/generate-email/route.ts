import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic/client";
import type { ICP, CompanyAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      recipient_first_name,
      recipient_title,
      company_name,
      company_description,
      company_industry,
      contact_role,   // "champion" | "decision_maker"
      angle,
    } = await req.json();

    if (!recipient_first_name || !company_name)
      return NextResponse.json({ error: "recipient_first_name and company_name required" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name, pitch, icp, company_analysis, positioning")
      .eq("id", user.id)
      .single();

    const icp             = profile?.icp             as ICP             | undefined;
    const companyAnalysis = profile?.company_analysis as CompanyAnalysis | undefined;

    const senderName     = profile?.full_name || profile?.business_name || "the sender";
    const valueProp      = companyAnalysis?.value_proposition ?? companyAnalysis?.description ?? profile?.pitch ?? "";
    const positioning    = (profile?.positioning as string) ?? "";

    // Champion = pain-focused, workflow, day-to-day value
    // DM = ROI, strategic, business outcome
    const roleFrame = contact_role === "decision_maker"
      ? "Frame the email around ROI, strategic outcomes, and business impact. Keep it executive-level — one key idea, clear ask. No jargon."
      : "Frame the email around day-to-day workflow pain, ease of adoption, and making their job easier. Speak to a practitioner, not a board.";

    const prompt = `You are writing a cold outreach email on behalf of ${senderName}.

SENDER CONTEXT:
- Value proposition: ${valueProp || "Not specified"}
- Positioning: ${positioning || "Not specified"}
- ICP industries: ${icp?.industries?.join(", ") || "Not specified"}

RECIPIENT:
- First name: ${recipient_first_name}
- Title: ${recipient_title || "Not specified"}
- Company: ${company_name}
- Industry: ${company_industry || "Not specified"}
- About the company: ${company_description || "Not specified"}
- Contact type: ${contact_role === "decision_maker" ? "Decision Maker (C-suite / Head of)" : "Champion (mid-level buyer / daily user)"}

OUTREACH ANGLE: ${angle || "General introduction"}

RULES:
- ${roleFrame}
- Subject line: specific, no fluff, no "I hope this finds you well"
- Body: max 4 short paragraphs — hook, relevance, value, CTA
- CTA: one simple ask (15-min call, reply, or specific question)
- Do NOT use the word "synergies", "leverage", "excited to", or "reach out"
- Personalise the opening using the company name or angle

Return JSON only:
{
  "subject": "<subject line>",
  "body": "<full email body, paragraphs separated by \\n\\n>"
}`;

    const raw = await callClaude({
      model: "claude-sonnet-4-6",
      maxTokens: 800,
      prompt,
    });

    // Parse JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Failed to parse email from AI" }, { status: 500 });

    const email = JSON.parse(jsonMatch[0]) as { subject: string; body: string };
    return NextResponse.json(email);

  } catch (err) {
    console.error("[contacts/generate-email]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
