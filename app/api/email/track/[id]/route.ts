import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role for webhook/tracking (no user context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Update the sent email record
    await supabase
      .from("sent_emails")
      .update({
        opened_at: new Date().toISOString(),
        open_count: supabase.rpc("increment_open_count", { email_id: id }),
        status: "opened",
      })
      .eq("id", id)
      .is("opened_at", null); // Only update if not already opened
  } catch (error) {
    console.error("Track open error:", error);
  }

  // Return tracking pixel
  return new NextResponse(TRACKING_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
