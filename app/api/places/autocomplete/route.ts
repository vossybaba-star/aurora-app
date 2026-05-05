import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const input = searchParams.get("input");

  if (!input) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Use Google Places Autocomplete API (New)
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input,
          includedPrimaryTypes: ["locality", "administrative_area_level_1", "administrative_area_level_2", "postal_code", "neighborhood"],
          languageCode: "en",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google Places API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch predictions" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Transform to match our expected format
    const predictions = (data.suggestions || []).map((suggestion: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }) => ({
      place_id: suggestion.placePrediction?.placeId || "",
      description: suggestion.placePrediction?.text?.text || "",
      structured_formatting: {
        main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || "",
        secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || "",
      },
    }));

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("Places autocomplete error:", error);
    return NextResponse.json(
      { error: "Failed to fetch location suggestions" },
      { status: 500 }
    );
  }
}
