import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
// Using Anthropic directly

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { opportunityId, contactMethod, forceRegenerate } = await request.json();

    if (!opportunityId) {
      return NextResponse.json({ error: "opportunityId required" }, { status: 400 });
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const { data: opportunity } = await supabase.from("opportunities").select("*").eq("id", opportunityId).eq("user_id", user.id).single();
    if (!opportunity) return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });

    if (!forceRegenerate && opportunity.cached_message) {
      return NextResponse.json(opportunity.cached_message);
    }

    const isEmail = !contactMethod || contactMethod === 'email';
    const isInstagram = contactMethod === 'instagram';
    const firstName = profile.full_name?.split(' ')[0] || profile.business_name || 'us';
    const toneMap: Record<string, string> = { professional: "professional and polished", friendly: "warm and friendly", premium: "premium and exclusive", casual: "casual and relaxed" };
    const toneDescription = toneMap[profile.tone] || "professional";
    const socialLinks = [profile.website, profile.instagram ? `@${profile.instagram}` : null, profile.linkedin].filter(Boolean);

    let formatInstructions = "";
    if (isInstagram) {
      formatInstructions = `Format: Instagram DM (max 3-4 sentences, friendly, conversational)`;
    } else {
      formatInstructions = `Format: Professional email
Subject: Write a compelling subject line starting with "Subject: "
Body: 3-4 short paragraphs`;
    }

    const prompt = `You are ${profile.full_name || 'a creative professional'}, writing outreach for your ${profile.business_type} business.

YOUR PROFILE:
- Name: ${profile.full_name || 'Not set'}
- Business Name: ${profile.business_name || profile.business_type}
- What you do: ${profile.pitch || `Professional ${profile.business_type} services`}
- Location: ${profile.location || 'Not specified'}
- Website: ${profile.website || 'Not provided'}
- Instagram: ${profile.instagram || 'Not provided'}
- Tone: ${toneDescription}

REACHING OUT TO:
- Business Name: ${opportunity.name}
- Type: ${opportunity.type}
- Location: ${opportunity.location || 'Not specified'}
- Why they're a good fit: ${opportunity.why_good_fit || 'Discovered as a potential collaboration opportunity'}
${opportunity.website ? `- Their website: ${opportunity.website}` : ''}

${formatInstructions}

IMPORTANT RULES:
1. Personalize - mention THEIR business name
2. Explain why YOU would be great for THEM
3. ${socialLinks.length > 0 ? `Include your links: ${socialLinks.join(', ')}` : 'Be clear about your services'}
4. Keep it concise and personal
5. End with a specific call-to-action
6. ALWAYS sign off with "Best,\n${profile.full_name || profile.business_name || 'The Team'}"

Write the outreach message now:`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) throw new Error("AI generation failed");
    const anthropicData = await anthropicRes.json();
    const generatedText = anthropicData.content?.[0]?.text || "";

    let subject = "";
    let body = generatedText;
    if (isEmail && generatedText.toLowerCase().startsWith("subject:")) {
      const lines = generatedText.split("\n");
      subject = lines[0].replace(/^subject:\s*/i, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    const generatedMessage = { subject, body, contactMethod: contactMethod || 'email', generatedAt: new Date().toISOString() };
    await supabase.from("opportunities").update({ cached_message: generatedMessage }).eq("id", opportunityId);
    return NextResponse.json(generatedMessage);

  } catch (error) {
    console.error("Generate message error:", error);
    return NextResponse.json({ error: "Failed to generate message" }, { status: 500 });
  }
}