import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas, { NYLAS_CLIENT_ID } from "@/lib/nylas";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") || "google"; // google, microsoft, imap

  // Get the base URL for the callback
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/email/callback`;

  // Generate auth URL using Nylas hosted auth
  const authUrl = nylas.auth.urlForOAuth2({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    provider: provider as "google" | "microsoft" | "imap",
    state: user.id, // Pass user ID in state to link account after callback
    loginHint: user.email || undefined,
  });

  return NextResponse.redirect(authUrl);
}
