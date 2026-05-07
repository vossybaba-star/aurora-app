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
  // ── Verify cron secret — always required, no fallback ───────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[nightly-enrichment] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // ── Nurture sequence: send due steps ─────────────────────────────────────
  let nurturesSent = 0;

  if (process.env.NYLAS_API_KEY) {
    const now = new Date().toISOString();

    // Step 2: due today
    const { data: step2Due } = await service
      .from("nurture_sequences")
      .select(`
        id, contact_id, user_id,
        step2_subject, step2_body, step2_send_at, step2_sent_at
      `)
      .eq("status", "active")
      .lte("step2_send_at", now)
      .is("step2_sent_at", null)
      .limit(20);

    // Step 3: due today
    const { data: step3Due } = await service
      .from("nurture_sequences")
      .select(`
        id, contact_id, user_id,
        step3_subject, step3_body, step3_send_at, step3_sent_at
      `)
      .eq("status", "active")
      .lte("step3_send_at", now)
      .is("step3_sent_at", null)
      .limit(20);

    const sendNurture = async (
      seqId:     string,
      contactId: string,
      userId:    string,
      subject:   string,
      body:      string,
      step:      2 | 3
    ) => {
      // Load contact email
      const { data: contact } = await service
        .from("contacts")
        .select("email, name, unsubscribed_at")
        .eq("id", contactId)
        .single();

      if (!contact?.email || contact.unsubscribed_at) return false;

      // Load user's Nylas grant from email_connections
      const { data: emailConn } = await service
        .from("email_connections")
        .select("grant_id, email")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      if (!emailConn?.grant_id) {
        console.warn(`[nightly-enrichment] No active email connection for user ${userId} — skipping nurture`);
        return false;
      }

      // Load user profile for display name
      const { data: profile } = await service
        .from("profiles")
        .select("business_name")
        .eq("id", userId)
        .single();

      const nylasApiUri = process.env.NYLAS_API_URI ?? "https://api.us.nylas.com";

      // Send via Nylas using the user's own grant ID
      try {
        const res = await fetch(
          `${nylasApiUri}/v3/grants/${emailConn.grant_id}/messages/send`,
          {
            method:  "POST",
            headers: {
              Authorization:  `Bearer ${process.env.NYLAS_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subject,
              body,
              to: [{ name: contact.name, email: contact.email }],
              from: emailConn.email
                ? [{ name: profile?.business_name ?? "Aurora", email: emailConn.email }]
                : undefined,
            }),
          }
        );

        if (!res.ok) {
          console.error("[nightly-enrichment] Nylas send failed", await res.text());
          return false;
        }

        // Mark as sent
        const sentCol = step === 2 ? "step2_sent_at" : "step3_sent_at";
        await service
          .from("nurture_sequences")
          .update({ [sentCol]: now })
          .eq("id", seqId);

        // If step 3 sent → mark sequence complete
        if (step === 3) {
          await service.from("nurture_sequences").update({ status: "completed" }).eq("id", seqId);
        }

        // Log interaction
        await service.from("contact_interactions").insert({
          user_id:      userId,
          contact_id:   contactId,
          type:         "nurture_sent",
          subject,
          body,
          direction:    "outbound",
          nurture_step: step,
          occurred_at:  now,
        });

        return true;
      } catch (err) {
        console.error("[nightly-enrichment] Nylas error:", err);
        return false;
      }
    };

    for (const seq of step2Due ?? []) {
      const sent = await sendNurture(seq.id, seq.contact_id, seq.user_id, seq.step2_subject ?? "", seq.step2_body ?? "", 2);
      if (sent) nurturesSent++;
    }

    for (const seq of step3Due ?? []) {
      const sent = await sendNurture(seq.id, seq.contact_id, seq.user_id, seq.step3_subject ?? "", seq.step3_body ?? "", 3);
      if (sent) nurturesSent++;
    }
  }

  return NextResponse.json({
    status:       "complete",
    processed,
    failed,
    total:        toProcess.length,
    nurtures_sent: nurturesSent,
  });
}
