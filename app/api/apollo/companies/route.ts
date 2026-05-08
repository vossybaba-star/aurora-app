import { NextResponse }    from "next/server";
import { searchCompanies } from "@/lib/apollo";
import { getRoleById }      from "@/lib/roles";
import type { TargetMarket } from "@/lib/roles";

/**
 * Maps TargetMarket values → additional Apollo keyword tags.
 * These are appended to the role's companyKeywords when the caller
 * passes target_markets, narrowing the search to relevant company types.
 */
const TARGET_MARKET_KEYWORDS: Partial<Record<TargetMarket, string[]>> = {
  venues:               ["wedding venue", "event space", "event venue", "country house"],
  wedding_planners:     ["wedding planning", "wedding coordination"],
  luxury_hotels:        ["luxury hotel", "boutique hotel", "resort"],
  florists_suppliers:   ["florist", "wedding florist", "event decor"],
  beauty_brands:        ["cosmetics", "beauty brand", "skincare", "fragrance"],
  fashion_agencies:     ["fashion agency", "modelling agency", "talent"],
  pr_talent_agencies:   ["PR agency", "talent agency", "public relations", "communications"],
  bridal_boutiques:     ["bridal boutique", "bridal", "wedding dress"],
  film_tv_production:   ["film production", "television", "broadcast", "streaming"],
  editorial_magazines:  ["magazine", "publishing", "editorial", "media"],
  investors_vcs:        ["venture capital", "angel investment", "fund"],
  accelerators:         ["accelerator", "incubator", "startup programme"],
  enterprise_companies: ["enterprise", "corporation", "multinational"],
  co_founders_partners: ["startup", "co-founder", "early stage"],
  industry_press:       ["journalism", "press", "media", "news"],
  corporate_clients:    ["corporate", "professional services", "consulting"],
  hospitality_hotels:   ["hotel", "hospitality", "accommodation"],
  retail_brands:        ["retail", "e-commerce", "D2C"],
  music_entertainment:  ["music label", "record label", "entertainment agency"],
  sport_wellness:       ["fitness", "wellness", "sport", "health"],
};

export async function POST(req: Request) {
  let body: {
    role_id?:       string;
    target_markets?: string[];
    page?:          number;
    // Legacy fallback — deprecated, kept for backwards compat
    persona?:       string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role_id, target_markets, page } = body;

  // ── Resolve role config ──────────────────────────────────────────────────
  const role = role_id ? getRoleById(role_id) : undefined;

  // Legacy persona fallback so existing callers don't break while roleId rolls out
  const legacyKeywords: Record<string, string[]> = {
    makeup_artist:   ["beauty", "fashion", "PR", "editorial", "talent", "modelling", "casting", "cosmetics", "luxury", "bridal"],
    startup_founder: ["technology", "startup", "venture", "SaaS", "fintech", "accelerator", "investment"],
  };
  const legacyTags = body.persona ? legacyKeywords[body.persona] : undefined;

  const baseKeywords: string[] = role
    ? role.companyKeywords
    : (legacyTags ?? []);

  if (baseKeywords.length === 0) {
    return NextResponse.json(
      { error: `Unknown role_id "${role_id ?? body.persona}" — no keywords found` },
      { status: 400 }
    );
  }

  // ── Extend with ALL target-market keywords (every selected market contributes) ──
  // flatMap over every market so no market is skipped even if the first returns nothing.
  const marketKeywords: string[] = (target_markets as TargetMarket[] ?? []).flatMap(
    (market) => TARGET_MARKET_KEYWORDS[market] ?? []
  );

  // Deduplicate: base role keywords + all market keywords combined
  const allKeywords = Array.from(
    new Set([...baseKeywords, ...marketKeywords])
  );

  // ── Apollo search ────────────────────────────────────────────────────────
  console.log("[apollo/companies] role_id:", role_id);
  console.log("[apollo/companies] Keywords:", allKeywords);
  console.log("[apollo/companies] Location: United Kingdom");
  const companies = await searchCompanies({
    q_organization_keyword_tags: allKeywords,
    organization_locations:      ["United Kingdom"],
    per_page: 20,
    page:     page ?? 1,
  });

  if (companies === null) {
    return NextResponse.json(
      { companies: [], error: "Apollo API error — check APOLLO_API_KEY" },
      { status: 200 }
    );
  }

  return NextResponse.json({ companies, role_label: role?.label ?? null });
}
