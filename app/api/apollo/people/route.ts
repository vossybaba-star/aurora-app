import { NextResponse } from "next/server";

export async function POST(_req: Request) {
  // ── DIAGNOSTIC MODE ──────────────────────────────────────────────────────
  // Stripped to absolute minimum to confirm Apollo returns people at all.
  // Role-specific filtering will be restored once baseline is confirmed.
  const requestBody = {
    api_key:       process.env.APOLLO_API_KEY,
    person_titles: ["Marketing Manager", "Brand Manager", "Director", "Manager"],
    per_page:      5,
  };

  console.log("[apollo/people] Sending request:", JSON.stringify(requestBody));

  let data: Record<string, unknown>;
  try {
    const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.APOLLO_API_KEY ?? "" },
      body:    JSON.stringify(requestBody),
      cache:   "no-store",
    });

    console.log("[apollo/people] Response status:", response.status);

    data = await response.json() as Record<string, unknown>;
  } catch (err) {
    console.error("[apollo/people] Fetch error:", err);
    return NextResponse.json({ people: [] });
  }

  console.log("[apollo/people] Raw response keys:", Object.keys(data));
  if (data.error) console.error("[apollo/people] Apollo error message:", JSON.stringify(data.error));

  const people = Array.isArray(data.people) ? data.people : [];
  console.log("[apollo/people] People count:", people.length);
  console.log("[apollo/people] First person:", JSON.stringify(people[0] ?? null));

  return NextResponse.json({ people });
}
