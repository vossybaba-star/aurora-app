import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Map opportunity types to Google Places search queries
const typeToSearchQuery: Record<string, string> = {
  venue: "event venue",
  event_organiser: "event planner",
  market: "farmers market",
  wedding_planner: "wedding planner",
  agency: "talent agency",
  brand: "corporate events",
  publication: "local magazine",
  restaurant: "restaurant",
  hotel: "hotel",
  winery: "winery",
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("location, business_type").eq("id", user.id).single();
    const location = profile?.location || "London";
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Google Places API not configured" }, { status: 500 });
    const searchQuery = `event venue wedding venue near ${location}`;
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.businessStatus,places.websiteUri,places.photos,nextPageToken",
      },
      body: JSON.stringify({ textQuery: searchQuery, pageSize: 20 }),
    });
    const data = await response.json();
    const places = (data.places || []).map((place) => ({
      id: place.id, name: place.displayName?.text || "",
      address: place.formattedAddress || "", types: place.types || [],
      rating: place.rating, ratingCount: place.userRatingCount,
      website: place.websiteUri, photoReference: place.photos?.[0]?.name,
      businessStatus: place.businessStatus,
    })).filter((p) => p.businessStatus !== "CLOSED_PERMANENTLY");
    return NextResponse.json({ places, location, nextPageToken: data.nextPageToken || null });
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, location, type, pageToken } = await request.json();

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Google Places API not configured" }, { status: 500 });
    }

    // Build search query
    let searchQuery = query || typeToSearchQuery[type] || "event venue";
    if (location) {
      searchQuery = `${searchQuery} near ${location}`;
    }

    // Use Google Places Text Search API (v1)
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.businessStatus,places.websiteUri,places.photos,nextPageToken",
        },
        body: JSON.stringify({
          textQuery: searchQuery,
          pageSize: 20,
          ...(pageToken ? { pageToken } : {}),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[v0] Places search error:", data);
      return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }

    // Map to our format
    const places = (data.places || []).map((place: any) => ({
      id: place.id,
      name: place.displayName?.text || "",
      address: place.formattedAddress || "",
      types: place.types || [],
      rating: place.rating,
      ratingCount: place.userRatingCount,
      website: place.websiteUri,
      photoReference: place.photos?.[0]?.name,
      businessStatus: place.businessStatus,
    })).filter((place: any) => place.businessStatus !== "CLOSED_PERMANENTLY");

    return NextResponse.json({ places, nextPageToken: data.nextPageToken || null });

  } catch (error) {
    console.error("[v0] Places search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

// GET endpoint for initial load based on user's location
