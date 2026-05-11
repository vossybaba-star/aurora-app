import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enrichPerson } from "@/lib/apollo";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { first_name, last_name, organization_name, domain } = await req.json();

    if (!first_name)
      return NextResponse.json({ error: "first_name required" }, { status: 400 });

    const person = await enrichPerson({ first_name, last_name, organization_name, domain });

    return NextResponse.json({ person });
  } catch (err) {
    console.error("[contacts/enrich]", err);
    return NextResponse.json({ person: null });
  }
}
