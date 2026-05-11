import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/apollo";

export async function POST(req: Request) {
  try {
    const {
      company,
      titles,          // string[] — preferred
      title,           // string   — legacy fallback
      location,
      employee_ranges, // string[] — e.g. ["1,10","11,50"]
      page     = 1,
      per_page = 18,
    } = await req.json();

    // Merge legacy single-title with new multi-title array
    const resolvedTitles: string[] | undefined =
      Array.isArray(titles) && titles.length > 0
        ? titles
        : title
          ? [title]
          : undefined;

    const people = await searchPeople({
      q_organization_name:               company || undefined,
      person_titles:                     resolvedTitles,
      person_locations:                  location ? [location] : undefined,
      organization_num_employees_ranges: Array.isArray(employee_ranges) && employee_ranges.length ? employee_ranges : undefined,
      per_page,
      page,
    });

    return NextResponse.json({ contacts: people });
  } catch (err) {
    console.error("[apollo/contacts]", err);
    return NextResponse.json({ contacts: [] });
  }
}
