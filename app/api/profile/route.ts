import { NextResponse } from "next/server";
import { getProfile, updateProfile } from "@/lib/actions";
import type { Tone } from "@/lib/types";

export async function GET() {
  try {
    const profile = await getProfile();
    return NextResponse.json({ data: profile, success: true });
  } catch {
    return NextResponse.json({ data: null, success: false, error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const result = await updateProfile({
      // Free-text fields (legacy + still used by copy engine)
      businessName:        body.businessName,
      businessType:        body.businessType,
      location:            body.location,
      opportunityTypes:    body.opportunityTypes,
      pitch:               body.pitch,
      website:             body.website,
      instagram:           body.instagram,
      linkedin:            body.linkedin,
      phone:               body.phone,
      tone:                body.tone        as Tone | undefined,
      opportunitiesPerWeek: body.opportunitiesPerWeek != null ? Number(body.opportunitiesPerWeek) : undefined,
      onboardingCompleted: body.onboardingCompleted,
      specialityTags:      body.specialityTags,
      workRadius:          body.workRadius,
      voiceSample:         body.voiceSample,
      // Structured role fields
      roleId:              body.roleId,
      roleCategory:        body.roleCategory,
      targetMarkets:       body.targetMarkets,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Return the updated profile so callers can refresh state in one round-trip
    const updated = await getProfile();
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update profile" }, { status: 500 });
  }
}
