import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateText } from "ai";

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

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Fetch opportunity
    const { data: opportunity } = await supabase
      .from("opportunities")
      .select("*")
      .eq("id", opportunityId)
      .eq("user_id", user.id)
      .single();

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Return cached message if available and not forcing regenerate
    if (opportunity.cached_message && !forceRegenerate) {
      return NextResponse.json(opportunity.cached_message);
    }

    // Determine message format based on contact method
    const isEmail = contactMethod === 'email' || !contactMethod;
    const isInstagram = contactMethod === 'instagram';

    const toneDescriptions: Record<string, string> = {
      friendly: "warm, approachable, and conversational",
      professional: "polished, business-appropriate, and respectful",
      premium: "sophisticated, elegant, and high-end",
      casual: "relaxed, personable, and down-to-earth",
    };

    const toneDescription = toneDescriptions[profile.tone || 'professional'] || toneDescriptions.professional;

    // Build social links section
    const socialLinks: string[] = [];
    if (profile.website) socialLinks.push(`Website: ${profile.website}`);
    if (profile.instagram) socialLinks.push(`Instagram: ${profile.instagram.startsWith('http') ? profile.instagram : `https://instagram.com/${profile.instagram.replace('@', '')}`}`);
    if (profile.linkedin) socialLinks.push(`LinkedIn: ${profile.linkedin}`);
    
    const socialLinksSection = socialLinks.length > 0 
      ? `\n\nYou can check out my work here:\n${socialLinks.join('\n')}`
      : '';

    // Get sender's first name
    const firstName = profile.full_name?.split(' ')[0] || 'there';

    let formatInstructions = "";
    if (isInstagram) {
      formatInstructions = `
Format: Instagram DM (keep it SHORT - max 3-4 sentences)
- Start with a friendly hook referencing their business
- Be conversational and casual
- Mention your website or portfolio link naturally
- Include a soft call-to-action
- No formal greetings or sign-offs`;
    } else {
      formatInstructions = `
Format: Email
- Include a compelling subject line (prefix with "Subject: ")
- Address them by their business name or a friendly greeting
- 2-3 short paragraphs max
- Reference specific details about THEIR business and why you want to work with them
- Include your pitch naturally
- ALWAYS include your website/portfolio and social links at the end before the sign-off
- Clear call-to-action (suggest a quick call, meeting, or ask them to check your work)
- Sign off with your first name: ${firstName}`;
    }

    const prompt = `You are ${profile.full_name || 'a creative professional'}, writing outreach for your ${profile.business_type} business.

YOUR PROFILE:
- Name: ${profile.full_name || 'Not set'}
- Business Name: ${profile.business_name || profile.business_type}
- What you do: ${profile.pitch || `Professional ${profile.business_type} services`}
- Location: ${profile.location || 'Not specified'}
- Website: ${profile.website || 'Not provided'}
- Instagram: ${profile.instagram || 'Not provided'}
- LinkedIn: ${profile.linkedin || 'Not provided'}
- Phone: ${profile.phone || 'Not provided'}
- Tone: ${toneDescription}

REACHING OUT TO:
- Business Name: ${opportunity.name}
- Type: ${opportunity.type} (e.g. ${opportunity.type === 'restaurant' ? 'restaurant, cafe, bar' : opportunity.type === 'hotel' ? 'hotel, resort, boutique accommodation' : opportunity.type})
- Location: ${opportunity.location || 'Not specified'}
- Why they're a good fit: ${opportunity.why_good_fit || 'Discovered as a potential collaboration opportunity'}
${opportunity.website ? `- Their website: ${opportunity.website}` : ''}
${opportunity.rating ? `- Rating: ${opportunity.rating}/5 stars` : ''}

${formatInstructions}

IMPORTANT RULES:
1. Personalize the message - mention THEIR business name and specific details about what they do
2. Explain why YOU specifically would be great for THEM
3. Reference your pitch/services naturally
4. ${profile.website || profile.instagram ? `ALWAYS include your links: ${socialLinks.join(', ')}` : 'Include a way for them to see your work if available'}
5. Keep it concise but personal - no generic templates
6. End with a specific call-to-action

Write the outreach message now:`;

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    });

    // Parse subject line if email format
    let subject = "";
    let body = result.text;

    if (isEmail && result.text.toLowerCase().startsWith("subject:")) {
      const lines = result.text.split("\n");
      subject = lines[0].replace(/^subject:\s*/i, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    const generatedMessage = {
      subject,
      body,
      contactMethod: contactMethod || 'email',
      generatedAt: new Date().toISOString(),
    };

    // Cache the message in the opportunity record
    await supabase
      .from("opportunities")
      .update({ cached_message: generatedMessage })
      .eq("id", opportunityId);

    return NextResponse.json(generatedMessage);

  } catch (error) {
    console.error("Error generating message:", error);
    return NextResponse.json(
      { error: "Failed to generate message" },
      { status: 500 }
    );
  }
}
