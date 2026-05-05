import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's email connections
  const { data: connections } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);

  return NextResponse.json({
    connected: connections && connections.length > 0,
    connections: connections || [],
  });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { connectionId } = await request.json();

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId required" }, { status: 400 });
  }

  // Deactivate the connection
  const { error } = await supabase
    .from("email_connections")
    .update({ is_active: false })
    .eq("id", connectionId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
