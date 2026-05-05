import { NextResponse } from "next/server";
import { getFollowUpTasks } from "@/lib/actions";

export async function GET() {
  try {
    const tasks = await getFollowUpTasks();
    return NextResponse.json({ data: tasks, success: true });
  } catch (error) {
    return NextResponse.json({ data: [], success: false, error: "Failed to fetch tasks" }, { status: 500 });
  }
}
