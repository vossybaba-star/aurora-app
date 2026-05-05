import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST - Add a new step to an existing sequence
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunityId, subject, body, delay_days, afterStep } = await request.json();

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  }

  // Get existing steps
  const { data: existingSteps } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("user_id", user.id)
    .order("step_number", { ascending: true });

  const newStepNumber = afterStep ? afterStep + 1 : (existingSteps?.length || 0) + 1;

  // Shift subsequent steps
  if (existingSteps) {
    for (const step of existingSteps) {
      if (step.step_number >= newStepNumber) {
        await supabase
          .from("email_sequence_steps")
          .update({ step_number: step.step_number + 1 })
          .eq("id", step.id);
      }
    }
  }

  // Calculate scheduled date based on previous step
  let scheduledAt = new Date();
  if (existingSteps && existingSteps.length > 0) {
    const prevStep = existingSteps.find(s => s.step_number === newStepNumber - 1);
    if (prevStep?.scheduled_at) {
      scheduledAt = new Date(new Date(prevStep.scheduled_at).getTime() + (delay_days || 3) * 24 * 60 * 60 * 1000);
    }
  }

  // Insert new step
  const { data: newStep, error } = await supabase
    .from("email_sequence_steps")
    .insert({
      user_id: user.id,
      opportunity_id: opportunityId,
      step_number: newStepNumber,
      subject: subject || "Follow up",
      body: body || "Hi,\n\nJust following up on my previous message.\n\nBest",
      delay_days: delay_days || 3,
      status: "pending",
      scheduled_at: scheduledAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ step: newStep });
}
