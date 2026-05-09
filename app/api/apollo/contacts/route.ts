import { NextResponse } from "next/server";
import { searchPeople } from "@/lib/apollo";

export async function POST(req: Request) {
  try {
    const {
      company,
      title,
      location,
      page     = 1,
      per_page = 18,
    } = await req.json();

    const people = await searchPeople({
      q_organization_name: company  || undefined,
      person_titles:       title    ? [title]    : undefined,
      person_locations:    location ? [location] : undefined,
      per_page,
      page,
    });

    return NextResponse.json({ contacts: people });
  } catch (err) {
    console.error("[apollo/contacts]", err);
    return NextResponse.json({ contacts: [] });
  }
}
