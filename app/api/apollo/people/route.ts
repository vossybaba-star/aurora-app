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

  const filterGeneric = (list: Awaited<ReturnType<typeof searchPeople>>) =>
    list.filter((p) => !GENERIC_NAMES.has(p.first_name?.toLowerCase().trim() ?? ""));

  // ── Apollo people search ─────────────────────────────────────────────────
  // Request 10 so we have headroom after filtering generics down to 3 display slots.
  // First try: scoped to company (may return 0 if company is thin in Apollo)
  const searchParams = {
    ...(company_name ? { q_organization_name: company_name } : {}),
    ...(domain       ? { organization_domains: [domain] }    : {}),
    person_titles: personTitles,
    per_page: 10,
    page:     1,
  };
  let people = filterGeneric(await searchPeople(searchParams));

  // Fallback: if company-scoped search returns nothing, broaden to title-only
  if (people.length === 0 && (company_name || domain)) {
    people = filterGeneric(
      await searchPeople({ person_titles: personTitles, per_page: 10, page: 1 })
    );
  }

  return NextResponse.json({ people });
}
