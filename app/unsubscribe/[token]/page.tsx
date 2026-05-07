/**
 * app/unsubscribe/[token]/page.tsx
 *
 * GDPR-compliant unsubscribe landing page.
 * Verifies JWT, marks contact as unsubscribed.
 * Server component — no client JS needed.
 */

import { jwtVerify }        from "jose";
import { TextEncoder }       from "util";
import { createServiceClient } from "@/lib/supabase/service";

interface Props {
  params: Promise<{ token: string }>;
}

async function handleUnsubscribe(token: string): Promise<{ name: string | null; error: string | null }> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-secret");
    const { payload } = await jwtVerify(token, secret);

    if (payload.purpose !== "unsubscribe" || !payload.sub) {
      return { name: null, error: "Invalid unsubscribe link." };
    }

    const service = createServiceClient();
    const { data: contact } = await service
      .from("contacts")
      .select("id, name, unsubscribed_at")
      .eq("id", payload.sub)
      .maybeSingle();

    if (!contact) return { name: null, error: "Contact not found." };
    if (contact.unsubscribed_at) return { name: contact.name, error: null }; // already done

    await service.from("contacts").update({
      unsubscribed_at: new Date().toISOString(),
      status:          "unsubscribed",
    }).eq("id", contact.id);

    return { name: contact.name, error: null };
  } catch {
    return { name: null, error: "This unsubscribe link is invalid or has expired." };
  }
}

export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  const { name, error } = await handleUnsubscribe(token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d1a] px-4">
      <div
        className="max-w-md w-full rounded-2xl p-8 text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
        }}
      >
        {error ? (
          <>
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-semibold text-white mb-2">Invalid Link</h1>
            <p className="text-sm text-white/50">{error}</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-white mb-2">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-sm text-white/50 mb-4">
              {name ? `${name}, you` : "You"} will no longer receive nurture emails from this sender.
            </p>
            <p className="text-xs text-white/30">
              This is a GDPR-compliant opt-out. Your data remains on file but you will not be contacted automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
