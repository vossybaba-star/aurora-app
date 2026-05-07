/**
 * app/api/contacts/import-csv/route.ts
 *
 * Multipart CSV upload → parse → dedup → upsert into `contacts`.
 * Supports generic CSVs and Fresha client exports.
 *
 * Fresha detection: presence of "Client Name" + "Mobile" columns.
 * Column mapping is flexible — we try several canonical aliases.
 */

import { NextResponse } from "next/server";
import { createClient }  from "@/lib/supabase/server";
import Papa from "papaparse";
import { SignJWT } from "jose";
import { TextEncoder } from "util";

// ─── Column aliases ───────────────────────────────────────────────────────────

const NAME_KEYS   = ["name", "client name", "full name", "contact name", "first name", "customer name"];
const EMAIL_KEYS  = ["email", "email address", "e-mail"];
const PHONE_KEYS  = ["phone", "mobile", "telephone", "tel", "phone number", "mobile number"];
const IG_KEYS     = ["instagram", "instagram handle", "ig handle", "@instagram"];
const WEBSITE_KEYS= ["website", "url", "web"];

function findCol(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function isFresha(headers: string[]): boolean {
  const lower = headers.map(h => h.toLowerCase().trim());
  return lower.includes("client name") && (lower.includes("mobile") || lower.includes("email"));
}

// ─── JWT unsubscribe token ────────────────────────────────────────────────────

async function makeUnsubToken(contactId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-secret");
  return new SignJWT({ sub: contactId, purpose: "unsubscribe" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("365d")
    .sign(secret);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse multipart/form-data ─────────────────────────────────────────────
  let csvText = "";
  let relationshipType = "past_client";
  try {
    const form = await req.formData();
    const file = form.get("file");
    relationshipType = (form.get("relationship_type") as string) ?? "past_client";
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    csvText = await (file as File).text();
  } catch {
    return NextResponse.json({ error: "Failed to read form data" }, { status: 400 });
  }

  // ── Parse CSV ─────────────────────────────────────────────────────────────
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  });

  if (!parsed.data.length) {
    return NextResponse.json({ error: "CSV is empty" }, { status: 400 });
  }

  const headers  = parsed.meta.fields ?? [];
  const fresha   = isFresha(headers);
  const nameCol  = findCol(headers, fresha ? ["Client Name", ...NAME_KEYS] : NAME_KEYS);
  const emailCol = findCol(headers, EMAIL_KEYS);
  const phoneCol = findCol(headers, PHONE_KEYS);
  const igCol    = findCol(headers, IG_KEYS);
  const webCol   = findCol(headers, WEBSITE_KEYS);

  if (!nameCol) {
    return NextResponse.json(
      { error: `Could not find a name column. Headers: ${headers.join(", ")}` },
      { status: 422 }
    );
  }

  // ── Build rows ────────────────────────────────────────────────────────────
  const rows: Array<{
    user_id:           string;
    name:              string;
    email:             string | null;
    phone:             string | null;
    instagram_handle:  string | null;
    website:           string | null;
    relationship_type: string;
    source:            string;
    booking_platform:  string | null;
    status:            string;
    unsubscribe_token: string | null;
  }> = [];

  for (const row of parsed.data) {
    const name = row[nameCol]?.trim();
    if (!name) continue;

    const email = emailCol ? (row[emailCol]?.trim() || null) : null;
    const phone = phoneCol ? (row[phoneCol]?.trim() || null) : null;
    const ig    = igCol    ? (row[igCol]?.trim()    || null) : null;
    const web   = webCol   ? (row[webCol]?.trim()   || null) : null;

    // Generate unsubscribe token — we'll update after insert, but pre-generate placeholder
    rows.push({
      user_id:           user.id,
      name,
      email,
      phone,
      instagram_handle:  ig,
      website:           web,
      relationship_type: relationshipType,
      source:            fresha ? "fresha_import" : "csv_import",
      booking_platform:  fresha ? "fresha" : null,
      status:            "active",
      unsubscribe_token: null, // assigned after insert
    });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No valid rows found" }, { status: 422 });
  }

  // ── Upsert (dedup on user_id + email; nulls get fresh inserts) ───────────
  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      if (row.email) {
        // Dedup path
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", user.id)
          .eq("email", row.email)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }
      }

      const token = await makeUnsubToken(`pending-${Date.now()}-${Math.random()}`);
      const { data: inserted, error: insErr } = await supabase
        .from("contacts")
        .insert({ ...row, unsubscribe_token: token })
        .select("id")
        .single();

      if (insErr || !inserted) {
        errors.push(`Row "${row.name}": ${insErr?.message}`);
        continue;
      }

      // Update token with real ID
      const realToken = await makeUnsubToken(inserted.id);
      await supabase.from("contacts").update({ unsubscribe_token: realToken }).eq("id", inserted.id);

      imported++;
    } catch (err) {
      errors.push(`Row "${row.name}": ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    total: rows.length,
    errors: errors.slice(0, 10),
    fresha_detected: fresha,
  });
}
