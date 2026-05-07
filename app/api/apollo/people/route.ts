import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/apollo";

const PERSON_TITLES: Record<string, string[]> = {
  makeup_artist: [
    "Head of Talent", "Casting", "Creative Director", "Brand Manager",
    "Campaign Producer", "PR Manager", "Bookings", "Production Manager",
    "Partnerships", "Influencer", "Marketing Manager", "Founder", "Director",
  ],
  startup_founder: [
    "CEO", "Co-founder", "CTO", "Head of Partnerships", "VP Sales",
    "Business Development", "Head of Growth", "Investor",
    "Managing Director", "General Partner",
  ],
};

export async function POST(req: Request) {
  let body: { company_name?: string; domain?: string; persona?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { company_name, domain, persona } = body;

  const titles = persona ? PERSON_TITLES[persona] : undefined;
  if (!titles) {
    return NextResponse.json({ error: "Unknown persona" }, { status: 400 });
  }

  const people = await searchPeople({
    ...(company_name ? { q_organization_name: company_name } : {}),
    ...(domain       ? { organization_domains: [domain] }    : {}),
    person_titles: titles,
    per_page: 5,
    page: 1,
  });

  return NextResponse.json({ people });
}
