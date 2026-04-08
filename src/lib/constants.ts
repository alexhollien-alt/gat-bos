import {
  RelationshipStrength,
  InteractionType,
  TaskPriority,
  ContactSource,
  ContactTier,
  OpportunityStage,
  MaterialRequestType,
  MaterialRequestStatus,
  MaterialRequestPriority,
  ProductType,
  DesignAssetType,
} from "./types";

export const RELATIONSHIP_CONFIG: Record<
  RelationshipStrength,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  new: {
    label: "New",
    color: "#6b7280",
    bgColor: "bg-zinc-500/10",
    textColor: "text-zinc-400",
  },
  warm: {
    label: "Warm",
    color: "#eab308",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-400",
  },
  active_partner: {
    label: "Active Partner",
    color: "#22c55e",
    bgColor: "bg-green-500/10",
    textColor: "text-green-400",
  },
  advocate: {
    label: "Advocate",
    color: "#3b82f6",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
  },
  dormant: {
    label: "Dormant",
    color: "#ef4444",
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
  },
};

export const INTERACTION_CONFIG: Record<
  InteractionType,
  { label: string; icon: string }
> = {
  call: { label: "Call", icon: "Phone" },
  text: { label: "Text", icon: "MessageSquare" },
  email: { label: "Email", icon: "Mail" },
  meeting: { label: "Meeting", icon: "Users" },
  broker_open: { label: "Broker Open", icon: "Building" },
  lunch: { label: "Lunch", icon: "UtensilsCrossed" },
  note: { label: "Note", icon: "FileText" },
};

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  low: { label: "Low", color: "text-zinc-500" },
  medium: { label: "Medium", color: "text-yellow-400" },
  high: { label: "High", color: "text-red-400" },
};

export const SOURCE_LABELS: Record<ContactSource, string> = {
  manual: "Manual Entry",
  referral: "Referral",
  broker_open: "Broker Open",
  website: "Website",
  zillow: "Zillow",
  realtor_com: "Realtor.com",
  social_media: "Social Media",
  cold_call: "Cold Call",
  sign_call: "Sign Call",
  open_house: "Open House",
  import: "Import",
  other: "Other",
};

// ---------------------
// Contact Type
// ---------------------

export const CONTACT_TYPE_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  realtor: { label: "Realtor", bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  lender: { label: "Lender", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  builder: { label: "Builder", bgColor: "bg-orange-500/10", textColor: "text-orange-400" },
  vendor: { label: "Vendor", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
  buyer: { label: "Buyer", bgColor: "bg-cyan-500/10", textColor: "text-cyan-400" },
  seller: { label: "Seller", bgColor: "bg-amber-500/10", textColor: "text-amber-400" },
  past_client: { label: "Past Client", bgColor: "bg-zinc-500/10", textColor: "text-zinc-400" },
  warm_lead: { label: "Warm Lead", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  referral_partner: { label: "Referral Partner", bgColor: "bg-indigo-500/10", textColor: "text-indigo-400" },
  sphere: { label: "Sphere", bgColor: "bg-pink-500/10", textColor: "text-pink-400" },
  other: { label: "Other", bgColor: "bg-zinc-500/10", textColor: "text-zinc-400" },
};

// ---------------------
// Materials & Print Requests
// ---------------------

export const REQUEST_TYPE_CONFIG: Record<
  MaterialRequestType,
  { label: string; icon: string }
> = {
  print_ready: { label: "Print Ready", icon: "Printer" },
  design_help: { label: "Design Help", icon: "Palette" },
  template_request: { label: "Template Request", icon: "FileText" },
};

export const REQUEST_STATUS_CONFIG: Record<
  MaterialRequestStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  draft: { label: "Draft", bgColor: "bg-zinc-500/10", textColor: "text-zinc-400" },
  submitted: { label: "Submitted", bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  in_production: { label: "In Production", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  complete: { label: "Complete", bgColor: "bg-green-500/10", textColor: "text-green-400" },
};

export const REQUEST_PRIORITY_CONFIG: Record<
  MaterialRequestPriority,
  { label: string; color: string }
> = {
  standard: { label: "Standard", color: "text-zinc-500" },
  rush: { label: "Rush", color: "text-red-400" },
};

export const PRODUCT_TYPE_CONFIG: Record<
  ProductType,
  { label: string; icon: string }
> = {
  flyer: { label: "Flyer", icon: "FileImage" },
  brochure: { label: "Brochure", icon: "BookOpen" },
  door_hanger: { label: "Door Hanger", icon: "DoorOpen" },
  eddm: { label: "EDDM", icon: "Mailbox" },
  postcard: { label: "Postcard", icon: "Mail" },
  other: { label: "Other", icon: "Package" },
};

export const DESIGN_ASSET_TYPE_LABELS: Record<DesignAssetType, string> = {
  flyer: "Flyer",
  brochure: "Brochure",
  door_hanger: "Door Hanger",
  eddm: "EDDM",
  postcard: "Postcard",
  social: "Social Media",
  presentation: "Presentation",
  other: "Other",
};

// ---------------------
// Tier & Pipeline
// ---------------------

export const TIER_CONFIG: Record<
  ContactTier,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  A: { label: "A", color: "#22c55e", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  B: { label: "B", color: "#3b82f6", bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  C: { label: "C", color: "#eab308", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  P: { label: "P", color: "#a855f7", bgColor: "bg-purple-500/10", textColor: "text-purple-400" },
};

export const OPPORTUNITY_STAGE_CONFIG: Record<
  OpportunityStage,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  prospect: { label: "Prospect", color: "#6b7280", bgColor: "bg-zinc-500/10", textColor: "text-zinc-400" },
  under_contract: { label: "Under Contract", color: "#eab308", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" },
  in_escrow: { label: "In Escrow", color: "#3b82f6", bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  closed: { label: "Closed", color: "#22c55e", bgColor: "bg-green-500/10", textColor: "text-green-400" },
  fell_through: { label: "Fell Through", color: "#ef4444", bgColor: "bg-red-500/10", textColor: "text-red-400" },
};
