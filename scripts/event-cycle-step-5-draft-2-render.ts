// Step 5 Draft 2 render -- write 5 invite previews to ~/Desktop.
// Fixtures mirror the plan's Draft 2 ask + Alex-solo 85254 Home Tour variant.

import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import {
  renderClassDay,
  renderContentDay,
  renderHappyHour,
  renderHomeTour,
} from "../src/lib/events/invite-templates/index";

const desktop = resolve(homedir(), "Desktop");

type Fixture = {
  slug: string;
  label: string;
  html: string;
};

const fixtures: Fixture[] = [];

// 1. Home Tour -- Desert Ridge W1 (Stephanie + lender co-sign).
{
  const r = renderHomeTour({
    event_name: "Desert Ridge Home Tour",
    date: "Wednesday, May 6",
    time: "9:00am - 11:30am",
    location: "Desert Ridge GAT Office -- 20950 N Tatum Blvd, Phoenix",
    host_name: "Stephanie Reid",
    lender_flag: "stephanie",
    rsvp_link: null,
  });
  fixtures.push({
    slug: "home-tour-desert-ridge",
    label: "Home Tour -- Desert Ridge W1 (Stephanie)",
    html: r.html,
  });
}

// 2. Home Tour -- 85254 W2 (Alex solo, lender-free signature).
{
  const r = renderHomeTour({
    event_name: "85254 Home Tour",
    date: "Wednesday, May 13",
    time: "9:00am - 12:00pm",
    location: "Paradise Valley Office Park -- meet at the east entrance",
    host_name: "Alex Hollien",
    lender_flag: "none",
    rsvp_link: null,
    notes:
      "SAAR partnership route. Contact reference only, no formal org co-brand on this tour.",
  });
  fixtures.push({
    slug: "home-tour-85254-alex-solo",
    label: "Home Tour -- 85254 W2 (Alex solo, lender-free)",
    html: r.html,
  });
}

// 3. Class Day -- Stephanie W2 Pipeline Track #1 (Farming Strategy).
{
  const r = renderClassDay({
    event_name: "Class Day -- Farming Strategy",
    date: "Thursday, May 14",
    time: "10:00am - 1:00pm",
    location: "Desert Ridge GAT Office -- 20950 N Tatum Blvd, Phoenix",
    host_name: "Stephanie Reid",
    lender_flag: "stephanie",
    track_focus: "Pipeline Track #1 -- Farming Strategy",
    rsvp_link: null,
  });
  fixtures.push({
    slug: "class-day",
    label: "Class Day -- Stephanie W2 Pipeline #1",
    html: r.html,
  });
}

// 4. Content Day -- Christine W1 (rsvp_link required, slot-reservation page).
{
  const r = renderContentDay({
    event_name: "Content Day -- Christine W1",
    date: "Thursday, May 7",
    time: "10:00am - 1:00pm",
    location: "Active listing -- address confirmed 10 days out",
    host_name: "Christine McConnell",
    lender_flag: "christine",
    rsvp_link:
      "https://gat-bos.vercel.app/events/rsvp/[PLACEHOLDER: occurrence_id]",
  });
  fixtures.push({
    slug: "content-day",
    label: "Content Day -- Christine W1",
    html: r.html,
  });
}

// 5. Happy Hour -- Stephanie W4.
{
  const r = renderHappyHour({
    event_name: "Happy Hour -- May",
    date: "Tuesday, May 26",
    time: "4:30pm - 6:00pm",
    location: "Venue TBD -- confirmed 10 days out",
    host_name: "Stephanie Reid",
    lender_flag: "stephanie",
    rsvp_link: null,
  });
  fixtures.push({
    slug: "happy-hour",
    label: "Happy Hour -- Stephanie W4",
    html: r.html,
  });
}

for (const f of fixtures) {
  const path = resolve(desktop, `event-cycle-step-5-draft-2-${f.slug}.html`);
  writeFileSync(path, f.html, "utf8");
  console.log(`WROTE ${path}  (${f.label})`);
}

console.log(`\nTotal: ${fixtures.length} files.`);

// Remaining placeholders in this preview script:
//   - Content Day fixture rsvp_link still contains "[PLACEHOLDER: occurrence_id]"
//     because Step 6 slot-reservation page is not yet live. Real occurrence_id
//     lands when Step 6 ships.
// All other fixtures are fully resolved (no placeholders in output HTML).
