// Database types matching Supabase schema
export interface DbProfile {
  id: string;
  email: string;
  name: string | null;
  business_name: string | null;
  business_type: string | null;
  location: string | null;
  opportunity_types: string[] | null;
  pitch: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  phone: string | null;
  tone: string | null;
  opportunities_per_week: number | null;
  onboarding_completed: boolean;
  speciality_tags: string[] | null;
  work_radius: string | null;
  voice_sample: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbOpportunity {
  id: string;
  user_id: string;
  name: string;
  type: string;
  location: string | null;
  description: string | null;
  why_good_fit: string | null;
  status: string;
  priority: string;
  tags: string[] | null;
  source: string | null;
  website: string | null;
  notes: string | null;
  liked: boolean | null;
  // Google Places fields
  google_place_id: string | null;
  rating: number | null;
  rating_count: number | null;
  photo_reference: string | null;
  // Contact form fields
  contact_form_url: string | null;
  contact_form_label: string | null;
  contact_form_confidence: string | null;
  enrichment_status: string | null;
  // Tier 1 contact intelligence
  instagram_handle: string | null;
  instagram_url: string | null;
  contact_email: string | null;
  contact_email_type: string | null;
  has_contact_form: boolean | null;
  // Tier 2 personal analysis
  personal_analysis: Record<string, unknown> | null;
  personal_score: number | null;
  personal_analysis_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbContactMethod {
  id: string;
  opportunity_id: string;
  type: string;
  value: string;
  is_primary: boolean;
  label: string | null;
  created_at: string;
}

export interface DbOutreachMessage {
  id: string;
  user_id: string;
  opportunity_id: string;
  contact_method_id: string | null;
  contact_method: string | null;
  thread_id: string | null;
  type: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbFollowUpTask {
  id: string;
  user_id: string;
  outreach_message_id: string | null;
  opportunity_id: string | null;
  due_date: string;
  status: string;
  priority: string;
  suggested_action: string | null;
  notes: string | null;
  completed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReplyStatus {
  id: string;
  user_id: string;
  outreach_message_id: string;
  opportunity_id: string | null;
  type: string;
  received_at: string;
  summary: string | null;
  sentiment: string | null;
  next_steps: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DbGmailConnection {
  id: string;
  user_id: string;
  email: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper functions to convert DB types to app types
import type { 
  UserProfile, 
  Opportunity, 
  ContactMethod, 
  OutreachMessage, 
  FollowUpTask, 
  ReplyStatus,
  OpportunityStatus,
  OpportunityType,
  ContactMethodType,
  Tone,
  ReplyType,
  EnrichmentStatus,
} from './types';

export function dbProfileToProfile(db: DbProfile): UserProfile {
  return {
    id: db.id,
    email: db.email,
    businessName: db.business_name || '',
    businessType: db.business_type || '',
    location: db.location || '',
    opportunityTypes: db.opportunity_types || [],
    pitch: db.pitch || '',
    website: db.website || undefined,
    instagram: db.instagram || undefined,
    linkedin: db.linkedin || undefined,
    phone: db.phone || undefined,
    tone: (db.tone as Tone) || 'professional',
    opportunitiesPerWeek: db.opportunities_per_week || 5,
    specialityTags: db.speciality_tags || [],
    workRadius: db.work_radius || '',
    voiceSample: db.voice_sample || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbOpportunityToOpportunity(db: DbOpportunity, contactMethods: DbContactMethod[]): Opportunity {
  return {
    id: db.id,
    name: db.name,
    type: (db.type as OpportunityType) || 'other',
    location: db.location || '',
    description: db.description || undefined,
    whyGoodFit: db.why_good_fit || '',
    contactMethods: contactMethods.map(dbContactMethodToContactMethod),
    status: (db.status as OpportunityStatus) || 'new',
    priority: (db.priority as 'high' | 'medium' | 'low') || 'medium',
    tags: db.tags || [],
    source: db.source || undefined,
    website: db.website || undefined,
    notes: db.notes || undefined,
    liked: db.liked ?? false,
    googlePlaceId: db.google_place_id || undefined,
    rating: db.rating || undefined,
    ratingCount: db.rating_count || undefined,
    photoReference: db.photo_reference || undefined,
    enrichmentStatus: db.enrichment_status as any || undefined,
    contactForm: db.contact_form_url ? {
      url: db.contact_form_url,
      label: db.contact_form_label || 'Contact Form',
      confidence: (db.contact_form_confidence as 'high' | 'medium' | 'low') || 'low',
    } : undefined,
    // Tier 1 contact intelligence
    instagramHandle:   db.instagram_handle      || undefined,
    instagramUrl:      db.instagram_url         || undefined,
    contactEmail:      db.contact_email         || undefined,
    contactEmailType:  db.contact_email_type    || undefined,
    contactFormUrl:    db.contact_form_url       || undefined,
    hasContactForm:    db.has_contact_form       ?? false,
    // Tier 2 personal analysis
    personalAnalysis:        db.personal_analysis         || undefined,
    personalScore:           db.personal_score            ?? undefined,
    personalAnalysisStatus:  db.personal_analysis_status  || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbContactMethodToContactMethod(db: DbContactMethod): ContactMethod {
  return {
    id: db.id,
    type: (db.type as ContactMethodType) || 'email',
    value: db.value,
    isPrimary: db.is_primary,
    label: db.label || undefined,
  };
}

export function dbOutreachMessageToOutreachMessage(db: DbOutreachMessage): OutreachMessage {
  return {
    id: db.id,
    opportunityId: db.opportunity_id,
    contactMethodId: db.contact_method_id || '',
    type: (db.type as 'initial' | 'follow_up') || 'initial',
    subject: db.subject || undefined,
    body: db.body,
    status: (db.status as 'draft' | 'ready' | 'sent' | 'failed') || 'draft',
    sentAt: db.sent_at || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbFollowUpTaskToFollowUpTask(db: DbFollowUpTask): FollowUpTask {
  return {
    id: db.id,
    opportunityId: db.opportunity_id || '',
    outreachMessageId: db.outreach_message_id || undefined,
    dueDate: db.due_date,
    status: (db.status as 'pending' | 'completed' | 'skipped' | 'snoozed') || 'pending',
    priority: (db.priority as 'urgent' | 'normal' | 'low') || 'normal',
    suggestedAction: db.suggested_action || '',
    notes: db.notes || undefined,
    completedAt: db.completed_at || undefined,
    snoozedUntil: db.snoozed_until || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

export function dbReplyStatusToReplyStatus(db: DbReplyStatus): ReplyStatus {
  return {
    id: db.id,
    opportunityId: db.opportunity_id || '',
    outreachMessageId: db.outreach_message_id,
    type: (db.type as ReplyType) || 'neutral',
    receivedAt: db.received_at,
    summary: db.summary || undefined,
    sentiment: (db.sentiment as 'interested' | 'not_interested' | 'maybe' | 'unknown') || 'unknown',
    nextSteps: db.next_steps || undefined,
    isRead: db.is_read,
    createdAt: db.created_at,
  };
}
