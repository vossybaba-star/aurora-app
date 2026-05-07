/**
 * app/api/contacts/list/route.ts
 * GET /api/contacts/list?type=all|venue_customer|past_client|venue_target
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url  = new URL(req.url);
  const type = url.searchParams.get("type");

  let query = supabase
    .from("contacts")
    .select(`
      id, name, email, phone, instagram_handle, website,
      relationship_type, source, status,
      last_contacted_at, next_action, next_action_due,
      tags, ai_notes, ai_notes_updated_at,
      booking_platform, unsubscribed_at,
      opportunity_id, venue_id,
      created_at, updated_at
    `)
    .eq("user_id", user.id)
    .neq("status", "unsubscribed")
    .order("updated_at", { ascending: false });

  if (type && type !== "all") {
    query = query.eq("relationship_type", type);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contacts: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, email, phone, instagram_handle, website, relationship_type, tags } = body;

  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: user.id,
      name,
      email:             email || null,
      phone:             phone || null,
      instagram_handle:  instagram_handle || null,
      website:           website || null,
      relationship_type: relationship_type ?? "lead",
      tags:              tags ?? [],
      source:            "manual",
      status:            "active",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact_id: data?.id });
}
