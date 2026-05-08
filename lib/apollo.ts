/**
 * lib/apollo.ts
 *
 * Shared Apollo.io API client.
 * Server-side only — never import from client components.
 */

const APOLLO_BASE = "https://api.apollo.io/v1";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ApolloCompany {
  id: string;
  name: string;
  website_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  industry: string | null;
  keywords: string[];
  estimated_num_employees: number | null;
  city: string | null;
  country: string | null;
  short_description: string | null;
  primary_domain: string | null;
  phone: string | null;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  organization_name: string | null;
  city: string | null;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function apiKey(): string {
  return process.env.APOLLO_API_KEY ?? "";
}

async function apolloPost<T>(path: string, body: object): Promise<T | null> {
  const key = apiKey();
  if (!key) {
    console.error("[apollo] APOLLO_API_KEY is not set");
    return null;
  }
  try {
    // Try header-based auth first (Apollo's preferred modern method)
    const res = await fetch(`${APOLLO_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": key,
      },
      // Also include api_key in body for backward compat
      body: JSON.stringify({ ...body, api_key: key }),
      // Opt out of Next.js fetch cache — results must be fresh
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "(unreadable)");
      console.error(`[apollo] ${path} → ${res.status}: ${text}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[apollo] ${path} fetch error:`, err);
    return null;
  }
}

// ── searchCompanies ────────────────────────────────────────────────────────

export interface SearchCompaniesParams {
  q_organization_keyword_tags?: string[];
  organization_locations?: string[];
  per_page?: number;
  page?: number;
}

interface ApolloOrganizationsResponse {
  organizations: RawOrganization[];
}

interface RawOrganization {
  id: string;
  name: string;
  website_url: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  industry: string | null;
  keywords: string[] | null;
  estimated_num_employees: number | null;
  city: string | null;
  country: string | null;
  short_description: string | null;
  primary_domain: string | null;
  sanitized_phone: string | null;
  phone: string | null;
}

export async function searchCompanies(params: SearchCompaniesParams): Promise<ApolloCompany[] | null> {
  const data = await apolloPost<ApolloOrganizationsResponse>("/mixed_companies/search", params);
  // null means the API call itself failed (401, 500, etc.) — caller can distinguish from empty results
  if (data === null) return null;
  if (!data?.organizations) return [];

  return data.organizations.map((o) => ({
    id: o.id,
    name: o.name,
    website_url: o.website_url ?? null,
    linkedin_url: o.linkedin_url ?? null,
    twitter_url: o.twitter_url ?? null,
    industry: o.industry ?? null,
    keywords: o.keywords ?? [],
    estimated_num_employees: o.estimated_num_employees ?? null,
    city: o.city ?? null,
    country: o.country ?? null,
    short_description: o.short_description ?? null,
    primary_domain: o.primary_domain ?? null,
    phone: o.sanitized_phone ?? o.phone ?? null,
  }));
}

// ── searchPeople ───────────────────────────────────────────────────────────

export interface SearchPeopleParams {
  q_organization_name?: string;
  organization_domains?: string[];
  /** Boolean keyword query, e.g. "Venue Manager OR Wedding Coordinator" */
  q_keywords?: string;
  per_page?: number;
  page?: number;
}

interface ApolloPeopleResponse {
  people: RawPerson[];
}

interface RawPerson {
  id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  organization?: { name: string | null } | null;
  city: string | null;
}

export async function searchPeople(params: SearchPeopleParams): Promise<ApolloPerson[]> {
  const data = await apolloPost<ApolloPeopleResponse>("/mixed_people/search", params);
  if (!data?.people) return [];

  return data.people.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    title: p.title ?? null,
    email: p.email ?? null,
    linkedin_url: p.linkedin_url ?? null,
    photo_url: p.photo_url ?? null,
    organization_name: p.organization?.name ?? null,
    city: p.city ?? null,
  }));
}
