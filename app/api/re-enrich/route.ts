import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { opportunityId } = await request.json();

    const supabase = await createClient();

    // ── Auth check ────────────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the opportunity — scoped to this user only
    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .eq("user_id", user.id)
      .single();
    
    if (oppError || !opp) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    
    if (!opp.website) {
      return NextResponse.json({ error: "No website to enrich" }, { status: 400 });
    }
    
    // Call the enrich-contact API
    const enrichRes = await fetch(new URL("/api/enrich-contact", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteUrl: opp.website }),
    });
    
    if (!enrichRes.ok) {
      const errorText = await enrichRes.text();
      return NextResponse.json({ error: "Enrichment failed", details: errorText }, { status: 500 });
    }

    const enrichData = await enrichRes.json();
    
    const enrichedContacts = enrichData.contactInfo;
    
    // Delete existing contact methods (except those manually added)
    await supabase
      .from("contact_methods")
      .delete()
      .eq("opportunity_id", opportunityId);
    
    // Add new contact methods
    const contactMethods: { opportunity_id: string; type: string; value: string; is_primary: boolean }[] = [];
    
    // Add emails
    if (enrichedContacts?.emails?.length > 0) {
      enrichedContacts.emails.forEach((email: string, i: number) => {
        contactMethods.push({
          opportunity_id: opportunityId,
          type: "email",
          value: email,
          is_primary: i === 0,
        });
      });
    }
    
    // Add Instagram
    if (enrichedContacts?.instagram) {
      contactMethods.push({
        opportunity_id: opportunityId,
        type: "instagram",
        value: enrichedContacts.instagram,
        is_primary: contactMethods.length === 0,
      });
    }
    
    // Add Facebook
    if (enrichedContacts?.facebook) {
      contactMethods.push({
        opportunity_id: opportunityId,
        type: "facebook",
        value: enrichedContacts.facebook,
        is_primary: false,
      });
    }
    
    // Add LinkedIn
    if (enrichedContacts?.linkedin) {
      contactMethods.push({
        opportunity_id: opportunityId,
        type: "linkedin",
        value: enrichedContacts.linkedin,
        is_primary: false,
      });
    }
    
    // Add phone
    if (enrichedContacts?.phone) {
      contactMethods.push({
        opportunity_id: opportunityId,
        type: "phone",
        value: enrichedContacts.phone,
        is_primary: contactMethods.length === 0,
      });
    }
    
    // Add website
    contactMethods.push({
      opportunity_id: opportunityId,
      type: "website",
      value: opp.website,
      is_primary: contactMethods.length === 0,
    });
    
    // Insert contact methods
    if (contactMethods.length > 0) {
      const { error: insertError } = await supabase.from("contact_methods").insert(contactMethods);
      if (insertError) {
        console.error("[re-enrich] contact_methods insert error:", insertError);
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
        .eq("id", opportunityId);
    }
    
    return NextResponse.json({
      success: true,
      enrichedContacts,
      contactMethodsAdded: contactMethods.length,
    });
    
  } catch (error) {
    console.error("[v0] Re-enrich error:", error);
    return NextResponse.json({ 
      error: "Failed to re-enrich",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
