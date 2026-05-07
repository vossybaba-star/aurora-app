/**
 * POST /api/contacts/upsert-won
 *
 * Called when a user marks an opportunity as Won.
 * Upserts the lead into the Relationships table with relationship_type = 'venue_customer' (Client).
 *
 * Duplicate check order:
 *  1. contact.opportunity_id matches
 *  2. contact.email matches (non-null)
 * If found: update relationship_type to 'venue_customer'.
 * If not found: insert new contact linked to the opportunity.
 */

import { NextResponse }  from "next/server";
import { createClient }  from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { opportunity_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { opportunity_id } = body;
  if (!opportunity_id) {
    return NextResponse.json({ error: "opportunity_id required" }, { status: 400 });
  }

  // Fetch the opportunity to seed the contact record
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id, name, contact_email, instagram_handle, instagram_url, website, location")
    .eq("id", opportunity_id)
    .eq("user_id", user.id)
    .single();

  if (!opp) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

  // Check for existing contact: opportunity_id → email → name (case-insensitive)
  let existingId: string | null = null;

  const { data: byOpp } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunity_id)
    .maybeSingle();

  if (byOpp) {
    existingId = byOpp.id;
  } else if (opp.contact_email) {
    const { data: byEmail } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", user.id)
      .eq("email", opp.contact_email)
      .maybeSingle();
    if (byEmail) existingId = byEmail.id;
  }

  if (!existingId) {
    const { data: byName } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", opp.name.trim())
      .maybeSingle();
    if (byName) existingId = byName.id;
  }

  if (existingId) {
    const { error } = await supabase
      .from("contacts")
      .update({ relationship_type: "venue_customer", updated_at: new Date().toISOString() })
      .eq("id", existingId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contact_id: existingId, created: false });
  }

  // Insert new contact
  const { data: inserted, error: insertError } = await supabase
    .from("contacts")
    .insert({
      user_id:           user.id,
      name:              opp.name,
      email:             opp.contact_email    ?? null,
      instagram_handle:  opp.instagram_handle ?? null,
      website:           opp.website          ?? null,
      relationship_type: "venue_customer",
      source:            "won_outreach",
      status:            "active",
      opportunity_id:    opportunity_id,
      tags:              [],
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ contact_id: inserted?.id, created: true });
}
