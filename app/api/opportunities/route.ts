import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpportunities } from "@/lib/actions";

export async function GET() {
  try {
    const opportunities = await getOpportunities();
    return NextResponse.json({ data: opportunities, success: true });
  } catch (error) {
    return NextResponse.json({ data: [], success: false, error: "Failed to fetch opportunities" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // ── If a google_place_id is provided, check for an existing record first ──
    // This handles venues already saved via AI Find (avoids unique-constraint 500)
    if (body.googlePlaceId) {
      const { data: existing } = await supabase
        .from("opportunities")
        .select("id")
        .eq("google_place_id", body.googlePlaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Already in their pipeline — return ID so generate-sequence can proceed
        return NextResponse.json({ success: true, id: existing.id, existed: true });
      }
    }

    // ── Priority from signal score (passed from client when card was expanded) ──
    const signalScore = body.signalScore != null ? Number(body.signalScore) : null;
    const priority =
      signalScore != null && signalScore >= 70 ? "high"   :
      signalScore != null && signalScore >= 40 ? "medium" :
      signalScore != null                       ? "low"    :
      body.priority || "medium";

    // ── Core insert (same columns as original, plus enrichment_status) ─────────
    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .insert({
        user_id:         user.id,
        name:            body.name,
        type:            body.type || "venue",
        location:        body.location || null,
        description:     body.description || null,
        why_good_fit:    body.whyGoodFit || null,
        status:          body.status || "new",
        priority,
        tags:            body.tags || [],
        source:          body.source || "manual",
        website:         body.website || null,
        notes:           body.notes || null,
        liked:           body.liked ?? false,
        google_place_id: body.googlePlaceId || null,
        rating:          body.rating || null,
        rating_count:    body.ratingCount || null,
        photo_reference: body.photoReference || null,
        // Mark as pending so the enrichment pipeline fills in AI fields
        enrichment_status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("[opportunities] Insert error:", error.code, error.message);

      // Unique-constraint race condition (two tabs / double-click) — return existing
      if (error.code === "23505" && body.googlePlaceId) {
        const { data: conflict } = await supabase
          .from("opportunities")
          .select("id")
          .eq("google_place_id", body.googlePlaceId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (conflict) {
          return NextResponse.json({ success: true, id: conflict.id, existed: true });
        }
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Contact methods ───────────────────────────────────────────────────────
    if (body.contactMethods && body.contactMethods.length > 0) {
      const contactMethodsToInsert = body.contactMethods.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cm: any, index: number) => ({
          opportunity_id: opportunity.id,
          type:       cm.type,
          value:      cm.value,
          is_primary: cm.isPrimary ?? index === 0,
          label:      cm.label || null,
        })
      );
      await supabase.from("contact_methods").insert(contactMethodsToInsert);
    }

    return NextResponse.json({ success: true, id: opportunity.id });
  } catch (error) {
    console.error("[opportunities] Unhandled error:", error);
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}
