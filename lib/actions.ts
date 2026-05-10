"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { 
  DbProfile, 
  DbOpportunity, 
  DbContactMethod,
  DbOutreachMessage,
  DbFollowUpTask,
  DbReplyStatus,
  dbProfileToProfile,
  dbOpportunityToOpportunity,
  dbContactMethodToContactMethod,
  dbOutreachMessageToOutreachMessage,
  dbFollowUpTaskToFollowUpTask,
  dbReplyStatusToReplyStatus,
} from "./database.types";
import * as converters from "./database.types";
import type { UserProfile, Opportunity, OutreachMessage, FollowUpTask, Tone } from "./types";

// ============================================
// AUTH HELPERS
// ============================================

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

// ============================================
// PROFILE ACTIONS
// ============================================

export async function getProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return converters.dbProfileToProfile(data as DbProfile);
}

export async function updateProfile(profileData: Partial<{
  businessName: string;
  businessType: string;
  location: string;
  opportunityTypes: string[];
  pitch: string;
  website: string;
  instagram: string;
  linkedin: string;
  phone: string;
  tone: Tone;
  opportunitiesPerWeek: number;
  onboardingCompleted: boolean;
  specialityTags: string[];
  workRadius: string;
  voiceSample: string;
  // Structured role fields
  roleId: string;
  roleCategory: string;
  targetMarkets: string[];
  // Positioning / clients
  positioning: string;
  pastClients: string[];
  // Notifications
  notificationReplyAlerts: boolean;
  notificationWeeklySummary: boolean;
  // B2B / Agency fields
  companyDomain: string;
  companyAnalysis: Record<string, unknown>;
  icp: Record<string, unknown>;
}>): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name:        profileData.businessName,
      business_type:        profileData.businessType,
      location:             profileData.location,
      opportunity_types:    profileData.opportunityTypes,
      pitch:                profileData.pitch,
      website:              profileData.website,
      instagram:            profileData.instagram,
      linkedin:             profileData.linkedin,
      phone:                profileData.phone,
      tone:                 profileData.tone,
      opportunities_per_week: profileData.opportunitiesPerWeek,
      onboarding_completed: profileData.onboardingCompleted,
      speciality_tags:      profileData.specialityTags,
      work_radius:          profileData.workRadius,
      voice_sample:         profileData.voiceSample,
      // Structured role fields
      role_id:              profileData.roleId,
      role_category:        profileData.roleCategory,
      target_markets:       profileData.targetMarkets,
      // Positioning / clients
      positioning:          profileData.positioning,
      past_clients:         profileData.pastClients,
      // Notifications
      notification_reply_alerts:   profileData.notificationReplyAlerts,
      notification_weekly_summary: profileData.notificationWeeklySummary,
      // B2B / Agency fields
      company_domain:       profileData.companyDomain,
      company_analysis:     profileData.companyAnalysis,
      icp:                  profileData.icp,
      updated_at:           new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function completeOnboarding(profileData: {
  businessName: string;
  businessType: string;
  location: string;
  opportunityTypes: string[];
  pitch: string;
  website?: string;
  instagram?: string;
  linkedin?: string;
  phone?: string;
  tone: Tone;
  opportunitiesPerWeek: number;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: profileData.businessName,
      business_type: profileData.businessType,
      location: profileData.location,
      opportunity_types: profileData.opportunityTypes,
      pitch: profileData.pitch,
      website: profileData.website || null,
      instagram: profileData.instagram || null,
      linkedin: profileData.linkedin || null,
      phone: profileData.phone || null,
      tone: profileData.tone,
      opportunities_per_week: profileData.opportunitiesPerWeek,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

// ============================================
// OPPORTUNITIES ACTIONS
// ============================================

export async function getOpportunities(): Promise<Opportunity[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data: opportunities, error } = await supabase
    .from("opportunities")
    .select("*, contact_methods(*)")
    .eq("user_id", user.id)
    .order("signal_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !opportunities) return [];

  return opportunities.map(opp => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { contact_methods, ...rest } = opp as typeof opp & { contact_methods: DbContactMethod[] };
    return converters.dbOpportunityToOpportunity(
      rest as unknown as DbOpportunity,
      (contact_methods || []) as DbContactMethod[]
    );
  });
}

export async function createOpportunity(data: {
  name: string;
  type: string;
  location?: string;
  description?: string;
  whyGoodFit?: string;
  status?: string;
  priority?: string;
  tags?: string[];
  source?: string;
  website?: string;
  notes?: string;
  contactMethods?: Array<{
    type: string;
    value: string;
    isPrimary?: boolean;
    label?: string;
  }>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: opportunity, error } = await supabase
    .from("opportunities")
    .insert({
      user_id: user.id,
      name: data.name,
      type: data.type,
      location: data.location || null,
      description: data.description || null,
      why_good_fit: data.whyGoodFit || null,
      status: data.status || "new",
      priority: data.priority || "medium",
      tags: data.tags || [],
      source: data.source || null,
      website: data.website || null,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Add contact methods if provided
  if (data.contactMethods && data.contactMethods.length > 0) {
    const contactMethodsToInsert = data.contactMethods.map((cm, index) => ({
      opportunity_id: opportunity.id,
      type: cm.type,
      value: cm.value,
      is_primary: cm.isPrimary ?? index === 0,
      label: cm.label || null,
    }));

    await supabase.from("contact_methods").insert(contactMethodsToInsert);
  }

  revalidatePath("/");
  return { success: true, id: opportunity.id };
}

export async function updateOpportunity(
  id: string, 
  data: Partial<{
    name: string;
    type: string;
    location: string;
    description: string;
    whyGoodFit: string;
    status: string;
    priority: string;
    tags: string[];
    website: string;
    notes: string;
    liked: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunities")
    .update({
      name: data.name,
      type: data.type,
      location: data.location,
      description: data.description,
      why_good_fit: data.whyGoodFit,
      status: data.status,
      priority: data.priority,
      tags: data.tags,
      website: data.website,
      notes: data.notes,
      liked: data.liked,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function deleteOpportunity(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

// ============================================
// OUTREACH MESSAGES ACTIONS
// ============================================

export async function getOutreachMessages(): Promise<OutreachMessage[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("outreach_messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(m => converters.dbOutreachMessageToOutreachMessage(m as DbOutreachMessage));
}

export async function createOutreachMessage(data: {
  opportunityId: string;
  contactMethodId?: string;
  contactMethod?: string;
  type?: string;
  subject?: string;
  body: string;
  status?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: message, error } = await supabase
    .from("outreach_messages")
    .insert({
      user_id: user.id,
      opportunity_id: data.opportunityId,
      contact_method_id: data.contactMethodId || null,
      contact_method: data.contactMethod || null,
      type: data.type || "initial",
      subject: data.subject || null,
      body: data.body,
      status: data.status || "draft",
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true, id: message.id };
}

export async function updateOutreachMessage(
  id: string, 
  data: Partial<{
    subject: string;
    body: string;
    status: string;
    sentAt: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("outreach_messages")
    .update({
      subject: data.subject,
      body: data.body,
      status: data.status,
      sent_at: data.sentAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function markMessageAsSent(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("outreach_messages")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  // Also update the opportunity status to "sent"
  const { data: message } = await supabase
    .from("outreach_messages")
    .select("opportunity_id")
    .eq("id", id)
    .single();

  if (message) {
    await supabase
      .from("opportunities")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("id", message.opportunity_id);

    // Create a follow-up task for 3 days later
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await supabase.from("follow_up_tasks").insert({
      user_id: user.id,
      outreach_message_id: id,
      opportunity_id: message.opportunity_id,
      due_date: dueDate.toISOString(),
      status: "pending",
      priority: "normal",
      suggested_action: "Follow up if no response received",
    });
  }

  revalidatePath("/");
  return { success: true };
}

// ============================================
// FOLLOW-UP TASKS ACTIONS
// ============================================

export async function getFollowUpTasks(): Promise<FollowUpTask[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("follow_up_tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (error || !data) return [];
  return data.map(t => converters.dbFollowUpTaskToFollowUpTask(t as DbFollowUpTask));
}

export async function createFollowUpTask(data: {
  opportunityId: string;
  outreachMessageId?: string;
  dueDate: string;
  priority?: string;
  suggestedAction: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: task, error } = await supabase
    .from("follow_up_tasks")
    .insert({
      user_id: user.id,
      opportunity_id: data.opportunityId,
      outreach_message_id: data.outreachMessageId || null,
      due_date: data.dueDate,
      status: "pending",
      priority: data.priority || "normal",
      suggested_action: data.suggestedAction,
      notes: data.notes || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true, id: task.id };
}

export async function updateFollowUpTask(
  id: string, 
  data: Partial<{
    dueDate: string;
    status: string;
    priority: string;
    suggestedAction: string;
    notes: string;
    completedAt: string;
    snoozedUntil: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("follow_up_tasks")
    .update({
      due_date: data.dueDate,
      status: data.status,
      priority: data.priority,
      suggested_action: data.suggestedAction,
      notes: data.notes,
      completed_at: data.completedAt,
      snoozed_until: data.snoozedUntil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true };
}

export async function completeFollowUpTask(id: string): Promise<{ success: boolean; error?: string }> {
  return updateFollowUpTask(id, {
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export async function snoozeFollowUpTask(id: string, until: string): Promise<{ success: boolean; error?: string }> {
  return updateFollowUpTask(id, {
    status: "snoozed",
    snoozedUntil: until,
    dueDate: until,
  });
}

// ============================================
// CONTACT METHODS ACTIONS
// ============================================

export async function addContactMethod(data: {
  opportunityId: string;
  type: string;
  value: string;
  isPrimary?: boolean;
  label?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Verify the opportunity belongs to the user
  const { data: opp } = await supabase
    .from("opportunities")
    .select("id")
    .eq("id", data.opportunityId)
    .eq("user_id", user.id)
    .single();

  if (!opp) return { success: false, error: "Opportunity not found" };

  const { data: contactMethod, error } = await supabase
    .from("contact_methods")
    .insert({
      opportunity_id: data.opportunityId,
      type: data.type,
      value: data.value,
      is_primary: data.isPrimary ?? false,
      label: data.label || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/");
  return { success: true, id: contactMethod.id };
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getDashboardStats() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("status")
    .eq("user_id", user.id);

  const { data: followUps } = await supabase
    .from("follow_up_tasks")
    .select("status, due_date")
    .eq("user_id", user.id)
    .eq("status", "pending");

  const { data: messages } = await supabase
    .from("outreach_messages")
    .select("status")
    .eq("user_id", user.id);

  const opps = opportunities || [];
  const today = new Date().toISOString().split("T")[0];

  return {
    newOpportunities: opps.filter(o => o.status === "new").length,
    outreachReady: opps.filter(o => o.status === "outreach_ready").length,
    sent: opps.filter(o => o.status === "sent").length,
    followUpsDue: (followUps || []).filter(f => f.due_date <= today).length,
    repliesReceived: opps.filter(o => o.status === "replied").length,
    totalOpportunities: opps.length,
    draftMessages: (messages || []).filter(m => m.status === "draft").length,
    sentMessages: (messages || []).filter(m => m.status === "sent").length,
  };
}
