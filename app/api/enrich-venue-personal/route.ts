/**
 * app/api/enrich-venue-personal/route.ts
 *
 * Tier 2 — Personalised venue analysis for a specific user + opportunity.
 * Called after Tier 1 has completed (or triggers Tier 1 if not yet done).
 *
 * Pipeline:
 *   1. Auth + load opportunity + profile
 *   2. Ensure Tier 1 (global venues) is complete; wait or trigger
 *   3. Copy Tier 1 contact intel into opportunity row
 *   4. Claude personalised analysis (using profile + venue_summary from Tier 1)
 *   5. Update opportunity with personal_analysis, personal_score
 *
 * Raw fetch only — no SDK imports.
 */

import { NextResponse } from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { opportunity_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { opportunity_id } = body;
  if (!opportunity_id) {
    return NextResponse.json({ error: "opportunity_id required" }, { status: 400 });
  }

  // ── 3. Load opportunity + profile ─────────────────────────────────────────
  const [oppRes, profileRes] = await Promise.all([
    supabase
      .from("opportunities")
      .select(
        "id, name, location, website, google_place_id, rating, rating_count, " +
        "photo_reference, why_good_fit, instagram_handle, instagram_url, " +
        "contact_email, contact_email_type, contact_form_url, has_contact_form"
      )
      .eq("id", opportunity_id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opp     = oppRes.data     as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = profileRes.data as any;

  if (!opp || !profile) {
    return NextResponse.json({ error: "Opportunity or profile not found" }, { status: 404 });
  }

  // ── 4. Look up or trigger Tier 1 ─────────────────────────────────────────
  const service = createServiceClient();
  let venue: Record<string, unknown> | null = null;

  if (opp.google_place_id) {
    const venueRes = await service
      .from("venues")
      .select(
        "id, instagram_handle, instagram_url, contact_email, contact_email_type, " +
        "contact_form_url, has_contact_form, venue_summary, venue_vibe_tags, " +
        "venue_capacity, price_tier, hosts_weddings, enrichment_status"
      )
      .eq("google_place_id", opp.google_place_id)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = venueRes.data as any;

    if (existing?.enrichment_status === "complete") {
      venue = existing as Record<string, unknown>;
    } else {
      // Trigger Tier 1 fire-and-forget
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      fetch(`${appUrl}/api/enrich-venue-global`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${process.env.CRON_SECRET ?? ""}`,
        },
        body: JSON.stringify({
          google_place_id:   opp.google_place_id,
          name:              opp.name,
          website:           opp.website       ?? null,
          formatted_address: opp.location      ?? null,
          rating:            opp.rating        ?? null,
          rating_count:      opp.rating_count  ?? null,
          photo_reference:   opp.photo_reference ?? null,
        }),
      }).catch(err => console.warn("[enrich-venue-personal] Tier 1 trigger failed:", err));
    }
  }

  // ── 5. Copy Tier 1 contact intel into opportunity ─────────────────────────
  if (venue) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactUpdate: Record<string, any> = {
      venue_id:           venue.id,
      instagram_handle:   opp.instagram_handle   ?? venue.instagram_handle   ?? null,
      instagram_url:      (opp as any).instagram_url  ?? venue.instagram_url  ?? null,
      contact_email:      (opp as any).contact_email  ?? venue.contact_email  ?? null,
      contact_email_type: (opp as any).contact_email_type ?? venue.contact_email_type ?? null,
      contact_form_url:   (opp as any).contact_form_url  ?? venue.contact_form_url  ?? null,
      has_contact_form:   (opp as any).has_contact_form  ?? venue.has_contact_form  ?? false,
    };

    await supabase.from("opportunities").update(contactUpdate).eq("id", opportunity_id);
  }

  // ── 6. Claude personalised analysis ──────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ status: "no_api_key", venue_id: venue?.id ?? null });
  }

  const profileContext = [
    profile.business_name || profile.full_name
      ? `Photographer/business: ${profile.business_name || profile.full_name}`
      : null,
    profile.business_type   ? `Type: ${profile.business_type}`                     : null,
    profile.location        ? `Based in: ${profile.location}`                      : null,
    profile.pitch           ? `Pitch: ${profile.pitch}`                            : null,
    profile.speciality_tags?.length
      ? `Specialities: ${profile.speciality_tags.join(", ")}`                      : null,
    profile.positioning     ? `Market positioning: ${profile.positioning}`          : null,
  ].filter(Boolean).join("\n");

  const venueContext = venue
    ? [
        venue.venue_summary      ? `Summary: ${venue.venue_summary}` : null,
        Array.isArray(venue.venue_vibe_tags) && (venue.venue_vibe_tags as string[]).length
          ? `Vibe: ${(venue.venue_vibe_tags as string[]).join(", ")}` : null,
        venue.venue_capacity     ? `Capacity: ~${venue.venue_capacity}` : null,
        venue.hosts_weddings     ? "Hosts weddings: yes"                : null,
        venue.price_tier         ? `Price tier: ${venue.price_tier}`    : null,
      ].filter(Boolean).join("\n")
    : "";

  const personalPrompt = `You are analysing a venue as a potential outreach lead for a creative professional.

PROFESSIONAL PROFILE:
${profileContext || "Independent creative professional."}

VENUE:
Name: ${opp.name}
Location: ${opp.location ?? "unknown"}
Rating: ${opp.rating ?? "N/A"} (${opp.rating_count ?? 0} reviews)
${venueContext ? `\nVENUE INTELLIGENCE:\n${venueContext}` : ""}
${opp.why_good_fit ? `\nInitial assessment: ${opp.why_good_fit}` : ""}

Provide a personalised assessment. Return ONLY this JSON (no markdown):
{
  "fit_score": <0-100 integer — how well this venue fits this specific professional>,
  "outreach_urgency": <"high"|"medium"|"low">,
  "personalised_angle": "<1 sentence — the most compelling opening line for outreach>",
  "key_personalisation_hooks": ["<2-3 specific details from the venue to reference>"],
  "best_channel": "<email|instagram|phone|contact_form>",
  "timing_advice": "<1 sentence — when/how to reach out for best response>",
  "red_flags": "<1 sentence or null — any concerns>",
  "confidence": "<high|medium|low>"
}`;

  let personalAnalysis: Record<string, unknown> | null = null;
  let personalScore: number | null = null;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages:   [{ role: "user", content: personalPrompt }],
      }),
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const text   = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g, "").trim();
      personalAnalysis = JSON.parse(text);
      personalScore    = typeof personalAnalysis?.fit_score === "number"
        ? Math.max(0, Math.min(100, personalAnalysis.fit_score as number))
        : null;
    }
  } catch (err) {
    console.warn("[enrich-venue-personal] Claude personal analysis failed (non-fatal):", err);
  }

  // ── 7. Persist personal analysis ─────────────────────────────────────────
  if (personalAnalysis) {
    await supabase
      .from("opportunities")
      .update({
        personal_analysis:        personalAnalysis,
        personal_score:           personalScore,
        personal_analysis_status: "complete",
      })
      .eq("id", opportunity_id);
  }

  return NextResponse.json({
    status:            "complete",
    personal_score:    personalScore,
    personal_analysis: personalAnalysis,
    venue_id:          venue?.id ?? null,
  });
}
