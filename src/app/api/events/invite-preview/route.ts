// Step 5 invite preview route. Dev-mode only (dynamic fixtures keyed by ?type=).
// Gated behind NEXT_PUBLIC_VERCEL_ENV !== 'production' so the route cannot be
// hit in prod even if deployed. Returns text/html so you can open the URL
// directly in a browser.
//
// Usage (dev server running on http://localhost:3000):
//   /api/events/invite-preview?type=home-tour
//   /api/events/invite-preview?type=class-day
//   /api/events/invite-preview?type=content-day
//   /api/events/invite-preview?type=happy-hour
//
// Fixture data pulled from Step 5 plan block in ~/.claude/plans/event-cycle-build.md.

import { NextRequest, NextResponse } from "next/server";
import {
  renderClassDay,
  renderContentDay,
  renderHappyHour,
  renderHomeTour,
  type ClassDayInviteInput,
  type ContentDayInviteInput,
  type HappyHourInviteInput,
  type HomeTourInviteInput,
  type InviteRenderResult,
} from "@/lib/events/invite-templates";

export const dynamic = "force-dynamic";

type PreviewType = "home-tour" | "class-day" | "content-day" | "happy-hour";

const IS_PROD =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

export async function GET(req: NextRequest) {
  if (IS_PROD) {
    return NextResponse.json(
      { error: "Preview route disabled in production" },
      { status: 404 },
    );
  }

  const type = (req.nextUrl.searchParams.get("type") || "home-tour") as PreviewType;
  const format = req.nextUrl.searchParams.get("format") || "html"; // html | text | json

  let out: InviteRenderResult;
  try {
    out = renderByType(type);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (format === "text") {
    return new NextResponse(out.text, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "json") {
    return NextResponse.json(out);
  }
  return new NextResponse(out.html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function renderByType(type: PreviewType): InviteRenderResult {
  switch (type) {
    case "home-tour": {
      const input: HomeTourInviteInput = {
        event_name: "Desert Ridge Home Tour",
        date: "Wednesday, May 6",
        time: "9:00am - 11:30am",
        location: "Desert Ridge GAT Office",
        host_name: "Stephanie Reid",
        lender_flag: "stephanie",
        rsvp_link: null,
        notes: null,
      };
      return renderHomeTour(input);
    }
    case "class-day": {
      const input: ClassDayInviteInput = {
        event_name: "Class Day with Stephanie",
        date: "Thursday, May 15",
        time: "10:00am - 1:00pm",
        location: "Desert Ridge GAT Office",
        host_name: "Stephanie Reid",
        lender_flag: "stephanie",
        rsvp_link: null,
        track_focus: "Pipeline track #1 -- Farming Strategy",
        notes: null,
      };
      return renderClassDay(input);
    }
    case "content-day": {
      const input: ContentDayInviteInput = {
        event_name: "Content Day with Christine",
        date: "Thursday, May 7",
        time: "10:00am - 1:00pm",
        location: "Active listing (address TBD)",
        host_name: "Christine McConnell",
        lender_flag: "christine",
        rsvp_link: "https://gat-bos.vercel.app/events/rsvp/OCCURRENCE_ID_PLACEHOLDER",
        notes: null,
      };
      return renderContentDay(input);
    }
    case "happy-hour": {
      const input: HappyHourInviteInput = {
        event_name: "Happy Hour with Stephanie",
        date: "Tuesday, May 26",
        time: "4:30pm - 6:00pm",
        location: "Venue TBD",
        host_name: "Stephanie Reid",
        lender_flag: "stephanie",
        rsvp_link: null,
        notes: null,
      };
      return renderHappyHour(input);
    }
    default:
      throw new Error(`Unknown preview type: ${type}`);
  }
}
