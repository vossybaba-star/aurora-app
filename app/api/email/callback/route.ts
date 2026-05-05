import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas, { NYLAS_CLIENT_ID } from "@/lib/nylas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // User ID passed from connect

  if (!code) {
    return NextResponse.redirect("/dashboard?error=no_code");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify user matches state
  if (!user || user.id !== state) {
    return NextResponse.redirect("/dashboard?error=auth_mismatch");
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/email/callback`;

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
      return NextResponse.redirect("/dashboard?error=db_error");
    }

    // Redirect back to dashboard with success
    return NextResponse.redirect("/dashboard?email_connected=true");
  } catch (error) {
    console.error("Nylas OAuth error:", error);
    return NextResponse.redirect("/dashboard?error=oauth_failed");
  }
}
