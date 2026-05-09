import { NextResponse }    from "next/server";
import { searchCompanies } from "@/lib/apollo";
import { getRoleById }      from "@/lib/roles";
import type { TargetMarket } from "@/lib/roles";
import type { ICP } from "@/lib/types";

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

/** Map ICP company_sizes strings to Apollo employee range format "min,max" */
function icpSizesToRanges(sizes: string[]): string[] {
  const map: Record<string, string> = {
    "1-10":      "1,10",
    "11-50":     "11,50",
    "51-200":    "51,200",
    "201-1000":  "201,1000",
    "1000+":     "1001,10000",
  };
  return sizes.map(s => map[s]).filter(Boolean);
}

export async function POST(req: Request) {
  let body: {
    role_id?:        string;
    target_markets?: string[];
    page?:           number;
    icp?:            ICP;
    filters?:        { industry?: string; location?: string; size?: string };
    // Legacy fallback — deprecated, kept for backwards compat
    persona?:        string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role_id, target_markets, page, icp, filters } = body;

  // ── ICP-driven mode (B2B users) ──────────────────────────────────────────
  if (icp && (icp.industries?.length > 0 || filters)) {
    const industries     = filters?.industry
      ? [filters.industry]
      : (icp?.industries ?? []);
    const employeeRanges = filters?.size
      ? icpSizesToRanges([filters.size])
      : icpSizesToRanges(icp?.company_sizes ?? []);
    const locations      = filters?.location
      ? [filters.location]
      : (icp?.geography?.length ? icp.geography : ["United Kingdom"]);

    const companies = await searchCompanies({
      q_organization_keyword_tags:       industries.length ? industries : undefined,
      organization_num_employees_ranges: employeeRanges.length ? employeeRanges : undefined,
      organization_locations:            locations,
      per_page: 20,
      page:     page ?? 1,
    });

    if (companies === null) {
      return NextResponse.json(
        { companies: [], error: "Apollo API error — check APOLLO_API_KEY" },
        { status: 200 }
      );
    }

    return NextResponse.json({ companies, role_label: null });
  }

  // ── Role-based mode (freelancer / legacy users) ──────────────────────────
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

  // ── Extend with ALL target-market keywords ───────────────────────────────
  const marketKeywords: string[] = (target_markets as TargetMarket[] ?? []).flatMap(
    (market) => TARGET_MARKET_KEYWORDS[market] ?? []
  );

  const allKeywords = Array.from(new Set([...baseKeywords, ...marketKeywords]));

  // ── Apollo search ────────────────────────────────────────────────────────
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
