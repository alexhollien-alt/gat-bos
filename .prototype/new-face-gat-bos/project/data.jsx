// GAT-BOS sample data — title & escrow marketing / relationship OS
// All data is illustrative.

const PEOPLE = [
  {
    id: "p_julie", name: "Julie Tran", company: "Compass", role: "Listing Agent",
    stage: "VIP Advocate", warmth: "hot", value: "high",
    lastTouch: "2 days ago", nextTouch: "Today", touches: 31,
    opportunity: "Q3 farm campaign + 2 referrals in motion",
    project: "Q3 Farm Postcard Campaign",
    comms: "Texts back fast — keep it short", events: "Confirmed — Summer Mixer",
    escrowOfficer: "Renee Cole", partners: "Greg Patterson (lender)",
    nextBest: "Drop off the 250-piece postcard proof for approval",
    note: "Sends you 3–4 deals a year. Her assistant Maya handles scheduling.",
  },
  {
    id: "p_dana", name: "Dana Whitfield", company: "Coldwell Banker", role: "Team Lead",
    stage: "Deal Sent / Escrow Opportunity", warmth: "hot", value: "high",
    lastTouch: "Yesterday", nextTouch: "Today", touches: 18,
    opportunity: "Escrow opened — 88 Linden Ct ($1.2M)",
    project: "Just Listed Mailer — 88 Linden",
    comms: "Prefers a quick call over email", events: "Invited — not yet replied",
    escrowOfficer: "Renee Cole", partners: "—",
    nextBest: "Send welcome packet + confirm earnest money timeline",
    note: "First escrow from Dana. Nail this and her whole team follows.",
  },
  {
    id: "p_marcus", name: "Marcus Reyes", company: "Keller Williams", role: "Agent",
    stage: "Active Support", warmth: "warm", value: "medium",
    lastTouch: "5 days ago", nextTouch: "Thu", touches: 12,
    opportunity: "Listing brochure → likely 2 spring listings",
    project: "123 Maple Listing Brochure",
    comms: "Email, detail-oriented", events: "Confirmed — Summer Mixer",
    escrowOfficer: "Renee Cole", partners: "—",
    nextBest: "Send design proof v2 for the 123 Maple brochure",
    note: "Slow to reply but always closes. Loves polished print.",
  },
  {
    id: "p_sandra", name: "Sandra Lim", company: "Independent", role: "Solo Agent",
    stage: "Plan First Marketing Opportunity", warmth: "warm", value: "medium",
    lastTouch: "1 week ago", nextTouch: "Fri", touches: 6,
    opportunity: "Wants a farm strategy for Oak Hill",
    project: "—",
    comms: "Phone calls, warm and chatty", events: "Invited",
    escrowOfficer: "—", partners: "—",
    nextBest: "Book 20-min strategy call about Oak Hill farm",
    note: "Newer to the area — high upside if we earn trust early.",
  },
  {
    id: "p_tomas", name: "Tomás Okafor", company: "Compass", role: "Agent",
    stage: "First Interaction", warmth: "warm", value: "medium",
    lastTouch: "3 days ago", nextTouch: "Mon", touches: 2,
    opportunity: "Met at office mixer — open to working together",
    project: "—",
    comms: "Unknown — still learning", events: "Invited",
    escrowOfficer: "—", partners: "—",
    nextBest: "Send intro + sample marketing kit, then book coffee",
    note: "Julie introduced us. Treat as warm referral.",
  },
  {
    id: "p_priya", name: "Priya Nair", company: "eXp Realty", role: "Agent",
    stage: "Long-term Nurture", warmth: "needs", value: "medium",
    lastTouch: "5 weeks ago", nextTouch: "Overdue", touches: 9,
    opportunity: "Quiet, but referred a deal last year",
    project: "—",
    comms: "Light touch — quarterly market update", events: "Not invited yet",
    escrowOfficer: "—", partners: "—",
    nextBest: "Send the Q2 neighborhood market snapshot",
    note: "Don't oversell. Stay useful and top of mind.",
  },
  {
    id: "p_carlos", name: "Carlos Mendez", company: "Berkshire Hathaway", role: "Agent",
    stage: "Event Invite / Awareness", warmth: "cooling", value: "medium",
    lastTouch: "7 weeks ago", nextTouch: "This week", touches: 5,
    opportunity: "Cooling — needs a reason to re-engage",
    project: "—",
    comms: "Responds to event invites", events: "Invite the Summer Mixer",
    escrowOfficer: "—", partners: "—",
    nextBest: "Personal invite to the Summer Agent Mixer",
    note: "Was active in spring, went quiet. Event is the natural re-open.",
  },
  {
    id: "p_helen", name: "Helen Brooks", company: "RE/MAX", role: "Senior Agent",
    stage: "At-risk / Reactivation", warmth: "atrisk", value: "high",
    lastTouch: "3 months ago", nextTouch: "Overdue", touches: 22,
    opportunity: "Was a top partner — went cold after escrow officer change",
    project: "—",
    comms: "Prefers a real call, not a text", events: "Not invited yet",
    escrowOfficer: "Renee Cole (new)", partners: "—",
    nextBest: "Call to reintroduce Renee + own the last hand-off gap",
    note: "High value, high risk. Worth a personal, no-ask check-in.",
  },
  {
    id: "p_greg", name: "Greg Patterson", company: "Summit Lending", role: "Loan Officer",
    stage: "Repeat Partner", warmth: "warm", value: "high",
    lastTouch: "1 week ago", nextTouch: "Next week", touches: 27,
    opportunity: "Co-marketing — splits cost on joint mailers",
    project: "Co-branded buyer guide",
    comms: "Easygoing, quick on text", events: "Confirmed — Summer Mixer",
    escrowOfficer: "—", partners: "Refers Julie, Dana",
    nextBest: "Plan the co-branded buyer guide for spring",
    note: "Best referral engine you have. Keep this one warm always.",
  },
  {
    id: "p_naomi", name: "Naomi Webb", company: "Coldwell Banker", role: "Agent",
    stage: "Dormant — Keep in Nurture", warmth: "dormant", value: "low",
    lastTouch: "6 months ago", nextTouch: "Add to nurture", touches: 4,
    opportunity: "Quiet — keep on awareness list",
    project: "—",
    comms: "Newsletter only for now", events: "Add to invite list",
    escrowOfficer: "—", partners: "—",
    nextBest: "Add to quarterly newsletter + Summer Mixer list",
    note: "Low effort, keep present. May resurface.",
  },
];

const PROJECTS = [
  { id: "pr_julie", name: "Q3 Farm Postcard Campaign", person: "p_julie", type: "Direct Mail",
    progress: 70, due: "Today", status: "Needs Review", open: 3, total: 7 },
  { id: "pr_dana", name: "Just Listed Mailer — 88 Linden", person: "p_dana", type: "Direct Mail",
    progress: 40, due: "Tomorrow", status: "In Progress", open: 4, total: 6 },
  { id: "pr_marcus", name: "123 Maple Listing Brochure", person: "p_marcus", type: "Collateral",
    progress: 55, due: "Thu", status: "In Progress", open: 3, total: 6 },
  { id: "pr_event", name: "Summer Agent Mixer", person: null, type: "Event",
    progress: 60, due: "Jun 24", status: "In Progress", open: 4, total: 9 },
  { id: "pr_greg", name: "Co-branded Buyer Guide", person: "p_greg", type: "Collateral",
    progress: 15, due: "Jul 2", status: "Next", open: 5, total: 6 },
];

// Task statuses: Inbox, Today, Next, Waiting, In Progress, Needs Review, Completed, Someday, Archived
const TASKS = [
  { id: "t1", title: "Drop off 250-piece postcard proof to Julie for approval", project: "pr_julie", person: "p_julie", status: "Today", priority: 1, due: "Today", waiting: null, why: "Promised proof by end of week — campaign mail date depends on it", next: "Print proof, schedule drop-off" },
  { id: "t2", title: "Send welcome packet + earnest money timeline to Dana", project: "pr_dana", person: "p_dana", status: "Today", priority: 1, due: "Today", waiting: null, why: "First escrow with Dana — set the tone", next: "Pull packet, confirm dates with Renee" },
  { id: "t3", title: "Call Helen to reintroduce Renee + own the hand-off gap", project: null, person: "p_helen", status: "Today", priority: 1, due: "Today", waiting: null, why: "High-value partner at risk for 3 months", next: "Block 15 min, no pitch" },
  { id: "t4", title: "Send 123 Maple brochure design proof v2", project: "pr_marcus", person: "p_marcus", status: "In Progress", priority: 2, due: "Thu", waiting: null, why: "Marcus is detail-oriented; v1 had photo crop notes", next: "Apply crop notes, export PDF" },
  { id: "t5", title: "Follow up with Julie on mailer list count", project: "pr_julie", person: "p_julie", status: "Waiting", priority: 2, due: "Overdue", waiting: "Julie — final address count", why: "Can't lock print run without it", next: "Text reminder" },
  { id: "t6", title: "Pull mailing list for 88 Linden farm radius", project: "pr_dana", person: "p_dana", status: "Next", priority: 2, due: "Tomorrow", waiting: null, why: "Needed before mailer can print", next: "Run radius export in list tool" },
  { id: "t7", title: "Confirm venue + catering for Summer Mixer", project: "pr_event", person: null, status: "Waiting", priority: 2, due: "Jun 16", waiting: "Venue — final headcount", why: "Locks the date for invites", next: "Email venue with est. 40 guests" },
  { id: "t8", title: "Send personal Summer Mixer invite to Carlos", project: "pr_event", person: "p_carlos", status: "Next", priority: 3, due: "This week", waiting: null, why: "Cooling relationship — event is the re-open", next: "Write personal note, not a blast" },
  { id: "t9", title: "Send Priya the Q2 neighborhood market snapshot", project: null, person: "p_priya", status: "Next", priority: 3, due: "Overdue", waiting: null, why: "5 weeks since last touch — stay useful", next: "Generate snapshot, add one personal line" },
  { id: "t10", title: "Book Oak Hill farm strategy call with Sandra", project: null, person: "p_sandra", status: "Next", priority: 2, due: "Fri", waiting: null, why: "Wants a plan — first real marketing opportunity", next: "Send 3 time options" },
  { id: "t11", title: "Send intro + sample kit to Tomás, then book coffee", project: null, person: "p_tomas", status: "Next", priority: 3, due: "Mon", waiting: null, why: "Warm referral from Julie", next: "Attach kit PDF, suggest coffee" },
  { id: "t12", title: "Order event flyers for Summer Mixer", project: "pr_event", person: null, status: "In Progress", priority: 3, due: "Jun 18", waiting: null, why: "Need printed before invite push", next: "Approve flyer art, send to print" },
  { id: "t13", title: "Add Naomi to newsletter + Mixer invite list", project: null, person: "p_naomi", status: "Someday", priority: 4, due: "—", waiting: null, why: "Keep dormant contact in the world", next: "Add to lists" },
  { id: "t14", title: "Draft spring co-branded buyer guide outline", project: "pr_greg", person: "p_greg", status: "Next", priority: 3, due: "Jul 2", waiting: null, why: "Greg splits cost — easy win", next: "Rough 6-page outline" },
  { id: "t15", title: "Approve final postcard art with print vendor", project: "pr_julie", person: "p_julie", status: "Needs Review", priority: 1, due: "Today", waiting: null, why: "Last gate before mail date", next: "Review bleed + address block" },
];

// Captures = quick inbox notes that need processing into tasks/people/projects
const CAPTURES = [
  { id: "c1", text: "Julie mentioned her client wants a 'just sold' mailer next — new project?", when: "8:42a" },
  { id: "c2", text: "Idea: quarterly 'market minute' video clip agents can repost", when: "Yesterday" },
  { id: "c3", text: "Carlos said his daughter just started at State — good personal note hook", when: "Yesterday" },
  { id: "c4", text: "Need to ask Renee about the Linden Ct closing timeline", when: "2d ago" },
];

const MEETINGS = [
  { id: "m1", title: "Coffee w/ Dana — escrow kickoff", when: "Today · 10:30a", person: "p_dana", where: "Cafe Lola" },
  { id: "m2", title: "Office marketing sync", when: "Today · 2:00p", person: null, where: "Conference Rm B" },
  { id: "m3", title: "Sandra — Oak Hill strategy call", when: "Fri · 11:00a", person: "p_sandra", where: "Phone" },
];

// Marketing materials / production
// Stages: Requested, Designing, Proof Sent, Approved, Printing, Delivered, Launched, Results In
const MATERIALS = [
  { id: "mt1", title: "Q3 Farm Postcard (250 pc)", person: "p_julie", project: "pr_julie", type: "Direct Mail", stage: "Proof Sent", followup: "Follow up for approval", due: "Today" },
  { id: "mt2", title: "88 Linden — Just Listed Mailer", person: "p_dana", project: "pr_dana", type: "Direct Mail", stage: "Designing", followup: "Pull mailing list before print", due: "Tomorrow" },
  { id: "mt3", title: "123 Maple Listing Brochure", person: "p_marcus", project: "pr_marcus", type: "Brochure", stage: "Proof Sent", followup: "Send proof v2 for approval", due: "Thu" },
  { id: "mt4", title: "Summer Mixer Event Flyer", person: null, project: "pr_event", type: "Event Flyer", stage: "Approved", followup: "Invite agents once printed", due: "Jun 18" },
  { id: "mt5", title: "Co-branded Buyer Guide", person: "p_greg", project: "pr_greg", type: "Brochure", stage: "Requested", followup: "Outline + kickoff with Greg", due: "Jul 2" },
  { id: "mt6", title: "Oak Hill Farm Postcard #1", person: "p_dana", project: "pr_dana", type: "Direct Mail", stage: "Delivered", followup: "Check delivery + plan #2", due: "Done" },
  { id: "mt7", title: "Spring 'Just Sold' Social Set", person: "p_julie", project: null, type: "Social", stage: "Launched", followup: "Ask how engagement looked", due: "Last wk" },
  { id: "mt8", title: "Q1 Market Snapshot Email", person: null, project: null, type: "Newsletter", stage: "Results In", followup: "38% open — repeat for Q2", due: "Done" },
];

const CAMPAIGNS = [
  { id: "cp1", name: "Julie — Oak Hill Farm (12-touch)", person: "p_julie", touch: "4 of 12", channel: "Direct Mail", status: "Active", next: "Touch 5 — postcard, Jul 1", result: "2 listing leads so far" },
  { id: "cp2", name: "Dana — 88 Linden Just Listed", person: "p_dana", touch: "1 of 3", channel: "Mail + Social", status: "Active", next: "Touch 2 — neighbor mailer", result: "Escrow opened" },
  { id: "cp3", name: "Quarterly Market Minute", person: null, touch: "Q2", channel: "Email + Social", status: "Active", next: "Q2 send — Jun 20", result: "Q1: 38% open" },
  { id: "cp4", name: "Greg — Co-branded Buyer Series", person: "p_greg", touch: "0 of 4", channel: "Mail", status: "Planning", next: "Outline due Jul 2", result: "—" },
];

Object.assign(window, { PEOPLE, PROJECTS, TASKS, CAPTURES, MEETINGS, MATERIALS, CAMPAIGNS });
