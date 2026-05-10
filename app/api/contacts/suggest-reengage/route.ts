/**
 * app/api/contacts/suggest-reengage/route.ts
 *
 * Generates a personalised re-engagement suggestion for a single contact.
 * Results are cached in contacts.ai_notes for 24 hours.
 *
 * Raw fetch only — no SDK imports.
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { callClaude } from "@/lib/anthropic/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id } = await req.json();
  if (!contact_id) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  // ── Load contact ──────────────────────────────────────────────────────────
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, email, relationship_type, last_contacted_at, tags, ai_notes, ai_notes_updated_at, status")
    .eq("id", contact_id)
    .eq("user_id", user.id)
    .single();

  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  // ── 24-hour cache check ───────────────────────────────────────────────────
  if (contact.ai_notes && contact.ai_notes_updated_at) {
    const ageMs = Date.now() - new Date(contact.ai_notes_updated_at).getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ suggestion: contact.ai_notes, cached: true });
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  // ── Load recent interactions ──────────────────────────────────────────────
  const { data: interactions } = await supabase
    .from("contact_interactions")
    .select("type, subject, occurred_at")
    .eq("contact_id", contact_id)
    .order("occurred_at", { ascending: false })
    .limit(5);

  const interactionSummary = interactions?.length
    ? interactions.map(i => `${i.type} on ${i.occurred_at?.slice(0, 10)}: ${i.subject ?? "(no subject)"}`).join("\n")
    : "No interactions logged.";

  const daysSince = contact.last_contacted_at
    ? Math.round((Date.now() - new Date(contact.last_contacted_at).getTime()) / 86400000)
    : null;

  const prompt = `Analyse this contact and suggest one specific, actionable re-engagement idea (2-4 sentences max).

Contact: ${contact.name}
Relationship: ${contact.relationship_type}
Last contacted: ${daysSince !== null ? `${daysSince} days ago` : "never"}
Tags: ${contact.tags?.join(", ") || "none"}
Recent interactions:
${interactionSummary}

Suggest something concrete and timely — e.g., "Send them your winter wedding portfolio since it's been 3 months" or "Check in ahead of the Christmas party season." No generic advice.`;

  try {
    const suggestion = (await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 200, prompt })).trim();

    // Cache result
    await supabase.from("contacts").update({
      ai_notes:            suggestion,
      ai_notes_updated_at: new Date().toISOString(),
    }).eq("id", contact_id);

    return NextResponse.json({ suggestion, cached: false });
  } catch (err) {
    console.error("[suggest-reengage] Error:", err);
    return NextResponse.json({ error: "Failed to generate suggestion" }, { status: 500 });
  }
}
