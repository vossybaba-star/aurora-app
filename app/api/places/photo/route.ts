import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const photoReference = searchParams.get("ref");
  const maxWidth = searchParams.get("maxWidth") || "400";
  
  if (!photoReference) {
    return NextResponse.json({ error: "Missing photo reference" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // Google Places API v1 photo URL format
    // photoReference is like: places/ChIJ.../photos/Aap_uE...
    const photoUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
    
    const response = await fetch(photoUrl, {
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch photo" }, { status: response.status });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Photo fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch photo" }, { status: 500 });
  }
}
