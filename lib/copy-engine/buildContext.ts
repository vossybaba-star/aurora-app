/**
 * lib/copy-engine/buildContext.ts
 *
 * Assembles the full context bundle before every Copy Engine generation call.
 * Fetches opportunity + profile from Supabase and returns a strongly typed object.
 * Used by app/api/generate-sequence/route.ts.
 */

import { createClient } from "@/lib/supabase/server";

export async function buildCopyContext(opportunityId: string, userId: string) {
  const supabase = await createClient();

  const [{ data: opportunity }, { data: profile }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .eq("user_id", userId)
      .single(),
    supabase.from("profiles").select("*").eq("id", userId).single(),
  ]);

  if (!opportunity || !profile) {
    throw new Error("Missing opportunity or profile data");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysis: any = (opportunity as any).ai_analysis ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reviews: any[] = (opportunity as any).full_reviews ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prof = profile as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opp = opportunity as any;

  return {
    sender: {
      name:            prof.full_name ?? prof.business_name ?? prof.businessName ?? "your team",
      business_name:   prof.business_name ?? null,
      profession:      prof.business_type ?? "photographer",
      speciality_tags: prof.speciality_tags ?? [],
      positioning:     prof.positioning ?? "mid-market",
      pitch:           prof.pitch ?? "",
      past_clients:    (prof.past_clients ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => (typeof c === "string" ? c : c?.name))
        .filter(Boolean),
      tone:            prof.message_tone ?? prof.tone ?? "professional",
      voice_sample:    prof.voice_sample ? prof.voice_sample.trim().slice(0, 500) : null,
      location:        prof.location ?? null,
      work_radius:     prof.work_radius ?? prof.location ?? null,
      instagram:       prof.instagram ?? null,
      portfolio_url:   prof.portfolio_url ?? null,
      website:         prof.website ?? null,
    },
    recipient: {
      venue_name:                 opp.name,
      address:                    opp.location ?? null,
      rating:                     opp.rating ?? null,
      review_count:               opp.review_count_total ?? opp.rating_count ?? null,
      price_level:                opp.price_level ?? null,
      google_summary:             opp.google_editorial_summary ?? null,
      contact_name:               analysis.contact_name ?? null,
      contact_email:              analysis.contact_email ?? null,
      wedding_relevance:          analysis.wedding_relevance ?? 0,
      cultural_relevance:         analysis.cultural_relevance ?? 0,
      has_exclusive_photographer: analysis.has_exclusive_photographer ?? false,
      key_phrases:                analysis.key_phrases_for_email ?? [],
      recommended_angle:          analysis.recommended_angle ?? null,
      caution_note:               analysis.why_bad_lead ?? null,
      venue_vibe:                 analysis.venue_vibe_tags?.join(", ") ?? null,
      why_good_lead:              analysis.why_good_lead ?? null,
      top_review_excerpts:        reviews
        .slice(0, 3)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r.text)
        .filter(Boolean),
    },
    enrichment_available: opp.enrichment_status === "complete",
    signal_score:         opp.signal_score ?? 0,
  };
}

export type CopyContext = Awaited<ReturnType<typeof buildCopyContext>>;
