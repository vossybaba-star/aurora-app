import { NextResponse }              from "next/server";
import { searchCompanies, searchPeople } from "@/lib/apollo";
import type { ApolloCompany }        from "@/lib/apollo";
import { getRoleById }      from "@/lib/roles";
import type { TargetMarket } from "@/lib/roles";
import type { ICP, CompanyAnalysis } from "@/lib/types";
import { callClaude, parseClaudeJson } from "@/lib/anthropic/client";

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

// ── Rule-based scoring helpers ────────────────────────────────────────────────

const UK_TERMS = ["united kingdom", "uk", "england", "scotland", "wales", "northern ireland",
  "london", "manchester", "birmingham", "edinburgh", "bristol", "leeds", "glasgow"];

function scoreIndustry(industry: string | null, keywords: string[], icpIndustries: string[]): number {
  if (!icpIndustries.length) return 12;
  const haystack = [industry, ...keywords].filter(Boolean).join(" ").toLowerCase();
  let best = 0;
  for (const ind of icpIndustries) {
    const terms  = ind.toLowerCase().split(/[\s,/]+/).filter(t => t.length > 2);
    const hits   = terms.filter(t => haystack.includes(t)).length;
    const ratio  = terms.length ? hits / terms.length : 0;
    if (ratio >= 0.6) { best = 25; break; }
    if (ratio >= 0.3) best = Math.max(best, 12);
  }
  return best;
}

function scoreSize(employees: number | null, icpSizes: string[]): number {
  if (!icpSizes.length) return 10;
  if (employees == null) return 6; // unknown — slight benefit of doubt
  const ranges: Record<string, [number, number]> = {
    "1-10":     [1,  10],
    "11-50":    [11, 50],
    "51-200":   [51, 200],
    "201-1000": [201, 1000],
    "1000+":    [1001, Infinity],
  };
  for (const s of icpSizes) {
    const r = ranges[s];
    if (r && employees >= r[0] && employees <= r[1]) return 20;
  }
  // Adjacent range — partial credit
  const boundaries = icpSizes.flatMap(s => ranges[s] ? [ranges[s][0], ranges[s][1]] : []);
  const min = Math.min(...boundaries.filter(n => n !== Infinity));
  const max = Math.max(...boundaries.filter(n => n !== Infinity));
  if (employees >= min * 0.5 && employees <= max * 2) return 8;
  return 0;
}

function scoreGeography(city: string | null, country: string | null, icpGeo: string[]): number {
  if (!icpGeo.length) return 8;
  const location = [city, country].filter(Boolean).join(" ").toLowerCase();
  if (!location) return 5;
  for (const geo of icpGeo) {
    const g = geo.toLowerCase();
    if (location.includes(g) || g.includes(location.split(" ")[0] ?? "___")) return 15;
    // Normalise UK variants
    const locIsUK = UK_TERMS.some(t => location.includes(t));
    const geoIsUK = UK_TERMS.some(t => g.includes(t));
    if (locIsUK && geoIsUK) return 15;
  }
  return 0;
}

function scoreFunding(stage: string | null | undefined): number {
  if (!stage) return 0;
  const s = stage.toLowerCase();
  if (s.includes("seed") || s.includes("series a")) return 10;
  if (s.includes("series b") || s.includes("series c")) return 8;
  if (s.includes("series d") || s.includes("growth") || s.includes("late")) return 6;
  if (s.includes("angel") || s.includes("bootstrap") || s.includes("private")) return 4;
  return 2;
}

function scoreTechStack(techNames: string[] | undefined): number {
  if (!techNames?.length) return 0;
  const ENTERPRISE = ["salesforce", "hubspot", "marketo", "pipedrive", "zendesk",
    "workday", "sap", "oracle", "intercom", "segment", "amplitude", "jira"];
  return techNames.some(t => ENTERPRISE.some(e => t.toLowerCase().includes(e))) ? 10 : 3;
}

// ── People reachability ───────────────────────────────────────────────────────

const SENIOR_TITLES = [
  "CEO", "Founder", "Co-Founder", "Managing Director", "Director",
  "VP", "Vice President", "Head of", "CTO", "CMO", "COO", "CFO",
  "President", "Partner", "Principal", "General Manager", "Owner",
];

async function checkReachability(
  company: ApolloCompany,
  icpPersonas: string[],
): Promise<{ reachable: boolean; count: number }> {
  const titles = [...new Set([...SENIOR_TITLES, ...icpPersonas])];
  const params = company.primary_domain
    ? { organization_domains: [company.primary_domain], person_titles: titles, per_page: 5, page: 1 }
    : { q_organization_name: company.name,              person_titles: titles, per_page: 5, page: 1 };
  const people = await searchPeople(params);
  const seniorFound = people.some(p =>
    SENIOR_TITLES.some(t => p.title?.toLowerCase().includes(t.toLowerCase()))
  );
  return { reachable: seniorFound, count: people.length };
}

function reachabilityBonus(r: { reachable: boolean; count: number }): number {
  if (r.reachable)    return 8;
  if (r.count >= 2)   return 4;
  return 0;
}

// ── Main scoring orchestrator ─────────────────────────────────────────────────

async function batchScoreCompanies(
  companies: ApolloCompany[],
  icp: ICP,
  companyAnalysis?: CompanyAnalysis,
): Promise<ApolloCompany[]> {

  // ── Step 1: Rule-based firmographic scores ─────────────────────────────
  const firmographic = companies.map(c => ({
    industry: scoreIndustry(c.industry, c.keywords, icp.industries ?? []),
    size:     scoreSize(c.estimated_num_employees, icp.company_sizes ?? []),
    geo:      scoreGeography(c.city, c.country, icp.geography ?? []),
    funding:  scoreFunding(c.latest_funding_stage),
    tech:     scoreTechStack(c.technology_names),
  }));

  // ── Step 2: Claude semantic fit — one batch call (0-20 pts each) ───────
  const valueProp = companyAnalysis?.value_proposition ?? companyAnalysis?.description ?? "";
  let semanticScores: number[] = companies.map(() => 10); // default mid

  if (valueProp) {
    const list = companies.map((c, i) =>
      `${i + 1}. ${[c.short_description, c.keywords.slice(0, 6).join(", ")].filter(Boolean).join(" | ") || "No description"}`
    ).join("\n");

    try {
      const prompt = `Score each company's semantic fit (0-20) against a seller with this value proposition: "${valueProp}"

Companies:
${list}

Return JSON array ONLY — no other text:
[{"index":1,"score":<0-20>},...]

Judge: does this company's description/keywords suggest they'd benefit from what the seller offers?`;

      const raw    = await callClaude({ model: "claude-haiku-4-5-20251001", maxTokens: 600, prompt });
      const parsed = parseClaudeJson<Array<{ index: number; score: number }>>(raw);
      if (Array.isArray(parsed)) {
        const map = new Map(parsed.map(s => [s.index, Math.max(0, Math.min(20, s.score ?? 10))]));
        semanticScores = companies.map((_, i) => map.get(i + 1) ?? 10);
      }
    } catch { /* keep defaults */ }
  }

  // ── Step 3: Combined pre-reachability score ────────────────────────────
  const baseScored = companies.map((c, i) => {
    const f     = firmographic[i];
    const score = f.industry + f.size + f.geo + f.funding + f.tech + semanticScores[i];
    return { company: c, score, breakdown: { ...f, semantic: semanticScores[i] } };
  }).sort((a, b) => b.score - a.score);

  // ── Step 4: Parallel people search on top 8 ────────────────────────────
  const TOP_N     = 8;
  const topSlice  = baseScored.slice(0, TOP_N);
  const personas  = icp.personas ?? [];

  const reachResults = await Promise.allSettled(
    topSlice.map(({ company }) => checkReachability(company, personas))
  );

  // ── Step 5: Final score with reachability bonus + clamp to 100 ─────────
  const finalScored = baseScored.map((item, i) => {
    const reach = i < TOP_N && reachResults[i].status === "fulfilled"
      ? (reachResults[i] as PromiseFulfilledResult<{ reachable: boolean; count: number }>).value
      : { reachable: false, count: 0 };

    const bonus     = reachabilityBonus(reach);
    const rawScore  = item.score + bonus;
    const clamped   = Math.max(0, Math.min(100, rawScore));
    const tier: "T1" | "T2" | "T3" = clamped >= 75 ? "T1" : clamped >= 50 ? "T2" : "T3";

    const parts: string[] = [];
    if (item.breakdown.industry >= 20) parts.push("industry match");
    if (item.breakdown.size >= 15)     parts.push("right size");
    if (item.breakdown.geo >= 12)      parts.push("in target geography");
    if (item.breakdown.funding >= 8)   parts.push("recently funded");
    if (item.breakdown.tech >= 8)      parts.push("enterprise tech stack");
    if (reach.reachable)               parts.push("senior contact reachable");
    const rationale = parts.length ? parts.join(", ") : "partial ICP match";

    return {
      ...item.company,
      icp_score:       clamped,
      account_tier:    tier,
      score_rationale: rationale,
      reachable:       reach.reachable,
    };
  });

  return finalScored.sort((a, b) => (b.icp_score ?? 0) - (a.icp_score ?? 0));
}

export async function POST(req: Request) {
  let body: {
    role_id?:         string;
    target_markets?:  string[];
    page?:            number;
    icp?:             ICP;
    company_analysis?: CompanyAnalysis;
    filters?:         { industry?: string; location?: string; size?: string };
    // Legacy fallback — deprecated, kept for backwards compat
    persona?:         string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { role_id, target_markets, page, icp, company_analysis, filters } = body;

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

    const rawCompanies = await searchCompanies({
      q_organization_keyword_tags:       industries.length ? industries : undefined,
      organization_num_employees_ranges: employeeRanges.length ? employeeRanges : undefined,
      organization_locations:            locations,
      per_page: 20,
      page:     page ?? 1,
    });

    if (rawCompanies === null) {
      return NextResponse.json(
        { companies: [], error: "Apollo API error — check APOLLO_API_KEY" },
        { status: 200 }
      );
    }

    // Score and rank companies against ICP before returning
    const companies = rawCompanies.length > 0
      ? await batchScoreCompanies(rawCompanies, icp, company_analysis)
      : rawCompanies;

    return NextResponse.json({ companies, role_label: null, scored: true });
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
