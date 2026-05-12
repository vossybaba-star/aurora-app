import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CompanyAnalysis, ICP } from "@/lib/types";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

// ── HTML helpers ────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchPage(url: string): Promise<string | null> {
  // Strategy 1: corsproxy.io
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return html;
    }
  } catch { /* try next */ }

  // Strategy 2: allorigins
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return html;
    }
  } catch { /* try next */ }

  // Strategy 3: direct
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KammieBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const html = await res.text();
      if (html.length > 500) return html;
    }
  } catch { /* all failed */ }

  return null;
}

// ── Route ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyName, domain, websiteUrl, shortDescription, apolloId } = await request.json();

    if (!domain && !websiteUrl) {
      return NextResponse.json({ error: "domain or websiteUrl required" }, { status: 400 });
    }

    const cacheKey = domain || new URL(websiteUrl).hostname.replace(/^www\./, "");

    // ── Shared description cache check (30-day TTL) ───────────────────────────
    const CACHE_TTL_DAYS = 30;
    const { data: cachedDesc } = await supabase
      .from("company_descriptions")
      .select("description")
      .eq("domain", cacheKey)
      .gt("cached_at", new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString())
      .maybeSingle();

    if (cachedDesc?.description) {
      return NextResponse.json({ success: true, analysis: { description: cachedDesc.description }, cached: true });
    }

    const baseUrl = websiteUrl || `https://${domain}`;

    // ── Scrape homepage + /about and /services ──────────────────────────────
    let combinedText = "";
    let partial = false;

    const pages = [baseUrl, `${baseUrl.replace(/\/$/, "")}/about`, `${baseUrl.replace(/\/$/, "")}/services`];
    let scraped = 0;

    for (const pageUrl of pages) {
      const html = await fetchPage(pageUrl);
      if (html) {
        combinedText += " " + stripHtml(html);
        scraped++;
        if (scraped >= 2 && combinedText.length > 6000) break; // enough content
      }
      if (scraped === 0 && pageUrl === pages[0]) {
        // Homepage failed — mark partial and use Apollo short_description as fallback
        partial = true;
        combinedText = shortDescription || companyName || "";
        break;
      }
    }

    // Truncate to ~4000 chars to keep token usage low
    const contentSample = combinedText.slice(0, 4000);

    // Compute completeness score based on scrape quality
    const completeness_score = partial ? 0.3 : scraped === 1 ? 0.6 : 1.0;

    // ── Haiku analysis ───────────────────────────────────────────────────────
    const prompt = `You are analysing a company's website to help them set up outbound B2B sales.

Company name: ${companyName || "Unknown"}
Website content:
${contentSample}

Return ONLY valid JSON — no markdown, no explanation:
{
  "description": "3-5 sentence plain-language company description covering what they do, who they serve, and key differentiators",
  "value_proposition": "single most compelling headline value prop (max 15 words)",
  "key_products": ["up to 5 specific named products or services this company sells"],
  "key_features": ["up to 5 core capabilities or differentiators"],
  "icp_suggestion": {
    "industries": ["up to 5 industries they most likely sell to"],
    "company_sizes": ["one or more of: 1-10, 11-50, 51-200, 201-1000, 1000+"],
    "champions": ["up to 4 mid-level job titles who use or benefit from this daily — internal advocates"],
    "decision_makers": ["up to 3 C-suite or Head-of titles who control budget and final sign-off"],
    "pain_points": ["up to 4 specific problems this company solves"],
    "geography": ["countries or regions they serve — default to United Kingdom if unclear"]
  }
}`;

    const raw = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 800, prompt });
    const parsed = parseClaudeJson<Record<string, any>>(raw);

    const analysis: CompanyAnalysis = {
      description:        String(parsed.description || ""),
      value_proposition:  String(parsed.value_proposition || ""),
      key_products:       Array.isArray(parsed.key_products)
                            ? Object.fromEntries(parsed.key_products.map((p: unknown) => [String(p), ""]))
                            : {},
      key_features:       Array.isArray(parsed.key_features) ? parsed.key_features.map(String) : [],
      completeness_score,
    };

    const icpRaw = parsed.icp_suggestion ?? {};
    const icpSuggestion: ICP = {
      industries:      Array.isArray(icpRaw.industries)      ? icpRaw.industries.map(String)      : [],
      company_sizes:   Array.isArray(icpRaw.company_sizes)   ? icpRaw.company_sizes.map(String)   : ["11-50", "51-200"],
      champions:       Array.isArray(icpRaw.champions)       ? icpRaw.champions.map(String)       : [],
      decision_makers: Array.isArray(icpRaw.decision_makers) ? icpRaw.decision_makers.map(String) : [],
      pain_points:     {},  // populated per-persona in profile page after personas are confirmed
      goals:           {},
      objections:      {},
      geography:       Array.isArray(icpRaw.geography)       ? icpRaw.geography.map(String)       : ["United Kingdom"],
    };

    // Write description to shared cache
    if (analysis.description && cacheKey) {
      await supabase.from("company_descriptions").upsert({
        domain:      cacheKey,
        apollo_id:   apolloId ?? null,
        description: analysis.description,
        cached_at:   new Date().toISOString(),
      }, { onConflict: "domain" });
    }

    return NextResponse.json({
      success:      true,
      analysis,
      icpSuggestion,
      ...(partial ? { partial: true } : {}),
    });

  } catch (error) {
    console.error("[analyze-company] error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
