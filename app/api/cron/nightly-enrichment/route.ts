/**
 * app/api/cron/nightly-enrichment/route.ts
 *
 * Nightly Tier 1 enrichment cron.
 * Vercel Cron calls this at 01:00 UTC daily (configured in vercel.json).
 *
 * Processes:
 *   • venues with enrichment_status = 'pending' (new global entries)
 *   • venues with enrichment_status = 'complete' AND last_enriched_at > 30 days
 *
 * Hard limit: 50 venues per run (Vercel hobby plan function timeout ~60 s).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const BATCH_LIMIT = 50;

export async function GET(req: Request) {
  // ── Verify cron secret ────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const service = createServiceClient();
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // ── Fetch venues needing enrichment ───────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: pendingVenues } = await service
    .from("venues")
    .select("id, google_place_id, name, website, formatted_address, rating, rating_count, photo_reference, types")
    .or(`enrichment_status.eq.pending,and(enrichment_status.eq.complete,last_enriched_at.lt.${thirtyDaysAgo})`)
    .limit(BATCH_LIMIT);

  if (!pendingVenues?.length) {
    return NextResponse.json({ status: "nothing_to_process", processed: 0 });
  }

  // ── Also find opportunities with pending google_place_ids not yet in venues ──
  const { data: pendingOpps } = await service
    .from("opportunities")
    .select("google_place_id, name, website, location, rating, rating_count, photo_reference")
    .eq("enrichment_status", "pending")
    .not("google_place_id", "is", null)
    .limit(BATCH_LIMIT - pendingVenues.length);

  // Merge: venues first, then opps that aren't already covered
  const venuePlaceIds = new Set(pendingVenues.map(v => v.google_place_id));
  const extraOpps = (pendingOpps ?? []).filter(o => !venuePlaceIds.has(o.google_place_id));

  const toProcess = [
    ...pendingVenues.map(v => ({
      google_place_id:   v.google_place_id,
      name:              v.name,
      website:           v.website,
      formatted_address: v.formatted_address,
      rating:            v.rating,
      rating_count:      v.rating_count,
      photo_reference:   v.photo_reference,
      types:             v.types,
    })),
    ...extraOpps.map(o => ({
      google_place_id:   o.google_place_id,
      name:              o.name,
      website:           o.website,
      formatted_address: o.location,
      rating:            o.rating,
      rating_count:      o.rating_count,
      photo_reference:   o.photo_reference,
      types:             null,
    })),
  ];

  // ── Process venues sequentially (rate limiting) ───────────────────────────
  let processed = 0;
  let failed    = 0;

  for (const venue of toProcess) {
    try {
      const res = await fetch(`${appUrl}/api/enrich-venue-global`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${cronSecret ?? ""}`,
        },
        body: JSON.stringify(venue),
      });

      if (res.ok) {
        processed++;
      } else {
        failed++;
        console.error("[nightly-enrichment] Failed for", venue.name, res.status);
      }
    } catch (err) {
      failed++;
      console.error("[nightly-enrichment] Error for", venue.name, err);
    }

    // Small delay to avoid rate-limiting Firecrawl / Anthropic
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({
    status:    "complete",
    processed,
    failed,
    total:     toProcess.length,
  });
}
