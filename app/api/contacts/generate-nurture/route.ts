/**
 * app/api/contacts/generate-nurture/route.ts
 *
 * Generates a 3-email re-engagement nurture sequence for a contact.
 * Uses Claude Sonnet. Upserts into nurture_sequences table.
 * Schedules step 2 = +7 days, step 3 = +14 days from now.
 *
 * Raw fetch only — no SDK imports.
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";

interface NurtureEmail {
  subject: string;
  body:    string;
}

interface NurtureSequence {
  email1: NurtureEmail;
  email2: NurtureEmail;
  email3: NurtureEmail;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id } = await req.json();
  if (!contact_id) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  // ── Load contact + user profile ───────────────────────────────────────────
  const [{ data: contact }, { data: profile }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, email, relationship_type, tags, ai_notes")
      .eq("id", contact_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("business_name, business_type, pitch, tone, location, website, instagram, calendly_url")
      .eq("id", user.id)
      .single(),
  ]);

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  if (!contact.email) return NextResponse.json({ error: "Contact has no email address" }, { status: 422 });

  // ── Check for existing sequence ───────────────────────────────────────────
  const { data: existing } = await supabase
    .from("nurture_sequences")
    .select("id, status")
    .eq("contact_id", contact_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "An active nurture sequence already exists for this contact" }, { status: 409 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // ── App base URL for unsubscribe link ─────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourapp.com";
  const { data: contactFull } = await supabase
    .from("contacts")
    .select("unsubscribe_token")
    .eq("id", contact_id)
    .single();
  const unsubUrl = `${appUrl}/unsubscribe/${contactFull?.unsubscribe_token ?? "TOKEN"}`;

  const tone      = profile?.tone ?? "professional";
  const bizName   = profile?.business_name ?? "us";
  const bizType   = profile?.business_type ?? "photographer";
  const pitch     = profile?.pitch ?? "";
  const calendly  = profile?.calendly_url ?? "";
  const website   = profile?.website ?? "";

  const toneGuide: Record<string, string> = {
    friendly:     "warm, conversational, first-name basis, upbeat",
    professional: "polished, clear, respectful, outcome-focused",
    premium:      "refined, concise, confident, luxury-adjacent",
    casual:       "relaxed, genuine, like a friend, emoji ok",
  };

  const prompt = `You are writing a 3-email re-engagement nurture sequence on behalf of ${bizName}, a ${bizType}.

Contact: ${contact.name}
Relationship: ${contact.relationship_type}
AI notes: ${contact.ai_notes ?? "none"}
Sender pitch: ${pitch}
Tone: ${toneGuide[tone] ?? tone}
${calendly ? `Calendly link: ${calendly}` : ""}
${website ? `Website: ${website}` : ""}
Unsubscribe URL: ${unsubUrl}

Rules:
- Email 1 (send now): Warm re-connection. Reference the relationship. No hard sell.
- Email 2 (send in 7 days): Light value add — tip, case study, or insight. Soft CTA.
- Email 3 (send in 14 days): Final gentle nudge. Clear CTA (book call / reply). Include unsubscribe link in footer.
- Every email: include a plain-text "Unsubscribe: ${unsubUrl}" at the very bottom.
- Subject lines: short (under 50 chars), no spam words.
- Body: 80-150 words each. Plain text, no HTML.

Return ONLY valid JSON (no markdown):
{
  "email1": { "subject": "...", "body": "..." },
  "email2": { "subject": "...", "body": "..." },
  "email3": { "subject": "...", "body": "..." }
}`;

  let sequence: NurtureSequence;
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-5-20251001",
        max_tokens: 1500,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json();
      console.error("[generate-nurture] Claude error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const aiData  = await aiRes.json();
    const rawText = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g, "").trim();
    sequence = JSON.parse(rawText) as NurtureSequence;
  } catch (err) {
    console.error("[generate-nurture] Parse error:", err);
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  // ── Schedule times ────────────────────────────────────────────────────────
  const now       = new Date();
  const step2At   = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000);
  const step3At   = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // ── Upsert sequence ───────────────────────────────────────────────────────
  const upsertData = {
    user_id:       user.id,
    contact_id,
    step1_subject: sequence.email1.subject,
    step1_body:    sequence.email1.body,
    step2_subject: sequence.email2.subject,
    step2_body:    sequence.email2.body,
    step2_send_at: step2At.toISOString(),
    step3_subject: sequence.email3.subject,
    step3_body:    sequence.email3.body,
    step3_send_at: step3At.toISOString(),
    status:        "draft",
    generated_at:  now.toISOString(),
    updated_at:    now.toISOString(),
  };

  const { data: upserted, error: upsertErr } = existing
    ? await supabase.from("nurture_sequences").update(upsertData).eq("id", existing.id).select("id").single()
    : await supabase.from("nurture_sequences").insert(upsertData).select("id").single();

  if (upsertErr) {
    console.error("[generate-nurture] Upsert failed:", upsertErr);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  return NextResponse.json({
    sequence_id: upserted?.id,
    ...sequence,
    step2_send_at: step2At.toISOString(),
    step3_send_at: step3At.toISOString(),
  });
}
