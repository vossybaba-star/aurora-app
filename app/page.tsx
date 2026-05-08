import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { KammieApp } from "@/components/kammie/kammie-app";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is logged in, check their onboarding status
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    // Redirect to dashboard or onboarding based on profile status
    if (profile?.onboarding_completed) {
      return <KammieApp initialState="dashboard" userId={user.id} />;
    } else {
      return <KammieApp initialState="onboarding" userId={user.id} />;
    }
  }

  // Not logged in - show landing page
  return <KammieApp initialState="landing" userId={null} />;
}
