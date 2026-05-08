import { NextResponse }  from "next/server";
import { searchPeople }  from "@/lib/apollo";
import { getRoleById }   from "@/lib/roles";

export async function POST(req: Request) {
  let body: {
    company_name?: string;
    domain?:       string;
    role_id?:      string;
    // Legacy fallback — deprecated
    persona?:      string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { company_name, domain, role_id } = body;

  // ── Resolve contact title list from role config ──────────────────────────
  const role = role_id ? getRoleById(role_id) : undefined;

  let personTitles: string[] = [];

  if (role?.contactKeywords) {
    // contactKeywords is a comma-separated string, e.g.:
    // "Head of Events, Event Coordinator, Venue Manager, Director of Events"
    // Joined with OR so Apollo treats it as a keyword query, not exact title match.
    personTitles = [
      role.contactKeywords
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .join(" OR "),
    ];
  } else {
    // Legacy persona fallback so existing callers don't break during rollout
    const legacyTitles: Record<string, string[]> = {
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
    const persona = body.persona ?? "";
    personTitles = legacyTitles[persona] ?? [];
  }

  if (personTitles.length === 0) {
    return NextResponse.json(
      { error: `Unknown role_id "${role_id ?? body.persona}" — no contact keywords found` },
      { status: 400 }
    );
  }

  // ── Apollo people search ─────────────────────────────────────────────────
  const people = await searchPeople({
    ...(company_name ? { q_organization_name: company_name }   : {}),
    ...(domain       ? { organization_domains: [domain] }      : {}),
    q_keywords: personTitles[0],
    per_page: 5,
    page:     1,
  });

  return NextResponse.json({ people });
}
