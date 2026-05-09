import { NextResponse } from "next/server";
import { searchCompanies } from "@/lib/apollo";

/**
 * POST /api/apollo/company-lookup
 *
 * Company name autocomplete for the B2B onboarding wizard.
 * Searches for the USER'S OWN company (not prospects).
 *
 * Request: { query: string }
 * Response: { companies: ApolloCompany[] }
 */
export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json({ companies: [] });
    }

    const companies = await searchCompanies({
      q_organization_name: query.trim(),
      per_page: 5,
      page: 1,
    });

    return NextResponse.json({ companies: companies ?? [] });
  } catch (error) {
    console.error("[company-lookup] error:", error);
    return NextResponse.json({ companies: [] }, { status: 500 });
  }
}
