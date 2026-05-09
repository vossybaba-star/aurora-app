import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CompanyAnalysis, ICP } from "@/lib/types";

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

    const { companyName, domain, websiteUrl, shortDescription } = await request.json();

    if (!domain && !websiteUrl) {
      return NextResponse.json({ error: "domain or websiteUrl required" }, { status: 400 });
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

    // ── Haiku analysis ───────────────────────────────────────────────────────
    const prompt = `You are analysing a company's website to help them set up outbound sales.

Company name: ${companyName || "Unknown"}
Website content:
${contentSample}

Return ONLY valid JSON — no markdown, no explanation:
{
  "description": "2-3 sentence plain-language company description",
  "value_proposition": "single most compelling headline value prop (max 15 words)",
  "key_products": ["up to 5 specific named products or services this company sells"],
  "key_features": ["up to 5 core capabilities or differentiators"],
  "tone": "professional|casual|technical|friendly",
  "icp_suggestion": {
    "industries": ["up to 5 industries they most likely sell to"],
    "company_sizes": ["one or more of: 1-10, 11-50, 51-200, 201-1000, 1000+"],
    "personas": ["up to 5 job titles of ideal buyers"],
    "pain_points": ["up to 4 specific problems this company solves"],
    "geography": ["countries or regions they serve — default to United Kingdom if unclear"]
  }
}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":         process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`Anthropic error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const raw = (aiData.content?.[0]?.text ?? "{}").replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(raw);

    const analysis: CompanyAnalysis = {
      description:       String(parsed.description || ""),
      value_proposition: String(parsed.value_proposition || ""),
      key_products:      Array.isArray(parsed.key_products)  ? parsed.key_products.map(String)  : [],
      key_features:      Array.isArray(parsed.key_features)  ? parsed.key_features.map(String)  : [],
      tone:              (["professional","casual","technical","friendly"] as const)
                           .includes(parsed.tone) ? parsed.tone : "professional",
    };

    const icpRaw = parsed.icp_suggestion ?? {};
    const icpSuggestion: ICP = {
      industries:    Array.isArray(icpRaw.industries)    ? icpRaw.industries.map(String)    : [],
      company_sizes: Array.isArray(icpRaw.company_sizes) ? icpRaw.company_sizes.map(String) : ["11-50", "51-200"],
      personas:      Array.isArray(icpRaw.personas)      ? icpRaw.personas.map(String)      : [],
      pain_points:   {},  // populated per-persona in the profile page after personas are set
      geography:     Array.isArray(icpRaw.geography)     ? icpRaw.geography.map(String)     : ["United Kingdom"],
    };

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
