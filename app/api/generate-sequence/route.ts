/**
 * app/api/generate-sequence/route.ts
 *
 * Copy Engine — generates a personalised 4-email outreach sequence
 * (1 initial + 3 follow-ups) using enriched opportunity data and
 * the sender's full profile.
 *
 * Uses raw fetch for the Anthropic API (same pattern as other routes)
 * to avoid package resolution issues in Vercel's build cache.
 *
 * POST body: { opportunity_id: string, regenerate?: boolean }
 *
 * Flow:
 *   1. Auth + context build
 *   2. Cache check (skip if already generated and !regenerate)
 *   3. Generate initial email via Claude
 *   4. Generate 3 follow-ups sequentially (each needs prior emails for context)
 *   5. Delete old steps if regenerating, insert new steps
 *   6. Stamp opportunity with generated copy metadata
 *   7. Return result + personalisation score
 */

import { createClient }         from "@/lib/supabase/server";
import { buildCopyContext }     from "@/lib/copy-engine/buildContext";
import {
  buildSystemPrompt,
  buildInitialEmailPrompt,
  buildFollowUpPrompt,
} from "@/lib/copy-engine/buildPrompt";
import { NextResponse }         from "next/server";

// ─── Anthropic raw fetch helper ───────────────────────────────────────────────

const MODEL = "claude-opus-4-5";

async function callClaude(system: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:     MODEL,
      max_tokens: 1200,
      system,
      messages:  [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { opportunity_id?: string; regenerate?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { opportunity_id, regenerate = false } = body;
  if (!opportunity_id) {
    return NextResponse.json({ error: "opportunity_id is required" }, { status: 400 });
  }

  // ── 2. Build context ──────────────────────────────────────────────────────
  let ctx;
  try {
    ctx = await buildCopyContext(opportunity_id, user.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build context" },
      { status: 404 }
    );
  }

  // ── 3. Cache check ────────────────────────────────────────────────────────
  if (!regenerate) {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("generated_initial_email, copy_generated_at")
      .eq("id", opportunity_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = opp as any;
    if (o?.generated_initial_email && o?.copy_generated_at) {
      return NextResponse.json({
        status:    "cached",
        cached_at: o.copy_generated_at,
      });
    }
  }

  // ── 4. Generate with Claude ───────────────────────────────────────────────
  const system = buildSystemPrompt(ctx);

  if (process.env.NODE_ENV === "development") {
    console.log("[Copy Engine] Generating sequence for:", ctx.recipient.venue_name, {
      enrichment_available: ctx.enrichment_available,
      signal_score:         ctx.signal_score,
      contact_name_found:   !!ctx.recipient.contact_name,
      key_phrases_count:    ctx.recipient.key_phrases.length,
    });
  }

  // ── Step A: Initial email ──────────────────────────────────────────────
  let initialEmail: Record<string, unknown>;
  try {
    const raw = await callClaude(system, buildInitialEmailPrompt(ctx));
    initialEmail = parseJson(raw);
    if (process.env.NODE_ENV === "development") {
      console.log("[Copy Engine] Initial email generated:", {
        subject:              initialEmail.subject,
        word_count:           initialEmail.word_count,
        personalisation_score: initialEmail.personalisation_score,
      });
    }
  } catch (err) {
    console.error("[Copy Engine] Initial email failed:", err);
    return NextResponse.json(
      { error: "Failed to generate initial email", detail: String(err) },
      { status: 500 }
    );
  }

  const initialSubject = String(initialEmail.subject ?? `Working with ${ctx.recipient.venue_name}`);
  const initialBody    = String(initialEmail.body ?? "");
  const personalisationScore = Number(initialEmail.personalisation_score ?? 0);

  // ── Step B: Three follow-ups (sequential — each builds on previous) ────
  const followUps: Array<{
    subject: string;
    body:    string;
    delay_days: number;
    new_value_added?: string;
  }> = [];

  const delays = [3, 7, 10]; // days between steps

  for (let i = 1; i <= 3; i++) {
    try {
      const previousEmails = [
        { subject: initialSubject, body: initialBody },
        ...followUps.map((f) => ({ subject: f.subject, body: f.body })),
      ];

      const raw  = await callClaude(system, buildFollowUpPrompt(ctx, i, previousEmails));
      const parsed = parseJson(raw);

      const followUp = {
        subject:         String(parsed.subject ?? `Re: ${initialSubject}`),
        body:            String(parsed.body ?? ""),
        delay_days:      delays[i - 1],
        new_value_added: String(parsed.new_value_added ?? ""),
      };

      followUps.push(followUp);

      if (process.env.NODE_ENV === "development") {
        console.log(`[Copy Engine] Follow-up #${i} generated:`, {
          subject:         followUp.subject,
          new_value_added: followUp.new_value_added,
        });
      }
    } catch (err) {
      // Non-fatal: if a follow-up fails, insert a placeholder and continue
      console.error(`[Copy Engine] Follow-up #${i} failed (using placeholder):`, err);
      followUps.push({
        subject:    `Re: ${initialSubject}`,
        body:       `Hi ${ctx.recipient.contact_name ?? "there"},\n\nJust wanted to briefly follow up on my previous email.\n\nWould you be open to a quick call?\n\n${ctx.sender.name}`,
        delay_days: delays[i - 1],
      });
    }
  }

  // ── 5. Write to DB ────────────────────────────────────────────────────────

  // Delete existing steps if regenerating
  if (regenerate) {
    await supabase
      .from("email_sequence_steps")
      .delete()
      .eq("opportunity_id", opportunity_id)
      .eq("user_id", user.id);
  }

  // Build all 4 steps with scheduled dates
  let scheduledDate = new Date();
  const allSteps = [
    {
      user_id:        user.id,
      opportunity_id,
      step_number:    1,
      subject:        initialSubject,
      body:           initialBody,
      delay_days:     0,
      status:         "pending",
      scheduled_at:   scheduledDate.toISOString(),
    },
    ...followUps.map((f, i) => {
      scheduledDate = new Date(
        scheduledDate.getTime() + f.delay_days * 24 * 60 * 60 * 1000
      );
      return {
        user_id:        user.id,
        opportunity_id,
        step_number:    i + 2,
        subject:        f.subject,
        body:           f.body,
        delay_days:     f.delay_days,
        status:         "pending",
        scheduled_at:   scheduledDate.toISOString(),
      };
    }),
  ];

  const { error: insertError } = await supabase
    .from("email_sequence_steps")
    .insert(allSteps);

  if (insertError) {
    console.error("[Copy Engine] DB insert failed:", insertError);
    return NextResponse.json(
      { error: "Failed to save sequence", detail: insertError.message },
      { status: 500 }
    );
  }

  // Stamp the opportunity with the generated copy metadata
  await supabase
    .from("opportunities")
    .update({
      generated_initial_email: initialBody,
      generated_subject_lines: [
        initialSubject,
        ...((initialEmail.subject_alternatives as string[]) ?? []),
      ],
      copy_generated_at: new Date().toISOString(),
      copy_model_used:   MODEL,
    } as Record<string, unknown>)
    .eq("id", opportunity_id);

  // ── 6. Return ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    status:        "generated",
    initial_email: { subject: initialSubject, body: initialBody },
    follow_ups:    followUps,
    personalisation_score: personalisationScore,
    context_used: {
      enrichment_available:  ctx.enrichment_available,
      signal_score:          ctx.signal_score,
      contact_name_found:    !!ctx.recipient.contact_name,
      key_phrases_count:     ctx.recipient.key_phrases.length,
    },
  });
}
