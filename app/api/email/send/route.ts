import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import nylas from "@/lib/nylas";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { to, toName, subject, body, opportunityId, trackOpens = true } = await request.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get user's email connection
    const { data: connection } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!connection) {
      return NextResponse.json({ error: "No email account connected" }, { status: 400 });
    }

    // Add tracking pixel if tracking opens
    let emailBody = body;
    const trackingId = crypto.randomUUID();
    
    if (trackOpens) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const trackingPixel = `<img src="${baseUrl}/api/email/track/${trackingId}" width="1" height="1" style="display:none" />`;
      emailBody = `${body}\n\n${trackingPixel}`;
    }

    // Send email via Nylas
    const sentMessage = await nylas.messages.send({
      identifier: connection.grant_id,
      requestBody: {
        to: [{ email: to, name: toName || undefined }],
        subject,
        body: emailBody,
        trackingOptions: trackOpens ? {
          opens: true,
          links: true,
          threadReplies: true,
        } : undefined,
      },
    });

    // Store sent email in database
    const { data: sentEmail, error: dbError } = await supabase
      .from("sent_emails")
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId || null,
        email_connection_id: connection.id,
        nylas_message_id: sentMessage.data.id,
        nylas_thread_id: sentMessage.data.threadId,
        to_email: to,
        to_name: toName || null,
        subject,
        body,
        status: "sent",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to store sent email:", dbError);
    }

    // Update opportunity status if linked
    if (opportunityId) {
      await supabase
        .from("opportunities")
        .update({ status: "sent" })
        .eq("id", opportunityId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      messageId: sentMessage.data.id,
      threadId: sentMessage.data.threadId,
      sentEmailId: sentEmail?.id,
    });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
