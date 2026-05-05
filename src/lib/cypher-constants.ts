// src/lib/cypher-constants.ts
// Canonical enum universe for the Cypher CRM ticket system.
// Source: Cypher screenshots taken 2026-05-04.
// Used by: Zod schemas (ticket.ts), form dropdowns, and Slice C push worker.
// Branch/ship-to stored as text in DB (not Postgres enums) so adding entries
// here is the only change needed when Cypher adds locations.

export const TICKET_CATEGORIES = [
  'General Inquiry',
  'Product Request',
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = [
  'Low',
  'Normal',
  'High',
  'Urgent',
] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const CYPHER_BRANCHES = [
  'Arrowhead Branch',
  'Cooper Branch',
  'Corporate',
  'Desert Ridge Branch',
  'Gainey Branch',
  'Gilbert Branch',
  'Goodyear Branch',
  'Happy Valley Branch',
  'Las Vegas/PAT',
  'Mesa Branch (Stapley)',
  'Parkway Unit',
  'Payson Branch',
  'Peoria Branch (Happy Valley)',
  'Stapley Branch',
  'Surprise Branch',
  'Tradition/Kierland Branch',
] as const;

export type CypherBranch = (typeof CYPHER_BRANCHES)[number];

export const CYPHER_SHIP_TO_LOCATIONS = [
  'Arrowhead Branch',
  'Cooper Branch',
  'Desert Ridge Branch',
  'Email/Ticket System Only',
  'Gainey Branch',
  'Gilbert Branch',
  'Goodyear Branch',
  'Happy Valley Branch',
  'Leave at Corporate - Front Desk',
  'Other/Courier',
  'Parkway Unit',
  'Payson Branch',
  'Stapley Branch',
  'Surprise Branch',
  'Tradition/Kierland Branch',
] as const;

export type CypherShipToLocation = (typeof CYPHER_SHIP_TO_LOCATIONS)[number];

export const CYPHER_PRODUCTS = [
  'ALTOS Market Report',
  'Brochures (17x11)',
  'Business Cards',
  'Buyer Guide',
  'Card (Folded, finished size is 4.25 x 5.5)',
  'Courier Fee (for CS use)',
  'Door Hangers',
  'Door Jammers (4.25x11)',
  'Eblast (Digital Only)',
  'EDDM Every Door Direct Mailing (4.25x11)',
  'EDDM Every Door Direct Mailing (8.5x7)',
  'EDDM Every Door Direct Mailing (8.5x11)',
  'EDDM Every Door Direct Mailing (11x17)',
  'Email Signature',
  'Flipbook (Digital)',
  'Flyers (8.5x11)',
  'GAT Flip Book',
  'Golf Balls (12 count)',
  'Listing Kit Box',
  'Listing Sign Design',
  'Listing/Open House Sign Print (18x24)',
  'Mailing Labels',
  'Marketing Items',
  'Metal Perma Sign (8in x12in)',
  'MTA Report',
  'Open House Feedback Cards',
  'Other',
  'Postcards (8.5x5.5)',
  'Postcards for Wise Pelican (6x9 Digital Only)',
  'Pop By (4.25x3.66)',
  'Pop By (4.25x5.5)',
  'Property Profile/Listing Kit',
  'Seller Guide',
  'Sign Rider (24in x 6in)',
  'Social Media',
  'Stickers ($5 per sheet)',
  'Trifold (8.5x11)',
  'Trifold (11x17)',
] as const;

export type CypherProduct = (typeof CYPHER_PRODUCTS)[number];

export const TICKET_STATUSES = [
  'draft',
  'submitted',
  'awaiting_reply',
  'in_progress',
  'done',
  'blocked',
  'cancelled',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
