export type RelationshipStrength =
  | "new"
  | "warm"
  | "active_partner"
  | "advocate"
  | "dormant";

export type InteractionType =
  | "call"
  | "text"
  | "email"
  | "meeting"
  | "broker_open"
  | "lunch"
  | "note";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "pending" | "in_progress" | "completed";
export type FollowUpStatus = "pending" | "completed" | "skipped";

export type LeadStatus =
  | "none"
  | "prospect"
  | "contacted"
  | "qualified"
  | "nurturing"
  | "converted"
  | "lost";

export type ContactSource =
  | "manual"
  | "referral"
  | "broker_open"
  | "website"
  | "zillow"
  | "realtor_com"
  | "social_media"
  | "cold_call"
  | "sign_call"
  | "open_house"
  | "import"
  | "other";

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export type ContactTier = "A" | "B" | "C" | "P";

export type OpportunityStage =
  | "prospect"
  | "under_contract"
  | "in_escrow"
  | "closed"
  | "fell_through";

export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  relationship: RelationshipStrength;
  source: ContactSource;
  lead_status: LeadStatus;
  source_detail: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];

  // Live DB native fields (not in schema.sql)
  brokerage: string | null;
  website_url: string | null;
  stage: string | null;
  last_touch_date: string | null;
  next_action: string | null;
  deleted_at: string | null;

  // Marketing fields (phase 4)
  headshot_url: string | null;
  brokerage_logo_url: string | null;
  agent_logo_url: string | null;
  brand_colors: Record<string, string> | null;
  palette: string | null;
  font_kit: string | null;

  // Geography
  farm_area: string | null;
  farm_zips: string[] | null;

  // Relationship scoring
  temperature: number;
  rep_pulse: number | null;
  tier: ContactTier | null;

  // Context
  preferred_channel: string | null;
  referred_by: string | null;
  escrow_officer: string | null;
  contact_md_path: string | null;
}

export interface Opportunity {
  id: string;
  contact_id: string;
  property_address: string;
  property_city: string | null;
  property_state: string | null;
  property_zip: string | null;
  sale_price: number | null;
  stage: OpportunityStage;
  escrow_number: string | null;
  opened_at: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name">;
}

export interface ContactWithTags extends Contact {
  contact_tags: { tags: Tag }[];
}

export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: InteractionType;
  summary: string;
  occurred_at: string;
  created_at: string;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name">;
}

export interface Note {
  id: string;
  user_id: string;
  contact_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name"> | null;
}

export interface FollowUp {
  id: string;
  user_id: string;
  contact_id: string;
  reason: string;
  due_date: string;
  status: FollowUpStatus;
  completed_at: string | null;
  created_at: string;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name">;
}

// ---------------------
// Campaign Engine
// ---------------------

export type CampaignType = "drip" | "marketing";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type StepType = "email" | "call" | "text" | "mail" | "social" | "task";
export type EnrollmentStatus = "active" | "completed" | "paused" | "removed";

export type AwarenessLevel =
  | "unaware"
  | "problem_aware"
  | "solution_aware"
  | "product_aware"
  | "most_aware";

export type StepGoal =
  | "hook"
  | "problem"
  | "agitate"
  | "credibility"
  | "solution"
  | "proof"
  | "objections"
  | "offer"
  | "urgency"
  | "cta";

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: CampaignType;
  status: CampaignStatus;
  step_count: number;
  enrolled_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  step_number: number;
  step_type: StepType;
  title: string;
  content: string | null;
  delay_days: number;
  email_subject: string | null;
  email_body_html: string | null;
  awareness_level: AwarenessLevel | null;
  step_goal: StepGoal | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CampaignEnrollment {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: EnrollmentStatus;
  current_step: number;
  enrolled_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name">;
}

export interface CampaignStepCompletion {
  id: string;
  enrollment_id: string;
  step_id: string;
  completed_at: string;
  completed_by: string | null;
  email_sent_at: string | null;
  email_delivered: boolean;
  email_opened: boolean;
  resend_message_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---------------------
// Materials & Print Requests
// ---------------------

export type MaterialRequestType = "print_ready" | "design_help" | "template_request";
export type MaterialRequestStatus = "draft" | "submitted" | "in_production" | "complete";
export type MaterialRequestPriority = "standard" | "rush";
export type ProductType = "flyer" | "brochure" | "door_hanger" | "eddm" | "postcard" | "other";
export type DesignAssetType = "flyer" | "brochure" | "door_hanger" | "eddm" | "postcard" | "social" | "presentation" | "other";

export interface MaterialRequest {
  id: string;
  user_id: string;
  contact_id: string;
  title: string;
  request_type: MaterialRequestType;
  status: MaterialRequestStatus;
  priority: MaterialRequestPriority;
  notes: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name" | "company">;
  items?: MaterialRequestItem[];
}

export interface MaterialRequestItem {
  id: string;
  request_id: string;
  product_type: ProductType;
  quantity: number;
  design_url: string | null;
  description: string | null;
  created_at: string;
}

export interface DesignAsset {
  id: string;
  user_id: string;
  contact_id: string;
  name: string;
  url: string;
  asset_type: DesignAssetType;
  listing_address: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  contacts?: Pick<Contact, "id" | "first_name" | "last_name">;
}
