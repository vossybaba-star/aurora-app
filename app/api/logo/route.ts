import { NextResponse } from "next/server";

/**
 * Server-side logo proxy — avoids browser CORS blocks on Clearbit / Apollo CDN.
 * GET /api/logo?domain=forbes.com  OR  GET /api/logo?url=https://...
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  const url    = searchParams.get("url");

  const src = url ?? (domain ? `https://logo.clearbit.com/${domain}` : null);
  if (!src) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(src, {
      headers: { "User-Agent": "Mozilla/5.0" },
      // 5s timeout
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return new NextResponse(null, { status: 404 });

    const buf         = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/png";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":  contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
