import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas, { NYLAS_CLIENT_ID } from "@/lib/nylas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // User ID passed from connect

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=no_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify user matches state
  if (!user || user.id !== state) {
    return NextResponse.redirect(`${baseUrl}/?error=auth_mismatch`);
  }

  try {
    const redirectUri = `${baseUrl}/api/email/callback`;

    console.log("[nylas callback] clientId:", NYLAS_CLIENT_ID);
    console.log("[nylas callback] redirectUri:", redirectUri);
    console.log("[nylas callback] apiKey prefix:", process.env.NYLAS_API_KEY?.slice(0, 12));

    // Exchange code for token
    const tokenResponse = await nylas.auth.exchangeCodeForToken({
      clientId: NYLAS_CLIENT_ID,
      redirectUri,
      code,
    });

    const { grantId, email } = tokenResponse;

    // Determine provider from email domain
    let provider = "other";
    if (email?.includes("@gmail.com") || email?.includes("@googlemail.com")) {
      provider = "google";
    } else if (email?.includes("@outlook.") || email?.includes("@hotmail.") || email?.includes("@live.")) {
      provider = "microsoft";
    }

    // Store the connection in database
    const { error: dbError } = await supabase
      .from("email_connections")
      .upsert({
        user_id: user.id,
        grant_id: grantId,
        email: email || "",
        provider,
        access_token: grantId, // Grant ID is used for API calls
        connected_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: "user_id,email",
      });

    if (dbError) {
      console.error("Failed to save email connection:", dbError);
      return NextResponse.redirect(`${baseUrl}/?error=db_error`);
    }

    return NextResponse.redirect(`${baseUrl}/?email_connected=true`);
  } catch (error) {
    console.error("Nylas OAuth error:", error);
    return NextResponse.redirect(`${baseUrl}/?error=oauth_failed`);
  }
}
