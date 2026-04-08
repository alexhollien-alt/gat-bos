import { z } from "zod";

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  title: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  // stage values mirror contacts.stage CHECK constraint in the live DB.
  // See src/lib/types.ts RelationshipStrength.
  stage: z.enum([
    "new",
    "warm",
    "active_partner",
    "advocate",
    "dormant",
  ]),
  source: z.enum([
    "manual",
    "referral",
    "broker_open",
    "website",
    "zillow",
    "realtor_com",
    "social_media",
    "cold_call",
    "sign_call",
    "open_house",
    "import",
    "other",
  ]),
  notes: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;

export const interactionSchema = z.object({
  contact_id: z.string().uuid("Select a contact"),
  type: z.enum([
    "call",
    "text",
    "email",
    "meeting",
    "broker_open",
    "lunch",
    "note",
  ]),
  summary: z.string().min(1, "Summary is required"),
  occurred_at: z.string(),
});

export type InteractionFormData = z.infer<typeof interactionSchema>;

export const noteSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

export type NoteFormData = z.infer<typeof noteSchema>;

export const taskSchema = z.object({
  contact_id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
});

export type TaskFormData = z.infer<typeof taskSchema>;

export const followUpSchema = z.object({
  contact_id: z.string().uuid("Select a contact"),
  reason: z.string().min(1, "Reason is required"),
  due_date: z.string().min(1, "Due date is required"),
});

export type FollowUpFormData = z.infer<typeof followUpSchema>;

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type SignupFormData = z.infer<typeof signupSchema>;

// ---------------------
// Campaigns
// ---------------------

export const campaignTypeValues = ["drip", "marketing"] as const;
export const campaignStatusValues = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;
export const stepTypeValues = [
  "email",
  "call",
  "text",
  "mail",
  "social",
  "task",
] as const;

export const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(300),
  description: z.string().optional(),
  type: z.enum(campaignTypeValues),
  status: z.enum(campaignStatusValues),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;

// ---------------------
// Materials & Print Requests
// ---------------------

export const materialRequestTypeValues = ["print_ready", "design_help", "template_request"] as const;
export const materialRequestStatusValues = ["draft", "submitted", "in_production", "complete"] as const;
export const materialRequestPriorityValues = ["standard", "rush"] as const;
export const productTypeValues = ["flyer", "brochure", "door_hanger", "eddm", "postcard", "other"] as const;
export const designAssetTypeValues = ["flyer", "brochure", "door_hanger", "eddm", "postcard", "social", "presentation", "other"] as const;

export const materialRequestItemSchema = z.object({
  product_type: z.enum(productTypeValues),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  design_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
});

export type MaterialRequestItemFormData = z.infer<typeof materialRequestItemSchema>;

export const materialRequestSchema = z.object({
  contact_id: z.string().uuid("Select a contact"),
  title: z.string().min(1, "Title is required"),
  request_type: z.enum(materialRequestTypeValues),
  priority: z.enum(materialRequestPriorityValues),
  notes: z.string().optional(),
  items: z.array(materialRequestItemSchema).min(1, "Add at least one item"),
});

export type MaterialRequestFormData = z.infer<typeof materialRequestSchema>;

export const designAssetSchema = z.object({
  contact_id: z.string().uuid("Select a contact"),
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Must be a valid URL"),
  asset_type: z.enum(designAssetTypeValues),
  listing_address: z.string().optional(),
});

export type DesignAssetFormData = z.infer<typeof designAssetSchema>;

// ---------------------
// Intake Wizard
// ---------------------

export const listingStatusValues = [
  "Just Listed",
  "Open House",
  "For Sale",
  "Just Sold",
  "Coming Soon",
  "Price Reduced",
] as const;

export const intakeProductsSchema = z.object({
  products: z
    .array(z.enum(productTypeValues))
    .min(1, "Select at least one product"),
});

export type IntakeProductsFormData = z.infer<typeof intakeProductsSchema>;

export const intakeListingSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  price: z.string().optional(),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  sqft: z.string().optional(),
  year_built: z.string().optional(),
  lot_size: z.string().optional(),
  garage: z.string().optional(),
  description: z.string().optional(),
  key_features: z.string().optional(),
  status: z.string().optional(),
  hero_image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  gallery_images: z.string().optional(),
  special_instructions: z.string().optional(),
});

export type IntakeListingFormData = z.infer<typeof intakeListingSchema>;

export const intakeAgentSchema = z.object({
  agent_name: z.string().min(1, "Name is required"),
  agent_email: z.string().email("Valid email required"),
  agent_phone: z.string().optional(),
  brokerage: z.string().optional(),
});

export type IntakeAgentFormData = z.infer<typeof intakeAgentSchema>;

// ---------------------
// Opportunities
// ---------------------

export const opportunityStageValues = [
  "prospect",
  "under_contract",
  "in_escrow",
  "closed",
  "fell_through",
] as const;

export const opportunitySchema = z.object({
  contact_id: z.string().uuid("Select a contact"),
  property_address: z.string().min(1, "Address is required"),
  property_city: z.string().optional(),
  property_state: z.string().optional(),
  property_zip: z.string().optional(),
  sale_price: z.string().optional(),
  stage: z.enum(opportunityStageValues),
  escrow_number: z.string().optional(),
  expected_close_date: z.string().optional(),
  notes: z.string().optional(),
});

export type OpportunityFormData = z.infer<typeof opportunitySchema>;
