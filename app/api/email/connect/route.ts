import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas, { NYLAS_CLIENT_ID } from "@/lib/nylas";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/email/callback`;

  console.log("[nylas connect] clientId:", NYLAS_CLIENT_ID);
  console.log("[nylas connect] redirectUri:", redirectUri);
  console.log("[nylas connect] apiUri:", process.env.NYLAS_API_URI);

  const { secret, url } = nylas.auth.urlForOAuth2PKCE({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    state: user.id,
    loginHint: user.email || undefined,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set("nylas_pkce_secret", secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
