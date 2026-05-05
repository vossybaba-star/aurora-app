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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/email/callback`;

  const authUrl = nylas.auth.urlForOAuth2({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    provider: provider as string,
    state: user.id,
    loginHint: user.email || undefined,
  });

  return NextResponse.redirect(authUrl);
}
