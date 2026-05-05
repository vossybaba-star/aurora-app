import { NextResponse } from "next/server";
import { getOutreachMessages } from "@/lib/actions";

export async function GET() {
  try {
    const messages = await getOutreachMessages();
    return NextResponse.json({ data: messages, success: true });
  } catch (error) {
    return NextResponse.json({ data: [], success: false, error: "Failed to fetch messages" }, { status: 500 });
  }
}
