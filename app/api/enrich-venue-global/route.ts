/**
 * app/api/enrich-venue-global/route.ts
 *
 * Tier 1 — Global venue intelligence.
 * Writes to the shared `venues` table via service role (bypasses RLS).
 * Called by:
 *   • find-opportunities (fire-and-forget per venue)
 *   • nightly-enrichment cron (for pending venues)
 *   • enrich-venue-personal (as a prerequisite)
 *
 * Pipeline:
 *   1. Check 30-day cache in `venues` table
 *   2. Firecrawl website scrape
 *   3. Regex contact extraction (Instagram, email, contact form)
 *   4. Claude gap-fill for anything regex missed
 *   5. Claude generic venue analysis (summary, vibe, capacity, etc.)
 *   6. Upsert into `venues`
 *
 * Raw fetch only — no SDK imports (Vercel build reliability rule).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  extractInstagramRegex,
  extractEmailRegex,
  extractContactFormRegex,
  buildContactExtractionPrompt,
} from "@/lib/venues/extractContact";

// ─── Instagram search fallback ────────────────────────────────────────────────

async function searchInstagramHandle(venueName: string): Promise<string | null> {
  if (!process.env.FIRECRAWL_API_KEY) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query:         `"${venueName}" instagram`,
        limit:         5,
        lang:          "en",
        scrapeOptions: { formats: [] },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results: Array<{ url?: string; description?: string }> = data.data ?? [];

    const NON_HANDLES = new Set([
      "p", "reel", "reels", "stories", "explore", "accounts",
      "tv", "ar", "about", "legal", "privacy", "help", "direct",
    ]);

    for (const r of results) {
      for (const text of [r.url ?? "", r.description ?? ""]) {
        const match = text.match(
          /instagram\.com\/([a-zA-Z0-9][a-zA-Z0-9_.]{1,29})(?:[\s/?#"')\]]|$)/
        );
        if (match) {
          const candidate = match[1].replace(/\.$/, "");
          if (!NON_HANDLES.has(candidate.toLowerCase())) return `@${candidate}`;
        }
      }
    }
  } catch { /* non-fatal */ }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VenueInput {
  google_place_id:   string;
  name:              string;
  website?:          string | null;
  formatted_address?: string | null;
  phone?:            string | null;
  rating?:           number | null;
  rating_count?:     number | null;
  photo_reference?:  string | null;
  types?:            string[] | null;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── Auth: require INTERNAL_API_SECRET or CRON_SECRET ─────────────────────
  // isSelf (Host-header check) was removed — Host headers are caller-controlled
  // and trivially spoofable. Always require an explicit secret.
  const authHeader = req.headers.get("authorization");
  const isInternal = process.env.INTERNAL_API_SECRET
    ? authHeader === `Bearer ${process.env.INTERNAL_API_SECRET}`
    : false;
  const isCron = process.env.CRON_SECRET
    ? authHeader === `Bearer ${process.env.CRON_SECRET}`
    : false;

  if (!isInternal && !isCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: VenueInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { google_place_id, name, website, formatted_address, phone, rating, rating_count, photo_reference, types } = body;

  if (!google_place_id || !name) {
    return NextResponse.json({ error: "google_place_id and name are required" }, { status: 400 });
  }

  const service = createServiceClient();

  // ── 30-day cache check ────────────────────────────────────────────────────
  const { data: existing } = await service
    .from("venues")
    .select("id, last_enriched_at, enrichment_status, instagram_handle, contact_email, contact_form_url")
    .eq("google_place_id", google_place_id)
    .maybeSingle();

  if (existing?.last_enriched_at && existing.enrichment_status === "complete") {
    const ageMs = Date.now() - new Date(existing.last_enriched_at).getTime();
    if (ageMs < 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ status: "cached", venue_id: existing.id, ...existing });
    }
  }

  // Mark as processing
  const venueUpsertBase = {
    google_place_id,
    name,
    formatted_address: formatted_address ?? null,
    website:           website           ?? null,
    phone:             phone             ?? null,
    rating:            rating            ?? null,
    rating_count:      rating_count      ?? null,
    photo_reference:   photo_reference   ?? null,
    types:             types             ?? null,
    enrichment_status: "processing",
    updated_at:        new Date().toISOString(),
  };

  const { data: upserted, error: upsertErr } = await service
    .from("venues")
    .upsert(venueUpsertBase, { onConflict: "google_place_id" })
    .select("id")
    .single();

  if (upsertErr || !upserted) {
    console.error("[enrich-venue-global] Initial upsert failed:", upsertErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const venueId = upserted.id;

  // ── Firecrawl scrape ──────────────────────────────────────────────────────
  let websiteMarkdown = "";
  let firecrawlOk = false;

  if (website && process.env.FIRECRAWL_API_KEY) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({ url: website, formats: ["markdown"] }),
      });
      if (fcRes.ok) {
        const fcData = await fcRes.json();
        if (fcData.success && fcData.data?.markdown) {
          websiteMarkdown = (fcData.data.markdown as string).slice(0, 10000);
          firecrawlOk = true;
        }
      }
    } catch (err) {
      console.warn("[enrich-venue-global] Firecrawl failed (non-fatal):", err);
    }
  }

  // ── Regex extraction ──────────────────────────────────────────────────────
  const { handle: igHandleRegex, url: igUrl } = extractInstagramRegex(websiteMarkdown);
  const { email: emailAddr, type: emailType } = extractEmailRegex(websiteMarkdown);
  const { url: formUrl }                      = extractContactFormRegex(websiteMarkdown, website ?? undefined);

  // ── Instagram search fallback (if regex found nothing) ───────────────────
  const igHandle = igHandleRegex ?? await searchInstagramHandle(name);

  // ── Claude gap-fill (only for missing fields) ─────────────────────────────
  let claudeContact: Record<string, string | boolean | null> = {};
  const missing: Array<"instagram" | "email" | "contact_form"> = [];
  if (!igHandle)   missing.push("instagram");
  if (!emailAddr)  missing.push("email");
  if (!formUrl)    missing.push("contact_form");

  if (missing.length > 0 && websiteMarkdown && process.env.ANTHROPIC_API_KEY) {
    try {
      const prompt = buildContactExtractionPrompt(websiteMarkdown, name, missing);
      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages:   [{ role: "user", content: prompt }],
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g, "").trim();
        claudeContact = JSON.parse(text);
      }
    } catch (err) {
      console.warn("[enrich-venue-global] Claude contact gap-fill failed (non-fatal):", err);
    }
  }

  // ── Claude generic venue analysis ─────────────────────────────────────────
  let venueAnalysis: Record<string, unknown> = {};

  if (websiteMarkdown && process.env.ANTHROPIC_API_KEY) {
    try {
      const analysisPrompt = `Analyse this venue from its website content and return a JSON object (no markdown).

Venue: ${name}
Address: ${formatted_address ?? "unknown"}

Website content:
${websiteMarkdown.slice(0, 6000)}

Return ONLY this JSON:
{
  "venue_summary": "<~100 word generic overview suitable for outreach context>",
  "venue_vibe_tags": ["<2-5 short style tags, e.g. luxury, garden, rustic, modern>"],
  "venue_capacity": <integer or null>,
  "price_tier": "<budget|mid|premium|luxury|null>",
  "hosts_weddings": <boolean>,
  "hosts_corporate": <boolean>
}`;

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
          messages:   [{ role: "user", content: analysisPrompt }],
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const text = (aiData.content?.[0]?.text ?? "{}").replace(/```json|```/g, "").trim();
        venueAnalysis = JSON.parse(text);
      }
    } catch (err) {
      console.warn("[enrich-venue-global] Claude venue analysis failed (non-fatal):", err);
    }
  }

  // ── Resolve final contact values ──────────────────────────────────────────
  const finalInstagramHandle = igHandle ?? (claudeContact.instagram_handle as string | null) ?? null;
  const finalInstagramUrl    = finalInstagramHandle
    ? (igUrl ?? `https://www.instagram.com/${finalInstagramHandle.replace("@", "")}/`)
    : null;

  const finalEmail     = emailAddr ?? (claudeContact.contact_email     as string | null) ?? null;
  const finalEmailType = emailType ?? (claudeContact.contact_email_type as string | null) ?? null;
  const finalFormUrl   = formUrl   ?? (claudeContact.contact_form_url  as string | null) ?? null;
  const hasForm        = !!(finalFormUrl ?? (claudeContact.has_contact_form as boolean | null));

  // ── Upsert final venue record ─────────────────────────────────────────────
  const { error: finalErr } = await service
    .from("venues")
    .update({
      instagram_handle:   finalInstagramHandle,
      instagram_url:      finalInstagramUrl,
      contact_email:      finalEmail,
      contact_email_type: finalEmailType,
      contact_form_url:   finalFormUrl,
      has_contact_form:   hasForm,
      venue_summary:      (venueAnalysis.venue_summary      as string  | null) ?? null,
      venue_vibe_tags:    (venueAnalysis.venue_vibe_tags     as string[]) ?? [],
      venue_capacity:     (venueAnalysis.venue_capacity      as number  | null) ?? null,
      price_tier:         (venueAnalysis.price_tier          as string  | null) ?? null,
      hosts_weddings:     (venueAnalysis.hosts_weddings      as boolean | null) ?? null,
      hosts_corporate:    (venueAnalysis.hosts_corporate     as boolean | null) ?? null,
      website_markdown:   websiteMarkdown || null,
      last_crawled_at:    firecrawlOk ? new Date().toISOString() : null,
      enrichment_status:  "complete",
      last_enriched_at:   new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    .eq("id", venueId);

  if (finalErr) {
    console.error("[enrich-venue-global] Final update failed:", finalErr);
    await service.from("venues").update({ enrichment_status: "failed" }).eq("id", venueId);
    return NextResponse.json({ error: "DB write failed" }, { status: 500 });
  }

  return NextResponse.json({
    status:           "complete",
    venue_id:         venueId,
    instagram_handle: finalInstagramHandle,
    instagram_url:    finalInstagramUrl,
    contact_email:    finalEmail,
    contact_email_type: finalEmailType,
    contact_form_url: finalFormUrl,
    has_contact_form: hasForm,
  });
}
