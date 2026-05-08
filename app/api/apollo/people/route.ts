import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/apollo";
import { getRoleById }  from "@/lib/roles";

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

  // ── Resolve person_titles from role config ───────────────────────────────
  const role = role_id ? getRoleById(role_id) : undefined;

  let personTitles: string[] = [];

  if (role?.contactKeywords) {
    // contactKeywords is comma-separated → split into array for person_titles
    personTitles = role.contactKeywords
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  } else {
    // Legacy persona fallback so existing callers don't break during rollout
    const legacyTitles: Record<string, string[]> = {
      makeup_artist: [
        "Head of Talent", "Casting", "Creative Director", "Brand Manager",
        "Campaign Producer", "PR Manager", "Bookings", "Production Manager",
        "Partnerships", "Marketing Manager", "Founder", "Director",
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

  // ── Generic / bot first-name blocklist ──────────────────────────────────
  const GENERIC_NAMES = new Set([
    "bride", "team", "admin", "info", "contact",
    "hello", "support", "sales", "enquiries", "office",
  ]);

  // ── Apollo people search ─────────────────────────────────────────────────
  // First try: scoped to company (may return 0 if company is thin in Apollo)
  const searchParams = {
    ...(company_name ? { q_organization_name: company_name } : {}),
    ...(domain       ? { organization_domains: [domain] }    : {}),
    person_titles: personTitles,
    per_page: 5,
    page:     1,
  };
  console.log("[apollo/people] role_id:", role_id, "titles:", personTitles);
  console.log("[apollo/people] Search params:", JSON.stringify(searchParams));

  let people = await searchPeople(searchParams);
  console.log("[apollo/people] Scoped result count:", people.length);

  // Fallback: if company-scoped search returns nothing, broaden to title-only
  if (people.length === 0 && (company_name || domain)) {
    console.log("[apollo/people] Falling back to title-only search (no org filter)");
    people = await searchPeople({ person_titles: personTitles, per_page: 5, page: 1 });
    console.log("[apollo/people] Broad result count:", people.length);
  }

  // Filter out generic / inbox-style first names
  const filtered = people.filter(
    (p) => !GENERIC_NAMES.has(p.first_name?.toLowerCase().trim() ?? "")
  );

  return NextResponse.json({ people: filtered });
}
