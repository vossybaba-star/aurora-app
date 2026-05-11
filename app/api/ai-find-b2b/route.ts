/**
 * POST /api/ai-find-b2b
 *
 * Orchestrates a full B2B prospecting run for the authenticated user:
 *   1. Load ICP + company_analysis from profile
 *   2. Search Apollo for matching companies
 *   3. Batch-score + rank against ICP (via the same logic as /api/apollo/companies)
 *   4. For T1/T2 companies (score ≥ 50), fetch Champion + DM contacts
 *   5. Upsert to opportunities table with signal_score, score_breakdown, source='ai_find'
 *
 * Returns: { success: boolean; created: number; message: string }
 */

import { NextResponse }                       from "next/server";
import { createClient }                       from "@/lib/supabase/server";
import { searchCompanies, searchPeople }      from "@/lib/apollo";
import type { ApolloCompany }                 from "@/lib/apollo";
import { callClaude, parseClaudeJson }        from "@/lib/anthropic/client";
import type { ICP, CompanyAnalysis }          from "@/lib/types";

// ── Scoring helpers (duplicated from apollo/companies to avoid cross-route imports) ──

const UK_TERMS = ["united kingdom", "uk", "england", "scotland", "wales", "northern ireland",
  "london", "manchester", "birmingham", "edinburgh", "bristol", "leeds", "glasgow"];

function scoreIndustry(industry: string | null, keywords: string[], icpIndustries: string[]): number {
  if (!icpIndustries.length) return 12;
  const haystack = [industry, ...keywords].filter(Boolean).join(" ").toLowerCase();
  let best = 0;
  for (const ind of icpIndustries) {
    const terms = ind.toLowerCase().split(/[\s,/]+/).filter(t => t.length > 2);
    const hits  = terms.filter(t => haystack.includes(t)).length;
    const ratio = terms.length ? hits / terms.length : 0;
    if (ratio >= 0.6) { best = 25; break; }
    if (ratio >= 0.3) best = Math.max(best, 12);
  }
  return best;
}

function scoreSize(employees: number | null, icpSizes: string[]): number {
  if (!icpSizes.length) return 10;
  if (employees == null) return 6;
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
    const locIsUK = UK_TERMS.some(t => location.includes(t));
    const geoIsUK = UK_TERMS.some(t => g.includes(t));
    if (locIsUK && geoIsUK) return 15;
  }
  return 0;
}

function scoreTiming(stage: string | null | undefined, growth: number | null | undefined): number {
  let score = 0;
  if (stage) {
    const s = stage.toLowerCase();
    if (s.includes("seed") || s.includes("series a"))                           score += 10;
    else if (s.includes("series b") || s.includes("series c"))                  score += 6;
    else if (s.includes("series d") || s.includes("growth") || s.includes("late")) score += 3;
    else if (s.includes("angel") || s.includes("bootstrap") || s.includes("private")) score += 1;
  }
  if (growth != null) {
    if (growth > 0.10)       score += 5;
    else if (growth >= 0.05) score += 3;
    else if (growth > 0)     score += 1;
  }
  return Math.min(score, 15);
}

function scoreTechStack(techNames: string[] | undefined): number {
  if (!techNames?.length) return 0;
  const ENTERPRISE = ["salesforce", "hubspot", "marketo", "pipedrive", "zendesk",
    "workday", "sap", "oracle", "intercom", "segment", "amplitude", "jira"];
  return techNames.some(t => ENTERPRISE.some(e => t.toLowerCase().includes(e))) ? 10 : 3;
}

const DM_TITLES = [
  "CEO", "Founder", "Co-Founder", "Managing Director", "Director",
  "VP", "Vice President", "Head of", "CTO", "CMO", "COO", "CFO",
  "President", "Partner", "Principal", "General Manager", "Owner",
];

async function checkTierReachability(
  company: ApolloCompany,
  titles: string[],
): Promise<{ reachable: boolean; person?: { name: string; title: string } }> {
  if (!titles.length) return { reachable: false };
  const params = company.primary_domain
    ? { organization_domains: [company.primary_domain], person_titles: titles, per_page: 5, page: 1 }
    : { q_organization_name: company.name,              person_titles: titles, per_page: 5, page: 1 };
  const people = await searchPeople(params);
  const match  = people.find(p =>
    titles.some(t => p.title?.toLowerCase().includes(t.toLowerCase()))
  );
  if (!match) return { reachable: false };
  return {
    reachable: true,
    person: {
      name:  [match.first_name, match.last_name].filter(Boolean).join(" "),
      title: match.title ?? "",
    },
  };
}

/** Maps ICP company_sizes strings → Apollo employee range "min,max" */
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

// ── Score + rank companies ────────────────────────────────────────────────────

interface ScoredCompany extends ApolloCompany {
  icp_score:                number;
  account_tier:             "T1" | "T2" | "T3";
  score_rationale:          string;
  recommended_angle?:       string;
  champion_reachable:       boolean;
  decision_maker_reachable: boolean;
  top_contact?:             { name: string; title: string };
}

async function scoreAndRank(
  companies: ApolloCompany[],
  icp: ICP,
  companyAnalysis?: CompanyAnalysis,
): Promise<ScoredCompany[]> {
  // Rule-based firmographic scores
  const firmographic = companies.map(c => ({
    industry: scoreIndustry(c.industry, c.keywords, icp.industries ?? []),
    size:     scoreSize(c.estimated_num_employees, icp.company_sizes ?? []),
    geo:      scoreGeography(c.city, c.country, icp.geography ?? []),
    timing:   scoreTiming(c.latest_funding_stage, c.employee_count_6_month_growth),
    tech:     scoreTechStack(c.technology_names),
  }));

  // Claude semantic fit — batch call (0-20 pts each)
  const valueProp = companyAnalysis?.value_proposition ?? companyAnalysis?.description ?? "";
  let semanticScores: number[] = companies.map(() => 10);

  if (valueProp) {
    const list = companies.map((c, i) =>
      `${i + 1}. ${[c.short_description, c.keywords.slice(0, 6).join(", ")].filter(Boolean).join(" | ") || "No description"}`
    ).join("\n");
    try {
      const raw    = await callClaude({
        model: "claude-haiku-4-5-20251001",
        maxTokens: 600,
        prompt: `Score each company's semantic fit (0-20) against a seller with this value proposition: "${valueProp}"

Companies:
${list}

Return JSON array ONLY — no other text:
[{"index":1,"score":<0-20>},...]

Judge: does this company's description/keywords suggest they'd benefit from what the seller offers?`,
      });
      const parsed = parseClaudeJson<Array<{ index: number; score: number }>>(raw);
      if (Array.isArray(parsed)) {
        const map = new Map(parsed.map(s => [s.index, Math.max(0, Math.min(20, s.score ?? 10))]));
        semanticScores = companies.map((_, i) => map.get(i + 1) ?? 10);
      }
    } catch { /* keep defaults */ }
  }

  // Pre-reachability sort
  const baseScored = companies.map((c, i) => {
    const f     = firmographic[i];
    const score = f.industry + f.size + f.geo + f.timing + f.tech + semanticScores[i];
    return { company: c, score, breakdown: { ...f, semantic: semanticScores[i] } };
  }).sort((a, b) => b.score - a.score);

  // Reachability check on top 8
  const TOP_N          = 8;
  const topSlice       = baseScored.slice(0, TOP_N);
  const championTitles = icp.champions      ?? [];
  const dmTitles       = [...new Set([...DM_TITLES, ...(icp.decision_makers ?? [])])];

  const [dmResults, championResults] = await Promise.all([
    Promise.allSettled(topSlice.map(({ company }) => checkTierReachability(company, dmTitles))),
    Promise.allSettled(topSlice.map(({ company }) => checkTierReachability(company, championTitles))),
  ]);

  return baseScored.map((item, i) => {
    const dm = i < TOP_N && dmResults[i].status === "fulfilled"
      ? (dmResults[i] as PromiseFulfilledResult<{ reachable: boolean; person?: { name: string; title: string } }>).value
      : { reachable: false };
    const champion = i < TOP_N && championResults[i].status === "fulfilled"
      ? (championResults[i] as PromiseFulfilledResult<{ reachable: boolean; person?: { name: string; title: string } }>).value
      : { reachable: false };

    const bonus   = dm.reachable ? 8 : champion.reachable ? 5 : 0;
    const clamped = Math.max(0, Math.min(100, item.score + bonus));
    const tier: "T1" | "T2" | "T3" = clamped >= 75 ? "T1" : clamped >= 50 ? "T2" : "T3";

    const parts: string[] = [];
    if (item.breakdown.industry >= 20) parts.push("industry match");
    if (item.breakdown.size >= 15)     parts.push("right size");
    if (item.breakdown.geo >= 12)      parts.push("in target geography");
    if (item.breakdown.timing >= 8)    parts.push("strong timing signal");
    if (item.breakdown.tech >= 8)      parts.push("enterprise tech stack");
    if (dm.reachable)                  parts.push("decision maker reachable");
    else if (champion.reachable)       parts.push("champion reachable");

    const stage = item.company.latest_funding_stage?.toLowerCase() ?? "";
    const growth = item.company.employee_count_6_month_growth ?? 0;
    let recommended_angle: string | undefined;
    if (stage.includes("seed") || stage.includes("series a"))
      recommended_angle = "Just raised early-stage funding — lead with scaling challenges and building the right foundations.";
    else if (stage.includes("series b") || stage.includes("series c"))
      recommended_angle = "Growth-stage funding — lead with efficiency, ROI, and supporting rapid team expansion.";
    else if (growth > 0.10)
      recommended_angle = "Strong headcount growth — lead with operational efficiency and keeping pace with scale.";
    else if (item.breakdown.tech >= 8)
      recommended_angle = "Enterprise tech stack — lead with integration, workflow fit, and measurable ROI.";

    // Best contact to surface: prefer DM, fall back to champion
    const top_contact = dm.person ?? champion.person;

    return {
      ...item.company,
      icp_score:                clamped,
      account_tier:             tier,
      score_rationale:          parts.length ? parts.join(", ") : "partial ICP match",
      recommended_angle,
      champion_reachable:       champion.reachable,
      decision_maker_reachable: dm.reachable,
      top_contact,
      _breakdown:               item.breakdown,
    } as ScoredCompany & { _breakdown: typeof item.breakdown };
  }).sort((a, b) => b.icp_score - a.icp_score) as ScoredCompany[];
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    // Load profile with ICP + company analysis
    const { data: profile } = await supabase
      .from("profiles")
      .select("icp, company_analysis")
      .eq("id", user.id)
      .single();

    const icp             = profile?.icp             as ICP             | undefined;
    const companyAnalysis = profile?.company_analysis as CompanyAnalysis | undefined;

    if (!icp || !icp.industries?.length) {
      return NextResponse.json({
        success: false,
        error: "Complete your ICP first — add at least one target industry in your profile.",
      });
    }

    // Avoid re-inserting companies already in the pipeline
    const { data: existingOpps } = await supabase
      .from("opportunities")
      .select("name")
      .eq("user_id", user.id)
      .eq("source", "ai_find");
    const existingNames = new Set((existingOpps ?? []).map(o => o.name.toLowerCase()));

    // Search Apollo for matching companies
    const employeeRanges = icpSizesToRanges(icp.company_sizes ?? []);
    const locations      = icp.geography?.length ? icp.geography : ["United Kingdom"];

    const rawCompanies = await searchCompanies({
      q_organization_keyword_tags:       icp.industries.length ? icp.industries : undefined,
      organization_num_employees_ranges: employeeRanges.length ? employeeRanges : undefined,
      organization_locations:            locations,
      per_page: 20,
      page:     1,
    });

    if (rawCompanies === null) {
      return NextResponse.json({
        success: false,
        error: "Apollo API error — check APOLLO_API_KEY",
      });
    }

    if (!rawCompanies.length) {
      return NextResponse.json({
        success: true,
        created: 0,
        message: "No matching companies found. Try broadening your ICP industries or geography.",
      });
    }

    // Score + rank
    const scored = await scoreAndRank(rawCompanies, icp, companyAnalysis);

    // Only upsert T1 + T2 (score ≥ 50), skip already-known companies
    const toCreate = scored
      .filter(c => c.icp_score >= 50 && !existingNames.has(c.name.toLowerCase()))
      .slice(0, 10);

    let created = 0;

    for (const company of toCreate) {
      const breakdown = (company as ScoredCompany & { _breakdown?: Record<string, number> })._breakdown;

      const tier = company.account_tier;
      const priority = tier === "T1" ? "high" : tier === "T2" ? "medium" : "low";

      const ai_analysis = {
        opportunity_type:     "B2B company",
        priority,
        why_good_fit:         company.score_rationale,
        recommended_angle:    company.recommended_angle ?? null,
        champion_reachable:   company.champion_reachable,
        decision_maker_reach: company.decision_maker_reachable,
        account_tier:         company.account_tier,
        icp_score:            company.icp_score,
      };

      const score_breakdown = breakdown ? {
        industry:  breakdown.industry,
        size:      breakdown.size,
        geo:       breakdown.geo,
        timing:    breakdown.timing,
        tech:      breakdown.tech,
        semantic:  breakdown.semantic,
        reachability: company.decision_maker_reachable ? 8 : company.champion_reachable ? 5 : 0,
      } : null;

      const { error } = await supabase
        .from("opportunities")
        .upsert(
          {
            user_id:          user.id,
            name:             company.name,
            type:             "B2B company",
            website:          company.website_url ?? null,
            status:           "new",
            priority,
            tags:             ["aurora_ai", "apollo", company.account_tier],
            why_good_fit:     company.score_rationale,
            notes:            company.recommended_angle
              ? `Suggested angle: ${company.recommended_angle}`
              : null,
            source:           "ai_find",
            signal_score:     company.icp_score,
            score_breakdown,
            ai_analysis,
            contact_name:     company.top_contact?.name  ?? null,
            contact_title:    company.top_contact?.title ?? null,
            enrichment_status: "pending",
          },
          { onConflict: "name,user_id" }
        );

      if (!error) created++;
      else console.error("[ai-find-b2b] upsert error:", error.message);
    }

    return NextResponse.json({
      success: true,
      created,
      message: created > 0
        ? `Found ${created} ICP-matched ${created === 1 ? "company" : "companies"} — sorted by Kammie score.`
        : "All matching companies are already in your pipeline.",
    });

  } catch (err) {
    console.error("[ai-find-b2b]", err);
    return NextResponse.json({ success: false, error: "Something went wrong." });
  }
}
