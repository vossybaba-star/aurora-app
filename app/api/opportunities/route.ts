import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpportunities } from "@/lib/actions";

export async function GET() {
  try {
    const opportunities = await getOpportunities();
    return NextResponse.json({ data: opportunities, success: true });
  } catch (error) {
    return NextResponse.json({ data: [], success: false, error: "Failed to fetch opportunities" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    const { data: opportunity, error } = await supabase
      .from("opportunities")
      .insert({
        user_id: user.id,
        name: body.name,
        type: body.type || "venue",
        location: body.location || null,
        description: body.description || null,
        why_good_fit: body.whyGoodFit || null,
        status: body.status || "new",
        priority: body.priority || "medium",
        tags: body.tags || [],
        source: body.source || "manual",
        website: body.website || null,
        notes: body.notes || null,
        liked: body.liked ?? false,
        google_place_id: body.googlePlaceId || null,
        rating: body.rating || null,
        rating_count: body.ratingCount || null,
        photo_reference: body.photoReference || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add contact methods if provided
    if (body.contactMethods && body.contactMethods.length > 0) {
      const contactMethodsToInsert = body.contactMethods.map((cm: any, index: number) => ({
        opportunity_id: opportunity.id,
        type: cm.type,
        value: cm.value,
        is_primary: cm.isPrimary ?? index === 0,
        label: cm.label || null,
      }));

      await supabase.from("contact_methods").insert(contactMethodsToInsert);
    }

    return NextResponse.json({ success: true, id: opportunity.id });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create opportunity" }, { status: 500 });
  }
}
