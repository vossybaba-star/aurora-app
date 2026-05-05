import { NextResponse } from "next/server";
import { getProfile } from "@/lib/actions";

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json({ data: profile, success: true });
  } catch (error) {
    return NextResponse.json({ data: null, success: false, error: "Failed to fetch profile" }, { status: 500 });
  }
}
