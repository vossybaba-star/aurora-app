import { NextResponse }    from "next/server";
import { searchCompanies } from "@/lib/apollo";

const KEYWORD_TAGS: Record<string, string[]> = {
  makeup_artist: [
    "beauty", "fashion", "PR", "editorial", "talent",
    "modelling", "casting", "cosmetics", "luxury", "bridal",
  ],
  startup_founder: [
    "technology", "startup", "venture", "SaaS", "fintech",
    "accelerator", "investment",
  ],
};

export async function POST(req: Request) {
  let body: { persona?: string; location?: string; keyword?: string; page?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { persona, location, page } = body;

  const tags = persona ? KEYWORD_TAGS[persona] : undefined;
  if (!tags) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  const companies = await searchCompanies({
    q_organization_keyword_tags: tags,
    ...(location ? { organization_locations: [location] } : {}),
    per_page: 20,
    page: page ?? 1,
  });

  // companies === null means Apollo returned a non-OK response (e.g. 401)
  if (companies === null) {
    return NextResponse.json({ companies: [], error: "Apollo API error — check APOLLO_API_KEY" }, { status: 200 });
  }

  return NextResponse.json({ companies });
}
