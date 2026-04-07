# Analytics Use Cases
# GAT-BOS CRM -- Decision-Driven Analytics Spec

---

## Who Uses This Page

One person: Alex Hollien, Title Sales Executive at Great American Title Agency.
No team dashboard, no sharing. Every view answers a question Alex asks on a specific cadence.

---

## When It Gets Used

- **Friday weekly review:** 15 minutes. Scan all four views. Adjust the week's call list.
- **End-of-month review:** 30 minutes. Assess pipeline value closed vs prior month, decide
  which campaigns to carry forward, flag any print throughput problems before next cycle.

---

## What Decisions It Drives

| Review | Decision |
|--------|----------|
| Which agents to drop or invest in | Temperature trend view: movers in each direction |
| Which campaigns to repeat or kill | Campaign performance table: open rate + activity |
| Where to spend time this week | Cooling contacts list: the call list is already built |
| Whether print throughput is on track | Submitted vs completed bars, avg turnaround stat |
| Is this month better than last month | Closed value comparison with direction arrow |

---

## The Four Questions

### Question 01 -- Agent Temperature Trends
"Which agents are warming up or cooling off?"

**Chart:** Two horizontal bar groups. Top 5 warmest contacts by current temperature score.
Bottom 5 cooling contacts (lowest or most-dropped temperature scores). Comparison is
current temperature vs the 30-day prior baseline derived from interaction frequency.

**Data source:** `contacts` table, `temperature` field. `interactions` table for 30-day proxy.

**Action:** Call the top 5 cooling agents this week. Lock down the warmest 5 with a touch.

---

### Question 02 -- Pipeline Funnel + Month-Over-Month
"What is moving through my pipeline and at what value?"

**Chart:** Vertical bar chart grouped by opportunity stage (prospect, under_contract,
in_escrow, closed). Stage bars show total deal value. Above the chart: a stat block
comparing closed-this-month dollar total vs closed-last-month, with an arrow indicator.

**Data source:** `opportunities` table, grouped by `stage` and filtered by `closed_at` month.

**Action:** If this month is below last month, push the under_contract pile.

---

### Question 03 -- Print Production Throughput
"Is print production keeping pace with what agents need?"

**Chart:** Stacked bar chart, last 8 weeks. Each week shows tickets submitted (blue)
vs tickets completed (green). Below the chart: average turnaround time in days as a
single stat. A warning threshold is 5 days.

**Data source:** `material_requests` table. Submitted = `created_at` week bucket.
Completed = `completed_at` week bucket, filtered to `status = 'complete'`.

**Action:** If turnaround creeps over 5 days, escalate to the design team.

---

### Question 04 -- Campaign Performance
"Which campaigns are actually generating opens and downstream activity?"

**Chart:** Sortable table. Columns: Campaign Name, Sent (step completions),
Open Rate (email_opened / total email steps completed), Status.
Sorted by open rate descending. Color-coded: above 25% is green, 15-25% is yellow,
below 15% is red.

**Data source:** `campaigns` joined to `campaign_step_completions` via
`campaign_steps` and `campaign_enrollments`.

**Action:** Repeat the top performer. Archive anything below 15 percent.

---

## What Was Removed and Why

The previous version had four charts with no documented decision attached:

1. **Agent Acquisition Funnel** -- counted contacts by `lead_status`. Alex does not make
   weekly decisions based on how many contacts are tagged "qualified" vs "nurturing."
   No action was defined. Removed.

2. **Pipeline Health** -- showed dollar value by stage but no month-over-month comparison.
   Without the comparison, there is no trigger for action. Replaced with the funnel +
   month-over-month view that includes the direction indicator.

3. **Relationship Breakdown pie chart** -- counted contacts by relationship tier. A pie chart
   showing how many are "warm" vs "dormant" does not tell Alex who to call. The temperature
   trend view replaces this with ranked, actionable names.

4. **Production Throughput (completions only)** -- showed completed materials per week but not
   submitted vs completed side-by-side. Without the comparison, there is no way to see
   whether the queue is growing or shrinking. Replaced with the stacked bar.

Every removed chart was noise because it had no defined decision attached to it.
