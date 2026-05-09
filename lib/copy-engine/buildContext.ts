/**
 * lib/copy-engine/buildContext.ts
 *
 * Assembles the full context bundle before every Copy Engine generation call.
 * Fetches opportunity + profile from Supabase and returns a strongly typed object.
 * Used by app/api/generate-sequence/route.ts.
 */

import { createClient }  from "@/lib/supabase/server";
import { getRoleById }   from "@/lib/roles";

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

  const isApollo = opp.source === "apollo";

  // For Apollo records, contact_name/title come from the top-level columns.
  // For venue records, fall back to what Claude extracted into ai_analysis.
  const contactName  = opp.contact_name  ?? analysis.contact_name  ?? null;
  const contactTitle = opp.contact_title ?? null;

  // For Apollo records, the suggested angle was stored in why_good_fit when
  // the opportunity was created from CompanyCard. For venue records, it comes
  // from the ai_analysis JSON written by enrich-venue.
  const recommendedAngle = isApollo
    ? (opp.why_good_fit || null)
    : (analysis.recommended_angle ?? null);

  // Resolve role config (prefer role_id, fall back to roleId camelCase written by profile PATCH)
  const roleId    = prof.role_id ?? prof.roleId ?? null;
  const roleConfig = roleId ? getRoleById(roleId) : undefined;

  const senderFullName = prof.full_name ?? prof.business_name ?? prof.businessName ?? "your team";
  const senderFirstName = senderFullName.split(" ")[0];

  return {
    source: (opp.source ?? "manual") as string,
    sender: {
      name:            senderFullName,
      first_name:      senderFirstName,
      business_name:   prof.business_name ?? null,
      profession:      roleConfig?.label ?? prof.business_type ?? "photographer",
      speciality_tags: prof.speciality_tags ?? [],
      positioning:     prof.positioning ?? "mid-market",
      pitch:           prof.pitch ?? "",
      pitch_context:   roleConfig?.pitchContext ?? null,
      past_clients:    (prof.past_clients ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => (typeof c === "string" ? c : c?.name))
        .filter(Boolean),
      tone:            prof.message_tone ?? prof.tone ?? (prof.company_analysis as any)?.tone ?? "professional",
      voice_sample:    prof.voice_sample ? prof.voice_sample.trim().slice(0, 500) : null,
      location:        prof.location ?? null,
      work_radius:     prof.work_radius ?? prof.location ?? null,
      instagram:       prof.instagram ?? null,
      portfolio_url:   prof.portfolio_url ?? null,
      website:         prof.website ?? null,
      // B2B fields (null for freelancer users)
      product_description: (prof.company_analysis as any)?.description ?? null,
      value_proposition:   (prof.company_analysis as any)?.value_proposition ?? null,
      key_features:        (prof.company_analysis as any)?.key_features ?? [],
      icp_pain_points:     Object.values((prof.icp as any)?.pain_points ?? {}).flat(),
    },
    recipient: {
      venue_name:                 opp.name,
      address:                    opp.location ?? null,
      rating:                     opp.rating ?? null,
      review_count:               opp.review_count_total ?? opp.rating_count ?? null,
      price_level:                opp.price_level ?? null,
      google_summary:             opp.google_editorial_summary ?? null,
      contact_name:               contactName,
      contact_title:              contactTitle,
      contact_email:              opp.contact_email ?? analysis.contact_email ?? null,
      wedding_relevance:          analysis.wedding_relevance ?? 0,
      cultural_relevance:         analysis.cultural_relevance ?? 0,
      has_exclusive_photographer: analysis.has_exclusive_photographer ?? false,
      key_phrases:                analysis.key_phrases_for_email ?? [],
      recommended_angle:          recommendedAngle,
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
