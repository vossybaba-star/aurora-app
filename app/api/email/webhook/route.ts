import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nylas from "@/lib/nylas";

export async function POST(request: Request) {
  // Instantiate inside handler — never at module level (Vercel Fluid compute safety)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const body = await request.json();
    
    // Handle Nylas webhook challenge
    if (body.type === "webhook.verify") {
      return NextResponse.json({ challenge: body.data.challenge });
    }

    const { type, data } = body;

    // Handle different webhook types
    switch (type) {
      case "message.created": {
        // Check if this is a reply to one of our sent messages
        const { threadId, grantId } = data.object;
        
        // Find the original sent email by thread ID
        const { data: sentEmail } = await supabase
          .from("sent_emails")
          .select("*, email_connections!inner(*)")
          .eq("nylas_thread_id", threadId)
          .eq("email_connections.grant_id", grantId)
          .single();

        if (sentEmail) {
          // This is a reply to our email
          await supabase
            .from("sent_emails")
            .update({
              replied_at: new Date().toISOString(),
              reply_message_id: data.object.id,
              status: "replied",
            })
            .eq("id", sentEmail.id);

          // Update opportunity status
          if (sentEmail.opportunity_id) {
            await supabase
              .from("opportunities")
              .update({ status: "replied" })
              .eq("id", sentEmail.opportunity_id);
          }
        }
        break;
      }

      case "message.opened": {
        // Track email open
        const { messageId } = data.object;
        
        const { data: sentEmail } = await supabase
          .from("sent_emails")
          .select("*")
          .eq("nylas_message_id", messageId)
          .single();

        if (sentEmail) {
          await supabase
            .from("sent_emails")
            .update({
              opened_at: sentEmail.opened_at || new Date().toISOString(),
              open_count: (sentEmail.open_count || 0) + 1,
              status: sentEmail.status === "replied" ? "replied" : "opened",
            })
            .eq("id", sentEmail.id);
        }
        break;
      }

      case "message.link_clicked": {
        // Could track link clicks here if needed
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// Handle webhook verification GET request
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("challenge");
  
  if (challenge) {
    return new NextResponse(challenge);
  }
  
  return NextResponse.json({ status: "ok" });
}
