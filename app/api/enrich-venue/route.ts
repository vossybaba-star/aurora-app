/**
 * app/api/enrich-venue/route.ts
 *
 * On-demand AI enrichment pipeline for a single venue.
 * Called from the Discover page when a user clicks a venue card.
 *
 * Uses raw fetch for Anthropic + Firecrawl (same pattern as find-opportunities)
 * to avoid SDK import resolution issues in Vercel's build cache.
 *
 * Pipeline stages:
 *   1. Auth + 48hr cache check
 *   2. Firecrawl website scrape (non-fatal)
 *   3. Claude analysis (wedding/cultural fit, exclusive photographer, etc.)
 *   4. Signal score calculation
 *   5. DB write (if opportunity already exists for this user)
 *   6. Enrichment audit log insert
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { extractEmailRegex, extractContactFormRegex } from "@/lib/venues/extractContact";

// ─── Shared Instagram handle extractor ───────────────────────────────────────

const IG_NON_HANDLES = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts",
  "tv", "ar", "about", "legal", "privacy", "help", "direct",
]);

function extractIgHandleFromText(text: string): string | null {
  const match = text.match(
    /instagram\.com\/([a-zA-Z0-9][a-zA-Z0-9_.]{1,29})(?:[\s/?#"')\]]|$)/
  );
  if (!match) return null;
  const candidate = match[1].replace(/\.$/, "");
  if (IG_NON_HANDLES.has(candidate.toLowerCase())) return null;
  return `@${candidate}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiAnalysis {
  wedding_relevance: number;
  cultural_relevance: number;
  photographer_opportunity: number;
  has_exclusive_photographer: boolean;
  contact_name: string | null;
  contact_email: string | null;
  venue_capacity: number | null;
  positioning_match: number;
  key_phrases_for_email: string[];
  why_good_lead: string;
  why_bad_lead: string | null;
  recommended_angle: string;
  confidence: "high" | "medium" | "low";
  venue_vibe_tags: string[];
}

// ─── Score calculator ─────────────────────────────────────────────────────────

function calculateSignalScore(
  ai: AiAnalysis,
  rating: number | null,
  ratingCount: number | null,
  networkContactedCount: number
): { signal_score: number; score_breakdown: Record<string, number> } {
  // Rating component (0–25)
  const ratingScore = (() => {
    if (!rating) return 0;
    if (rating >= 4.5) return 25;
    if (rating >= 4.0) return 18;
    if (rating >= 3.5) return 10;
    return 3;
  })();

  // Review volume component (0–10)
  const reviewScore = (() => {
    const rc = ratingCount ?? 0;
    if (rc >= 200) return 10;
    if (rc >= 100) return 7;
    if (rc >= 50) return 4;
    return 0;
  })();

  // AI-scored components (weighted)
  const weddingScore      = Math.round((ai.wedding_relevance    / 100) * 25);
  const culturalScore     = Math.round((ai.cultural_relevance   / 100) * 20);
  const photographerScore = Math.round((ai.photographer_opportunity / 100) * 15);
  const positioningScore  = Math.round((ai.positioning_match    / 100) * 10);

  // Exclusive photographer penalty (–40 — significant blocker)
  const exclusivePenalty = ai.has_exclusive_photographer ? -40 : 0;

  // Kammie network signal (aggregate, max 10)
  const networkScore = Math.min(networkContactedCount * 2, 10);

  const total = Math.max(
    0,
    Math.min(
      100,
      ratingScore +
        reviewScore +
        weddingScore +
        culturalScore +
        photographerScore +
        positioningScore +
        exclusivePenalty +
        networkScore
    )
  );

  return {
    signal_score: total,
    score_breakdown: {
      rating_score:                   ratingScore,
      review_volume_score:            reviewScore,
      wedding_relevance_score:        weddingScore,
      cultural_relevance_score:       culturalScore,
      photographer_opportunity_score: photographerScore,
      positioning_match_score:        positioningScore,
      exclusive_penalty:              exclusivePenalty,
      network_score:                  networkScore,
      total,
    },
  };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const startTime = Date.now();

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { google_place_id?: string; website_url?: string; place_name?: string; skip_ai?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { google_place_id, website_url, place_name, skip_ai } = body;
  if (!google_place_id) {
    return NextResponse.json({ error: "google_place_id is required" }, { status: 400 });
  }

  // ── 3. Look up existing opportunity ──────────────────────────────────────
  // Cast to any — new columns from ai_engine migration aren't in generated types yet
  const { data: rawOpp } = await supabase
    .from("opportunities")
    .select(
      "id, last_enriched_at, ai_analysis, signal_score, score_breakdown, " +
      "google_editorial_summary, full_reviews, rating, rating_count, " +
      "network_contacted_count, website, instagram_handle"
    )
    .eq("google_place_id", google_place_id)
    .eq("user_id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opportunity = rawOpp as any;

  // ── 4. 48-hour cache check ────────────────────────────────────────────────
  if (opportunity?.last_enriched_at && opportunity?.ai_analysis) {
    const ageMs = Date.now() - new Date(opportunity.last_enriched_at).getTime();
    if (ageMs < 48 * 60 * 60 * 1000) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = opportunity as any;
      return NextResponse.json({
        status:           "cached",
        signal_score:     opp.signal_score ?? 0,
        score_breakdown:  opp.score_breakdown ?? {},
        ai_analysis:      opp.ai_analysis,
        instagram_handle: opp.instagram_handle ?? null,
        contact_email:    opp.contact_email ?? opp.ai_analysis?.contact_email ?? null,
        contact_form_url: opp.contact_form_url ?? null,
      });
    }
  }

  // ── 5. Get user profile for AI context ───────────────────────────────────
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select(
      "full_name, business_name, business_type, location, pitch, " +
      "speciality_tags, positioning, work_radius"
    )
    .eq("id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = rawProfile as any;

  // ── 6. Mark opportunity as processing ────────────────────────────────────
  if (opportunity?.id) {
    await supabase
      .from("opportunities")
      .update({ enrichment_status: "processing" })
      .eq("id", opportunity.id);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 1a: Firecrawl website scrape (non-fatal)
  // ──────────────────────────────────────────────────────────────────────────
  const websiteToScrape = website_url || opportunity?.website;
  let websiteMarkdown = "";
  let firecrawlSuccess = false;
  let instagramHandle: string | null = null;

  if (websiteToScrape && process.env.FIRECRAWL_API_KEY) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url:     websiteToScrape,
          formats: ["markdown"],
        }),
      });

      if (fcRes.ok) {
        const fcData = await fcRes.json();
        if (fcData.success && fcData.data?.markdown) {
          websiteMarkdown = (fcData.data.markdown as string).slice(0, 8000);
          firecrawlSuccess = true;
          instagramHandle = extractIgHandleFromText(websiteMarkdown);
        }
      }
    } catch (err) {
      console.warn("[enrich-venue] Firecrawl scrape failed (non-fatal):", err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 1b: Firecrawl web search fallback for Instagram
  // Many venues embed social icons via JavaScript — the homepage scrape misses
  // them. A targeted web search reliably surfaces the Instagram profile URL.
  // ──────────────────────────────────────────────────────────────────────────
  if (!instagramHandle && place_name && process.env.FIRECRAWL_API_KEY) {
    try {
      const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          query:  `"${place_name}" instagram`,
          limit:  5,
          lang:   "en",
          // Only return URLs + snippets — no need for full markdown here
          scrapeOptions: { formats: [] },
        }),
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results: Array<{ url?: string; description?: string }> =
          searchData.data ?? [];

        for (const r of results) {
          // 1. Check if the result URL itself is the Instagram profile
          if (r.url) {
            const fromUrl = extractIgHandleFromText(r.url);
            if (fromUrl) { instagramHandle = fromUrl; break; }
          }
          // 2. Check the snippet text for an instagram.com link
          if (r.description) {
            const fromSnippet = extractIgHandleFromText(r.description);
            if (fromSnippet) { instagramHandle = fromSnippet; break; }
          }
        }
      }
    } catch (err) {
      console.warn("[enrich-venue] Firecrawl search fallback failed (non-fatal):", err);
    }
  }

  // ── Regex contact extraction (fast, free) ────────────────────────────────
  const { email: regexEmail } = extractEmailRegex(websiteMarkdown);
  const { url: regexFormUrl } = extractContactFormRegex(websiteMarkdown, websiteToScrape ?? undefined);

  // ── skip_ai mode: return Instagram handle only, no Claude analysis ──────────
  // Used by the Discover page to populate Instagram handles on tiles without
  // running a full (expensive) Claude analysis.
  if (skip_ai) {
    return NextResponse.json({
      status:           "instagram_only",
      instagram_handle: instagramHandle,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 2: Build Claude prompt
  // ──────────────────────────────────────────────────────────────────────────
  const reviewsSummary = (() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews: any[] = opportunity?.full_reviews ?? [];
    if (!reviews.length) return "No reviews available.";
    return reviews
      .slice(0, 5)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => `• ${r.author} (${r.rating}★): "${r.text}"`)
      .join("\n");
  })();

  const photographerProfile = [
    profile?.full_name || profile?.business_name
      ? `Photographer: ${profile?.full_name || profile?.business_name}`
      : null,
    profile?.business_type ? `Business type: ${profile.business_type}` : null,
    profile?.location      ? `Based in: ${profile.location}`           : null,
    profile?.pitch         ? `Pitch: ${profile.pitch}`                  : null,
    profile?.speciality_tags?.length
      ? `Specialities: ${profile.speciality_tags.join(", ")}`
      : null,
    profile?.positioning   ? `Market positioning: ${profile.positioning}` : null,
    profile?.work_radius   ? `Work radius: ${profile.work_radius}`        : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are an expert business development analyst for creative photographers. Analyse this venue as a potential outreach lead and return a JSON object (no markdown, no extra text).

PHOTOGRAPHER PROFILE
${photographerProfile || "Independent wedding photographer based in London."}

VENUE DETAILS
Name: ${place_name || "Unknown venue"}
Website: ${websiteToScrape || "Not available"}
Google editorial summary: ${opportunity?.google_editorial_summary || "Not available"}
Google rating: ${opportunity?.rating ?? "Not available"}

GOOGLE REVIEWS (up to 5)
${reviewsSummary}

WEBSITE CONTENT (from crawl, may be empty)
${websiteMarkdown || "No website content available."}

ANALYSIS TASK
Assess this venue as a photography lead. Pay particular attention to:
1. Whether the venue hosts weddings (especially Black/African diaspora weddings, cultural ceremonies, or diverse events)
2. Whether there is any sign of an exclusive or preferred photographer arrangement
3. How well the venue matches the photographer's positioning and speciality
4. Specific language or themes on the website that would resonate in a cold outreach email

Return ONLY this JSON (all fields required):
{
  "wedding_relevance": <0-100 integer — how likely the venue hosts weddings>,
  "cultural_relevance": <0-100 integer — how likely the venue hosts Black/African diaspora or multicultural events>,
  "photographer_opportunity": <0-100 integer — how much genuine opportunity exists for a freelance photographer>,
  "has_exclusive_photographer": <boolean — true if there is any sign of exclusive/preferred photographer arrangement>,
  "contact_name": <string or null — specific person's name found in website/reviews>,
  "contact_email": <string or null — specific email address found>,
  "venue_capacity": <integer or null — estimated guest capacity if mentioned>,
  "positioning_match": <0-100 integer — how well this venue matches the photographer's market positioning>,
  "key_phrases_for_email": <array of 2-4 short strings that could personalise a cold email>,
  "why_good_lead": <1-2 sentence string — the best case for contacting this venue>,
  "why_bad_lead": <1-2 sentence string or null — main reason not to contact, if any>,
  "recommended_angle": <1 sentence — the specific outreach angle most likely to get a reply>,
  "confidence": <"high" | "medium" | "low" — confidence in this assessment given available data>,
  "venue_vibe_tags": <array of 2-5 short tags describing the venue style, e.g. ["luxury", "garden", "multicultural"]>
}`;

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 3: Claude analysis via REST API (same pattern as find-opportunities)
  // ──────────────────────────────────────────────────────────────────────────
  let aiAnalysis: AiAnalysis | null = null;
  let tokensUsed = 0;

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-opus-4-5",
        max_tokens: 1024,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      throw new Error(`Anthropic API error: ${anthropicRes.status}`);
    }

    const aiData = await anthropicRes.json();
    tokensUsed =
      (aiData.usage?.input_tokens ?? 0) + (aiData.usage?.output_tokens ?? 0);

    const rawText: string = aiData.content?.[0]?.text ?? "{}";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    aiAnalysis = {
      wedding_relevance:         Math.max(0, Math.min(100, Number(parsed.wedding_relevance)    || 0)),
      cultural_relevance:        Math.max(0, Math.min(100, Number(parsed.cultural_relevance)   || 0)),
      photographer_opportunity:  Math.max(0, Math.min(100, Number(parsed.photographer_opportunity) || 0)),
      has_exclusive_photographer: Boolean(parsed.has_exclusive_photographer),
      contact_name:              parsed.contact_name  ?? null,
      contact_email:             parsed.contact_email ?? null,
      venue_capacity:            parsed.venue_capacity ? Number(parsed.venue_capacity) : null,
      positioning_match:         Math.max(0, Math.min(100, Number(parsed.positioning_match)    || 0)),
      key_phrases_for_email:     Array.isArray(parsed.key_phrases_for_email) ? parsed.key_phrases_for_email : [],
      why_good_lead:             String(parsed.why_good_lead    || ""),
      why_bad_lead:              parsed.why_bad_lead  ?? null,
      recommended_angle:         String(parsed.recommended_angle || ""),
      confidence:                ["high", "medium", "low"].includes(parsed.confidence)
                                   ? parsed.confidence
                                   : "medium",
      venue_vibe_tags:           Array.isArray(parsed.venue_vibe_tags) ? parsed.venue_vibe_tags : [],
    };
  } catch (err) {
    console.error("[enrich-venue] Claude analysis failed:", err);
    if (opportunity?.id) {
      await supabase
        .from("opportunities")
        .update({ enrichment_status: "failed" })
        .eq("id", opportunity.id);
    }
    return NextResponse.json(
      { error: "AI analysis failed. Please try again shortly." },
      { status: 500 }
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 4: Signal score
  // ──────────────────────────────────────────────────────────────────────────
  const { signal_score, score_breakdown } = calculateSignalScore(
    aiAnalysis,
    opportunity?.rating       ?? null,
    opportunity?.rating_count ?? null,
    opportunity?.network_contacted_count ?? 0
  );

  const durationMs = Date.now() - startTime;

  // ──────────────────────────────────────────────────────────────────────────
  // Stage 5: DB write (only if this venue is already in the user's pipeline)
  // ──────────────────────────────────────────────────────────────────────────
  if (opportunity?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {
      ai_analysis:       aiAnalysis,
      signal_score,
      score_breakdown,
      enrichment_status: "complete",
      last_enriched_at:  new Date().toISOString(),
    };

    if (firecrawlSuccess && websiteMarkdown) {
      updatePayload.website_markdown        = websiteMarkdown;
      updatePayload.website_last_crawled_at = new Date().toISOString();
    }

    if (aiAnalysis.contact_name) {
      updatePayload.contact_name = aiAnalysis.contact_name;
    }
    if (instagramHandle) {
      updatePayload.instagram_handle = instagramHandle;
    }

    const { error: updateError } = await supabase
      .from("opportunities")
      .update(updatePayload)
      .eq("id", opportunity.id);

    if (updateError) {
      console.error("[enrich-venue] DB update failed:", updateError);
    }

    // ── Upsert Instagram into contact_methods (idempotent) ─────────────────
    if (instagramHandle) {
      const { data: existingIg } = await supabase
        .from("contact_methods")
        .select("id")
        .eq("opportunity_id", opportunity.id)
        .eq("type", "instagram")
        .maybeSingle();

      if (!existingIg) {
        await supabase.from("contact_methods").insert({
          opportunity_id: opportunity.id,
          type:           "instagram",
          value:          instagramHandle,
          is_primary:     false,
        });
      }
    }

    // ── Stage 6: Enrichment audit log ──────────────────────────────────────
    await supabase.from("lead_enrichment_log").insert({
      opportunity_id:  opportunity.id,
      user_id:         user.id,
      triggered_by:    "user_click",
      steps_completed: {
        firecrawl:       firecrawlSuccess,
        claude_analysis: true,
        signal_score:    true,
      },
      tokens_used: tokensUsed,
      model_used:  "claude-opus-4-5",
      duration_ms: durationMs,
    });

    // ── Stage 7: Auto-trigger copy generation (fire-and-forget) ────────────
    // Passes the auth cookie through so the generate-sequence route can
    // authenticate without a separate token exchange.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${appUrl}/api/generate-sequence`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie:         req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        opportunity_id: opportunity.id,
        regenerate:     false, // skip if copy already exists
      }),
    }).catch((err) =>
      console.error("[enrich-venue] Auto-generate sequence failed:", err)
    );
  }

  // ── Return result ─────────────────────────────────────────────────────────
  // Prefer regex-extracted values (exact strings from the page) over Claude's
  // best-guess extraction stored in ai_analysis.
  const finalEmail   = regexEmail   ?? aiAnalysis?.contact_email   ?? null;
  const finalFormUrl = regexFormUrl ?? null;

  return NextResponse.json({
    status:            "complete",
    signal_score,
    score_breakdown,
    ai_analysis:       aiAnalysis,
    instagram_handle:  instagramHandle,
    contact_email:     finalEmail,
    contact_form_url:  finalFormUrl,
    website_crawled:   firecrawlSuccess,
    duration_ms:       durationMs,
  });
}
