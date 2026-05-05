import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - Fetch sequence steps for an opportunity
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const opportunityId = request.nextUrl.searchParams.get("opportunityId");

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  }

  const { data: steps, error } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("opportunity_id", opportunityId)
    .eq("user_id", user.id)
    .order("step_number", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps });
}

// POST - Create initial sequence for an opportunity (4 emails by default)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { opportunityId } = await request.json();

  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
  }

  // Check if sequence already exists
  const { data: existing } = await supabase
    .from("email_sequence_steps")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Sequence already exists" }, { status: 400 });
  }

  // Get the opportunity and cached message
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("*, cached_message")
    .eq("id", opportunityId)
    .eq("user_id", user.id)
    .single();

  if (!opportunity) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  // Get user profile for personalization
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const businessName = profile?.business_name || "our team";
  const firstName = profile?.full_name?.split(" ")[0] || "Hi";
  const serviceType = profile?.business_type || "services";
  const pitch = profile?.pitch || "";

  // Build social links for signature
  const socialLinks: string[] = [];
  if (profile?.website) socialLinks.push(profile.website);
  if (profile?.instagram) {
    const igHandle = profile.instagram.startsWith('http') 
      ? profile.instagram 
      : `instagram.com/${profile.instagram.replace('@', '')}`;
    socialLinks.push(igHandle);
  }
  if (profile?.linkedin) socialLinks.push(profile.linkedin);
  
  const linksSignature = socialLinks.length > 0 
    ? `\n\n${socialLinks.join(' | ')}`
    : '';

  // Use cached message for first email, generate follow-ups
  const cachedMessage = opportunity.cached_message;
  const firstSubject = cachedMessage?.subject || `${serviceType} collaboration with ${opportunity.name}`;
  const firstBody = cachedMessage?.body || `Hi,\n\nI wanted to reach out about a potential partnership opportunity.\n\nBest,\n${firstName}${linksSignature}`;

  // Default 4-email sequence with better personalization
  const defaultSteps = [
    {
      step_number: 1,
      subject: firstSubject,
      body: firstBody,
      delay_days: 0, // Send immediately
      status: "pending",
    },
    {
      step_number: 2,
      subject: `Re: ${firstSubject}`,
      body: `Hi,

Just following up on my previous email about working together. I think ${opportunity.name} would be a perfect fit for what I do${pitch ? ` - ${pitch.toLowerCase()}` : ''}.

Would you have 15 minutes this week for a quick chat? Happy to work around your schedule.

${firstName}${linksSignature}`,
      delay_days: 3,
      status: "pending",
    },
    {
      step_number: 3,
      subject: `Re: ${firstSubject}`,
      body: `Hi,

I know you're busy so I'll keep this short - I'd still love to connect about a potential collaboration with ${opportunity.name}.

If it helps, you can check out my recent work here: ${profile?.website || profile?.instagram || '[your portfolio]'}

Let me know if you'd be open to a quick conversation.

${firstName}`,
      delay_days: 5,
      status: "pending",
    },
    {
      step_number: 4,
      subject: `Re: ${firstSubject}`,
      body: `Hi,

This will be my last follow-up - I don't want to clog your inbox!

If the timing isn't right, no worries at all. But if you're ever looking for ${serviceType} support, I'd love to help ${opportunity.name}.

Feel free to reach out anytime: ${profile?.phone || profile?.website || '[contact info]'}

All the best,
${firstName}${linksSignature}`,
      delay_days: 7,
      status: "pending",
    },
  ];

  // Calculate scheduled dates
  let currentDate = new Date();
  const stepsWithDates = defaultSteps.map((step) => {
    if (step.step_number > 1) {
      currentDate = new Date(currentDate.getTime() + step.delay_days * 24 * 60 * 60 * 1000);
    }
    return {
      ...step,
      user_id: user.id,
      opportunity_id: opportunityId,
      scheduled_at: currentDate.toISOString(),
    };
  });

  const { data: steps, error } = await supabase
    .from("email_sequence_steps")
    .insert(stepsWithDates)
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps });
}

// PATCH - Update a sequence step
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stepId, subject, body, delay_days, status } = await request.json();

  if (!stepId) {
    return NextResponse.json({ error: "stepId required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (subject !== undefined) updates.subject = subject;
  if (body !== undefined) updates.body = body;
  if (delay_days !== undefined) updates.delay_days = delay_days;
  if (status !== undefined) updates.status = status;

  const { data: step, error } = await supabase
    .from("email_sequence_steps")
    .update(updates)
    .eq("id", stepId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If delay changed, recalculate scheduled dates for this and subsequent steps
  if (delay_days !== undefined) {
    const { data: allSteps } = await supabase
      .from("email_sequence_steps")
      .select("*")
      .eq("opportunity_id", step.opportunity_id)
      .order("step_number", { ascending: true });

    if (allSteps) {
      let currentDate = new Date();
      for (const s of allSteps) {
        if (s.step_number > 1) {
          currentDate = new Date(currentDate.getTime() + s.delay_days * 24 * 60 * 60 * 1000);
        }
        if (s.status === "pending") {
          await supabase
            .from("email_sequence_steps")
            .update({ scheduled_at: currentDate.toISOString() })
            .eq("id", s.id);
        }
      }
    }
  }

  return NextResponse.json({ step });
}

// DELETE - Remove a sequence step
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stepId = request.nextUrl.searchParams.get("stepId");

  if (!stepId) {
    return NextResponse.json({ error: "stepId required" }, { status: 400 });
  }

  // Get the step first to know its opportunity
  const { data: step } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("id", stepId)
    .eq("user_id", user.id)
    .single();

  if (!step) {
    return NextResponse.json({ error: "Step not found" }, { status: 404 });
  }

  // Delete the step
  const { error } = await supabase
    .from("email_sequence_steps")
    .delete()
    .eq("id", stepId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Renumber remaining steps
  const { data: remainingSteps } = await supabase
    .from("email_sequence_steps")
    .select("*")
    .eq("opportunity_id", step.opportunity_id)
    .order("step_number", { ascending: true });

  if (remainingSteps) {
    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].step_number !== i + 1) {
        await supabase
          .from("email_sequence_steps")
          .update({ step_number: i + 1 })
          .eq("id", remainingSteps[i].id);
      }
    }
  }

  return NextResponse.json({ success: true });
}
