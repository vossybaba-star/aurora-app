/**
 * app/api/contacts/notes/route.ts
 * GET  ?contact_id=...  — list notes
 * POST { contact_id, body } — add note
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contactId = new URL(req.url).searchParams.get("contact_id");
  if (!contactId) return NextResponse.json({ error: "contact_id required" }, { status: 400 });

  const { data, error } = await supabase
    .from("contact_notes")
    .select("id, body, created_at")
    .eq("contact_id", contactId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contact_id, body } = await req.json();
  if (!contact_id || !body) return NextResponse.json({ error: "contact_id and body required" }, { status: 400 });

  const { error } = await supabase
    .from("contact_notes")
    .insert({ user_id: user.id, contact_id, body });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also bump last_contacted_at
  await supabase
    .from("contacts")
    .update({ last_contacted_at: new Date().toISOString() })
    .eq("id", contact_id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
