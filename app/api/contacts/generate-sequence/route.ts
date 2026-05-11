import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic/client";

const STEPS = [
  { step: 1, day: 1,  label: "Trigger hook"   },
  { step: 2, day: 3,  label: "Value add"      },
  { step: 3, day: 6,  label: "Social proof"   },
  { step: 4, day: 9,  label: "New angle"      },
  { step: 5, day: 12, label: "Question-led"   },
  { step: 6, day: 16, label: "Resource share" },
  { step: 7, day: 21, label: "Referral ask"   },
  { step: 8, day: 27, label: "Graceful exit"  },
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const {
      company_name,
      company_description,
      company_industry,
      recipient_first_name,
      recipient_title,
      angle,
      persona_type = "champion",
    } = await req.json();

    if (!company_name || !recipient_first_name)
      return NextResponse.json({ error: "company_name and recipient_first_name required" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name, pitch, company_analysis")
      .eq("id", user.id)
      .single();

    const senderName = profile?.full_name || profile?.business_name || "the sender";
    const valueProp  = (profile?.company_analysis as { value_proposition?: string } | null)?.value_proposition
                    ?? profile?.pitch ?? "";

    const roleFrame = persona_type === "decision_maker"
      ? "This is a Decision Maker (C-suite / Head of). Keep opening lines executive — outcomes, ROI, strategic risk."
      : "This is a Champion (mid-level buyer / daily user). Keep opening lines practical — workflow pain, ease of adoption.";

    const prompt = `Generate personalised opening lines for an 8-touch B2B email sequence.

SENDER: ${senderName}
VALUE PROP: ${valueProp || "Not specified"}
RECIPIENT: ${recipient_first_name}${recipient_title ? `, ${recipient_title}` : ""}
COMPANY: ${company_name}${company_industry ? ` (${company_industry})` : ""}${company_description ? ` — ${company_description}` : ""}
OUTREACH ANGLE: ${angle || "General introduction"}
${roleFrame}

For each of the 8 sequence steps below, write a single opening line (max 20 words) that is specific to this recipient and angle. The opening line is the first sentence of the email only — no greeting, no full email.

Steps:
1. Trigger hook (Day 1) — lead with the research signal / angle above
2. Value add (Day 3) — connect offering to their workflow pain
3. Social proof (Day 6) — reference a peer company or relevant outcome
4. New angle (Day 9) — different pain point, don't repeat step 2
5. Question-led (Day 12) — open question inviting a reply
6. Resource share (Day 16) — offer something useful with no hard ask
7. Referral ask (Day 21) — ask if there's someone better placed
8. Graceful exit (Day 27) — low-pressure close, leave door open

Return a JSON array of exactly 8 objects:
[{ "step": 1, "preview": "<opening line>" }, ...]`;

    const raw = await callClaude({
      model:     "claude-haiku-4-5-20251001",
      maxTokens: 600,
      prompt,
    });

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch)
      return NextResponse.json({ error: "Failed to parse sequence from AI" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ step: number; preview: string }>;

    const steps = STEPS.map((s, i) => ({
      ...s,
      preview: parsed[i]?.preview ?? "",
    }));

    return NextResponse.json({ steps });

  } catch (err) {
    console.error("[contacts/generate-sequence]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
