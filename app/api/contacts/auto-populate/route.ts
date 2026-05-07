/**
 * app/api/contacts/auto-populate/route.ts
 *
 * POST — One-time backfill: create contacts from existing opportunities.
 *   - status = 'closed'       → venue_customer
 *   - status = 'sent' | 'replied' | 'follow_up_due' → venue_target
 *
 * Also reads profiles.past_clients text field (newline-separated names)
 * and creates past_client contacts.
 *
 * Idempotent: deduplicates by email where possible, or by opportunity_id.
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";
import { SignJWT }       from "jose";
import { TextEncoder }   from "util";

async function makeToken(id: string): Promise<string> {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET env var is not set");
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return new SignJWT({ sub: id, purpose: "unsubscribe" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(secret);
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let created = 0;
  let skipped  = 0;

  // ── 1. Opportunities → contacts ───────────────────────────────────────────
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, name, contact_email, instagram_handle, venue_id, status")
    .eq("user_id", user.id)
    .in("status", ["closed", "sent", "replied", "follow_up_due"]);

  for (const opp of opps ?? []) {
    // Skip if already linked
    const { data: linked } = await supabase
      .from("contacts")
      .select("id")
      .eq("opportunity_id", opp.id)
      .maybeSingle();

    if (linked) { skipped++; continue; }

    const relType = opp.status === "closed" ? "venue_customer" : "venue_target";
    const token   = await makeToken(`tmp-${Date.now()}-${Math.random()}`);

    const insertData: Record<string, unknown> = {
      user_id:           user.id,
      name:              opp.name,
      email:             opp.contact_email ?? null,
      instagram_handle:  opp.instagram_handle ?? null,
      relationship_type: relType,
      source:            "opportunity_active",
      opportunity_id:    opp.id,
      venue_id:          opp.venue_id ?? null,
      status:            "active",
      unsubscribe_token: token,
    };

    // Dedup by email if present
    if (opp.contact_email) {
      const { data: byEmail } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", user.id)
        .eq("email", opp.contact_email)
        .maybeSingle();

      if (byEmail) {
        // Update relationship type to customer if won
        if (relType === "venue_customer") {
          await supabase.from("contacts").update({ relationship_type: "venue_customer", opportunity_id: opp.id }).eq("id", byEmail.id);
        }
        skipped++;
        continue;
      }
    }

    const { data: inserted } = await supabase
      .from("contacts")
      .insert(insertData)
      .select("id")
      .single();

    if (inserted) {
      const realToken = await makeToken(inserted.id);
      await supabase.from("contacts").update({ unsubscribe_token: realToken }).eq("id", inserted.id);
      created++;
    }
  }

  // ── 2. Profile past_clients text → contacts ───────────────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("past_clients")
    .eq("id", user.id)
    .single();

  const pastClients: string[] = ((profile as Record<string, unknown>)?.past_clients as string ?? "")
    .split(/[\n,]+/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 2);

  for (const name of pastClients) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", name)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const token = await makeToken(`tmp-${Date.now()}-${Math.random()}`);
    const { data: inserted } = await supabase
      .from("contacts")
      .insert({
        user_id:           user.id,
        name,
        relationship_type: "past_client",
        source:            "profile_past_clients",
        status:            "active",
        unsubscribe_token: token,
      })
      .select("id")
      .single();

    if (inserted) {
      const realToken = await makeToken(inserted.id);
      await supabase.from("contacts").update({ unsubscribe_token: realToken }).eq("id", inserted.id);
      created++;
    }
  }

  return NextResponse.json({ created, skipped });
}
