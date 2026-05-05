import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Google Places API types
interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address?: string;
  website?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  photo_reference?: string;
}

// Map opportunity types to Google Places search queries
const opportunityTypeToSearchQueries: Record<string, string[]> = {
  wedding_venue: ["wedding venue", "event venue", "banquet hall"],
  corporate_event: ["corporate event venue", "conference center", "hotel ballroom"],
  private_party: ["party venue", "private event space", "banquet hall"],
  restaurant: ["restaurant catering", "fine dining restaurant", "event catering"],
  hotel: ["hotel events", "boutique hotel", "resort"],
  winery: ["winery events", "vineyard wedding", "wine venue"],
  country_club: ["country club", "golf club events", "private club"],
  event_planner: ["event planner", "wedding planner", "event coordinator"],
  catering: ["catering company", "catering service"],
  venue: ["event venue", "wedding venue", "party venue"],
  event_organiser: ["event planner", "event management company"],
  market: ["farmers market", "artisan market", "craft fair"],
  wedding_planner: ["wedding planner", "bridal consultant"],
  agency: ["talent agency", "booking agency", "entertainment agency"],
  brand: ["corporate events", "brand activation venue"],
  publication: ["local magazine", "event publication", "wedding magazine"],
  other: ["event venue", "special event location"],
};

// Search for places using Google Places Text Search API (v1)
async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    // Simple text search - the query includes location context
    const requestBody = {
      textQuery: query,
      pageSize: 10,
    };
    
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.businessStatus,places.id",
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      return [];
    }
    
    if (data.places && Array.isArray(data.places)) {
      // Map API v1 response format to our PlaceResult format
      return data.places.map((place: any) => ({
        place_id: place.id || "",
        name: place.displayName?.text || "",
        formatted_address: place.formattedAddress || "",
        vicinity: place.formattedAddress || "",
        types: place.types || [],
        rating: place.rating || undefined,
        user_ratings_total: place.userRatingCount || undefined,
        business_status: place.businessStatus || "OPERATIONAL",
      }));
    }
    
    return [];
  } catch (error) {
    console.error("[v0] Places search error:", error);
    return [];
  }
}

// Get place details including website and phone (using v1 API)
async function getPlaceDetails(placeId: string, displayName?: string): Promise<PlaceDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    // Use the resource name format for v1 API: places/ChIJ...
    const resourceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
    
    const response = await fetch(
      `https://places.googleapis.com/v1/${resourceName}?fields=displayName,formattedAddress,websiteUri,nationalPhoneNumber,rating,userRatingCount,businessStatus,types,photos&languageCode=en`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
        },
      }
    );
    
    const data = await response.json();
    
    if (data) {
      // Get first photo reference if available (format: places/PLACE_ID/photos/PHOTO_REF)
      const photoRef = data.photos?.[0]?.name || undefined;
      
      return {
        place_id: placeId,
        name: data.displayName?.text || displayName || "",
        formatted_address: data.formattedAddress || "",
        website: data.websiteUri || undefined,
        formatted_phone_number: data.nationalPhoneNumber || undefined,
        rating: data.rating || undefined,
        user_ratings_total: data.userRatingCount || undefined,
        types: data.types || [],
        photo_reference: photoRef,
      };
    }
    return null;
  } catch (error) {
    console.error("Place details error:", error);
    return null;
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile for context
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check for API key
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return NextResponse.json({ 
        error: "Google Places API not configured. Please add GOOGLE_PLACES_API_KEY.",
        success: false 
      }, { status: 500 });
    }

    // Get existing opportunities to avoid duplicates
    const { data: existingOpps } = await supabase
      .from("opportunities")
      .select("name, google_place_id")
      .eq("user_id", user.id);

    const existingNames = new Set((existingOpps || []).map(o => o.name.toLowerCase()));
    const existingPlaceIds = new Set((existingOpps || []).filter(o => o.google_place_id).map(o => o.google_place_id));

    // Parse opportunity types from profile
    const opportunityTypes: string[] = profile.opportunity_types || ["venue", "event_organiser"];
    const location = profile.location || "New York, NY";
    const businessType = profile.business_type || "musician";

    // Validate location exists (we'll use location text in search queries)
    if (!location || location.trim().length < 2) {
      return NextResponse.json({ 
        error: "Please set your location in your profile to find opportunities.",
        success: false 
      }, { status: 400 });
    }

    // Search for places based on opportunity types
    const allPlaces: PlaceResult[] = [];
    const seenPlaceIds = new Set<string>();

    for (const oppType of opportunityTypes) {
      const searchQueries = opportunityTypeToSearchQueries[oppType] || opportunityTypeToSearchQueries.other;
      
      // Use first 2 search queries per type to limit API calls
      for (const query of searchQueries.slice(0, 2)) {
        // Include location in query for better results
        const fullQuery = `${query} near ${location}`;
        const places = await searchPlaces(fullQuery);
        
        for (const place of places) {
          // Skip if we've already seen this place or it exists in DB
          if (seenPlaceIds.has(place.place_id) || existingPlaceIds.has(place.place_id)) {
            continue;
          }
          // Skip if name already exists (fuzzy check)
          if (existingNames.has(place.name.toLowerCase())) {
            continue;
          }
          // Skip permanently closed places
          if (place.business_status === "CLOSED_PERMANENTLY") {
            continue;
          }
          
          seenPlaceIds.add(place.place_id);
          allPlaces.push(place);
        }
      }
    }

    // Limit to top 15 places for AI evaluation (to manage API costs)
    const placesToEvaluate = allPlaces.slice(0, 15);

    if (placesToEvaluate.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "No new opportunities found in your area. Try expanding your search criteria in your profile.",
        created: 0 
      });
    }

    // Get detailed info for places
    const placesWithDetails: PlaceDetails[] = [];
    for (const place of placesToEvaluate) {
      const details = await getPlaceDetails(place.place_id, place.name);
      if (details) {
        placesWithDetails.push(details);
      }
    }

    if (placesWithDetails.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: "Could not fetch business details. Please try again.",
        created: 0 
      });
    }

    // Use AI to evaluate and rank opportunities via Anthropic
    let aiOutput = null;
    try {
      const aiPrompt = `You are an AI assistant helping a ${businessType} find the best business opportunities for outreach.

USER PROFILE:
- Business: ${profile.business_name || businessType}
- Service: ${profile.pitch || `Professional ${businessType} services`}
- Location: ${location}
- Looking for: ${opportunityTypes.join(", ")}

REAL BUSINESSES FOUND FROM GOOGLE (these are real places!):
${placesWithDetails.map((p, i) => `
${i + 1}. ${p.name}
   - Address: ${p.formatted_address || "N/A"}
   - Rating: ${p.rating || "N/A"} (${p.user_ratings_total || 0} reviews)
   - Website: ${p.website || "None listed"}
   - Phone: ${p.formatted_phone_number || "None listed"}
   - Business Types: ${p.types?.slice(0, 5).join(", ") || "N/A"}
`).join("\n")}

Select the TOP 5 most promising opportunities for this ${businessType}. Consider:
1. How well the venue/business matches their service type
2. Business quality indicators (rating, review count)
3. Whether they have contact info available (website/phone)
4. Likelihood they would hire a ${businessType}

For each selected opportunity, provide:
- index: The number (1, 2, 3, etc.) of the business from the list above
- relevance_score: 1-10 (higher = better fit)
- opportunity_type: Best category from the allowed types
- priority: high/medium/low
- why_good_fit: Why it's a good fit (1-2 sentences)
- suggested_approach: Suggested approach for outreach (1 sentence)`;
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          messages: [{ role: "user", content: aiPrompt + "\n\nRespond ONLY with valid JSON matching this schema: {\"opportunities\": [{\"index\": number, \"relevance_score\": number, \"opportunity_type\": string, \"priority\": string, \"why_good_fit\": string, \"suggested_approach\": string}]}" }],
        }),
      });
      if (anthropicRes.ok) {
        const aiData = await anthropicRes.json();
        const text = aiData.content?.[0]?.text || "{}";
        aiOutput = JSON.parse(text.replace(/```json|```/g, "").trim());
      }
    } catch (e) {
      console.error("AI ranking failed:", e);
    }

    // Save the AI-selected opportunities to the database
    const selectedOpps = aiOutput?.opportunities || [];
    let createdCount = 0;

    for (const opp of selectedOpps) {
      // Use index (1-based from AI) to get place details
      const placeIndex = opp.index - 1; // Convert to 0-based
      if (placeIndex < 0 || placeIndex >= placesWithDetails.length) {
        continue;
      }
      const placeDetails = placesWithDetails[placeIndex];

      // Create the opportunity
      const { data: newOpp, error: oppError } = await supabase
        .from("opportunities")
        .insert({
          user_id: user.id,
          name: placeDetails.name,
          type: opp.opportunity_type,
          location: placeDetails.formatted_address || location,
          status: "new",
          priority: opp.priority,
          tags: ["aurora_ai", "google_places"],
          why_good_fit: opp.why_good_fit,
          notes: `Suggested approach: ${opp.suggested_approach}`,
          website: placeDetails.website || null,
          google_place_id: placeDetails.place_id,
          rating: placeDetails.rating || null,
          rating_count: placeDetails.user_ratings_total || null,
          photo_reference: placeDetails.photo_reference || null,
          source: "aurora_ai",
        })
        .select()
        .single();

      if (oppError) {
        console.error("Error creating opportunity:", oppError);
        continue;
      }

      createdCount++;

      // Enrich contact info from website
      let enrichedContacts: any = null;
      if (placeDetails.website) {
        try {
          const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';
          
          const enrichRes = await fetch(`${baseUrl}/api/enrich-contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              websiteUrl: placeDetails.website,
              placeId: placeDetails.place_id,
            }),
          });
          
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            enrichedContacts = enrichData.contactInfo;
            console.log("[v0] Enrichment result for", placeDetails.website, ":", JSON.stringify(enrichedContacts, null, 2));
          } else {
            console.error("[v0] Enrichment response not OK:", enrichRes.status);
          }
        } catch (enrichErr) {
          console.error("[v0] Enrichment failed:", enrichErr);
        }
      }

      // Update opportunity with contact form if found
      if (enrichedContacts?.contactForm) {
        await supabase
          .from("opportunities")
          .update({
            contact_form_url: enrichedContacts.contactForm.url,
            contact_form_label: enrichedContacts.contactForm.label,
            contact_form_confidence: enrichedContacts.contactForm.confidence,
          })
          .eq("id", newOpp.id);
      }

      // Add contact methods - prioritize enriched data
      const contactMethods: { opportunity_id: string; type: string; value: string; is_primary: boolean }[] = [];
      
      // Add emails from enrichment
      if (enrichedContacts?.emails?.length > 0) {
        enrichedContacts.emails.forEach((email: string, i: number) => {
          contactMethods.push({
            opportunity_id: newOpp.id,
            type: "email",
            value: email,
            is_primary: i === 0,
          });
        });
      }
      
      // Add Instagram from enrichment
      if (enrichedContacts?.instagram) {
        contactMethods.push({
          opportunity_id: newOpp.id,
          type: "instagram",
          value: enrichedContacts.instagram,
          is_primary: contactMethods.length === 0,
        });
      }
      
      // Add phone (from enrichment or Google Places)
      const phone = enrichedContacts?.phone || placeDetails.formatted_phone_number;
      if (phone) {
        contactMethods.push({
          opportunity_id: newOpp.id,
          type: "phone",
          value: phone,
          is_primary: contactMethods.length === 0,
        });
      }
      
      // Add website
      if (placeDetails.website) {
        contactMethods.push({
          opportunity_id: newOpp.id,
          type: "website",
          value: placeDetails.website,
          is_primary: contactMethods.length === 0,
        });
      }
      
      // Add Facebook from enrichment
      if (enrichedContacts?.facebook) {
        contactMethods.push({
          opportunity_id: newOpp.id,
          type: "facebook",
          value: enrichedContacts.facebook,
          is_primary: false,
        });
      }
      
      // Add LinkedIn from enrichment
      if (enrichedContacts?.linkedin) {
        contactMethods.push({
          opportunity_id: newOpp.id,
          type: "linkedin",
          value: enrichedContacts.linkedin,
          is_primary: false,
        });
      }

      // Insert all contact methods
      if (contactMethods.length > 0) {
        await supabase.from("contact_methods").insert(contactMethods);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Found ${createdCount} real business opportunities in ${location}!`,
      created: createdCount,
      evaluated: placesWithDetails.length,
    });

  } catch (error) {
    console.error("Find opportunities error:", error);
    return NextResponse.json({ 
      error: "Failed to find opportunities",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
