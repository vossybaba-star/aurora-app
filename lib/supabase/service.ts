/**
 * lib/supabase/service.ts
 *
 * Service-role Supabase client for server-side operations that need to bypass
 * Row Level Security (e.g. writing to global `venues` table, nightly cron).
 *
 * ⚠️  NEVER import this in client components or expose the key to the browser.
 *     Only use in API routes and server actions.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}
