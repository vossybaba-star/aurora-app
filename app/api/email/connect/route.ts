import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas, { NYLAS_CLIENT_ID } from "@/lib/nylas";
import { createHash, randomBytes } from "crypto";

function generateCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/email/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  console.log("[nylas connect] clientId:", NYLAS_CLIENT_ID);
  console.log("[nylas connect] redirectUri:", redirectUri);
  console.log("[nylas connect] apiUri:", process.env.NYLAS_API_URI);

  const authUrl = nylas.auth.urlForOAuth2PKCE({
    clientId: NYLAS_CLIENT_ID,
    redirectUri,
    state: user.id,
    loginHint: user.email || undefined,
    codeChallenge,
    codeChallengeMethod: "s256",
  });

  const response = NextResponse.redirect(authUrl);
  // Store code verifier in cookie so callback can use it
  response.cookies.set("nylas_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
