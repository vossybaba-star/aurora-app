/**
 * app/api/nurture/send-due/route.ts
 *
 * Sends all due nurture sequence steps (step 2 + step 3).
 * Called by the nightly-enrichment cron; can also be triggered manually.
 *
 * Auth: CRON_SECRET bearer token (same as other internal routes).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NYLAS_API_KEY) {
    return NextResponse.json({ status: "skipped", reason: "NYLAS_API_KEY not set", sent: 0 });
  }

  const service = createServiceClient();
  const now     = new Date().toISOString();
  const nylasApiUri = process.env.NYLAS_API_URI ?? "https://api.us.nylas.com";

  const sendStep = async (
    seqId:     string,
    contactId: string,
    userId:    string,
    subject:   string,
    body:      string,
    step:      2 | 3
  ): Promise<boolean> => {
    const { data: contact } = await service
      .from("contacts")
      .select("email, name, unsubscribed_at")
      .eq("id", contactId)
      .single();

    if (!contact?.email || contact.unsubscribed_at) return false;

    const { data: emailConn } = await service
      .from("email_connections")
      .select("grant_id, email")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!emailConn?.grant_id) {
      console.warn(`[nurture/send-due] No active email connection for user ${userId}`);
      return false;
    }

    const { data: profile } = await service
      .from("profiles")
      .select("business_name")
      .eq("id", userId)
      .single();

    try {
      const res = await fetch(
        `${nylasApiUri}/v3/grants/${emailConn.grant_id}/messages/send`,
        {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${process.env.NYLAS_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject,
            body,
            to:   [{ name: contact.name, email: contact.email }],
            from: emailConn.email
              ? [{ name: profile?.business_name ?? "Kammie", email: emailConn.email }]
              : undefined,
          }),
        }
      );

      if (!res.ok) {
        console.error("[nurture/send-due] Nylas send failed", await res.text());
        return false;
      }

      const sentCol = step === 2 ? "step2_sent_at" : "step3_sent_at";
      await service.from("nurture_sequences").update({ [sentCol]: now }).eq("id", seqId);

      if (step === 3) {
        await service.from("nurture_sequences").update({ status: "completed" }).eq("id", seqId);
      }

      await service.from("contact_interactions").insert({
        user_id:      userId,
        contact_id:   contactId,
        type:         "nurture_sent",
        subject,
        body,
        direction:    "outbound",
        nurture_step: step,
        occurred_at:  now,
      });

      return true;
    } catch (err) {
      console.error("[nurture/send-due] Nylas error:", err);
      return false;
    }
  };

  const [{ data: step2Due }, { data: step3Due }] = await Promise.all([
    service
      .from("nurture_sequences")
      .select("id, contact_id, user_id, step2_subject, step2_body, step2_send_at, step2_sent_at")
      .eq("status", "active")
      .lte("step2_send_at", now)
      .is("step2_sent_at", null)
      .limit(20),
    service
      .from("nurture_sequences")
      .select("id, contact_id, user_id, step3_subject, step3_body, step3_send_at, step3_sent_at")
      .eq("status", "active")
      .lte("step3_send_at", now)
      .is("step3_sent_at", null)
      .limit(20),
  ]);

  let sent = 0;

  for (const seq of step2Due ?? []) {
    if (await sendStep(seq.id, seq.contact_id, seq.user_id, seq.step2_subject ?? "", seq.step2_body ?? "", 2)) {
      sent++;
    }
  }

  for (const seq of step3Due ?? []) {
    if (await sendStep(seq.id, seq.contact_id, seq.user_id, seq.step3_subject ?? "", seq.step3_body ?? "", 3)) {
      sent++;
    }
  }

  return NextResponse.json({ status: "complete", sent });
}
