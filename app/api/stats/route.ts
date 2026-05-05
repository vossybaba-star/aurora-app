import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/actions";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    return NextResponse.json({ data: stats, success: true });
  } catch (error) {
    return NextResponse.json({ data: null, success: false, error: "Failed to fetch stats" }, { status: 500 });
  }
}
