// GAT Event Cycle -- Step 5 invite template types.
// Source-of-truth spec: ~/.claude/plans/event-cycle-build.md Step 5 plan.
//
// Four event types, three with optional rsvp_link (Home Tour, Class Day,
// Happy Hour) and one with required rsvp_link (Content Day). The optional
// fallback renders a "Reply to this email to RSVP" line in place of the
// CTA button.

export type EventOwnerName =
  | "Christine McConnell"
  | "Stephanie Reid"
  | "Alex Hollien";

export type LenderFlag = "alex" | "stephanie" | "christine" | "none";

export interface InviteRenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface InviteCommonInput {
  event_name: string;
  date: string; // human-readable, e.g. "Wednesday, May 6"
  time: string; // human-readable, e.g. "9:00am - 11:30am"
  location: string; // resolved address or "Venue TBD"
  host_name: EventOwnerName;
  lender_flag: LenderFlag;
}

export interface HomeTourInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  notes?: string | null;
}

export interface ClassDayInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  track_focus?: string | null; // e.g. "Pipeline track #1 -- Farming Strategy"
  notes?: string | null;
}

export interface ContentDayInviteInput extends InviteCommonInput {
  rsvp_link: string; // REQUIRED -- Step 6 slot-reservation page URL
  notes?: string | null;
}

export interface HappyHourInviteInput extends InviteCommonInput {
  rsvp_link?: string | null;
  notes?: string | null;
}

export class MissingRsvpLinkError extends Error {
  constructor(eventType: string) {
    super(
      `${eventType} invites require rsvp_link (Step 6 slot-reservation page). Pass a non-empty URL.`,
    );
    this.name = "MissingRsvpLinkError";
  }
}
