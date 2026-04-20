import { differenceInDays, parseISO, startOfToday } from "date-fns";
import type { ActionItem, ActionItemType, Contact, ContactTier, FollowUp, Task } from "./types";

// ---------------------
// Scoring weights
// ---------------------

const TYPE_WEIGHT: Record<ActionItemType, number> = {
  overdue_followup: 50,
  due_followup: 35,
  overdue_task: 30,
  stale_contact: 20,
  due_task: 15,
};

const TIER_WEIGHT: Record<NonNullable<ContactTier>, number> = {
  A: 40,
  B: 25,
  C: 10,
  P: 5,
};

// Days since last interaction before a contact is considered stale, by tier
const STALE_THRESHOLD_DAYS: Record<NonNullable<ContactTier>, number> = {
  A: 7,
  B: 14,
  C: 30,
  P: 60,
};

// ---------------------
// Core scorer
// ---------------------

function scoreAction(item: Pick<ActionItem, "type" | "contactTier" | "contactHealthScore" | "daysOverdue">): number {
  const typeScore = TYPE_WEIGHT[item.type];
  const tierScore = item.contactTier ? TIER_WEIGHT[item.contactTier] : 0;
  const overdueBonus = Math.min(item.daysOverdue * 2, 20);
  const healthScoreBonus = Math.min(item.contactHealthScore / 10, 10);

  return Math.min(Math.round(typeScore + tierScore + overdueBonus + healthScoreBonus), 100);
}

// ---------------------
// Contact name helper
// ---------------------

type ContactSummary = Pick<Contact, "id" | "first_name" | "last_name" | "tier" | "health_score" | "brokerage" | "phone" | "email">;

function contactName(c: Pick<Contact, "first_name" | "last_name">): string {
  return `${c.first_name} ${c.last_name}`.trim();
}

// ---------------------
// Follow-up builder
// ---------------------

type FollowUpWithContact = FollowUp & {
  contacts: ContactSummary | null;
};

export function buildFollowUpActions(followUps: FollowUpWithContact[]): ActionItem[] {
  const today = startOfToday();
  const items: ActionItem[] = [];

  for (const fu of followUps) {
    if (fu.status !== "pending") continue;

    const contact = fu.contacts;
    if (!contact) continue;

    const dueDate = parseISO(fu.due_date);
    const daysOverdue = Math.max(differenceInDays(today, dueDate), 0);
    const isOverdue = daysOverdue > 0;
    const type: ActionItemType = isOverdue ? "overdue_followup" : "due_followup";

    const item: ActionItem = {
      id: `followup-${fu.id}`,
      type,
      priority: 0,
      contactId: contact.id,
      contactName: contactName(contact),
      contactTier: contact.tier,
      contactHealthScore: contact.health_score ?? 0,
      contactBrokerage: contact.brokerage,
      contactPhone: contact.phone,
      contactEmail: contact.email,
      title: fu.reason,
      subtitle: isOverdue
        ? `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
        : "Due today",
      dueDate: fu.due_date,
      daysOverdue,
      sourceId: fu.id,
      sourceTable: "follow_ups",
    };

    item.priority = scoreAction(item);
    items.push(item);
  }

  return items;
}

// ---------------------
// Task builder
// ---------------------

type TaskWithContact = Task & {
  contacts: ContactSummary | null;
};

export function buildTaskActions(tasks: TaskWithContact[]): ActionItem[] {
  const today = startOfToday();
  const items: ActionItem[] = [];

  for (const task of tasks) {
    if (task.status === "completed") continue;
    if (!task.due_date) continue;

    const contact = task.contacts ?? null;

    const dueDate = parseISO(task.due_date);
    const daysOverdue = Math.max(differenceInDays(today, dueDate), 0);
    const isOverdue = daysOverdue > 0;
    const type: ActionItemType = isOverdue ? "overdue_task" : "due_task";

    const item: ActionItem = {
      id: `task-${task.id}`,
      type,
      priority: 0,
      contactId: contact?.id ?? "",
      contactName: contact ? contactName(contact) : "No contact",
      contactTier: contact?.tier ?? null,
      contactHealthScore: contact?.health_score ?? 0,
      contactBrokerage: contact?.brokerage ?? null,
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null,
      title: task.title,
      subtitle: isOverdue
        ? `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`
        : "Due today",
      dueDate: task.due_date,
      daysOverdue,
      sourceId: task.id,
      sourceTable: "tasks",
    };

    item.priority = scoreAction(item);
    items.push(item);
  }

  return items;
}

// ---------------------
// Stale contact builder
// ---------------------

export function buildStaleActions(
  contacts: ContactSummary[],
  lastInteractions: Record<string, string> // contactId -> ISO date string of last interaction
): ActionItem[] {
  const today = startOfToday();
  const items: ActionItem[] = [];

  for (const contact of contacts) {
    if (!contact.tier) continue;

    const threshold = STALE_THRESHOLD_DAYS[contact.tier];
    const lastDateStr = lastInteractions[contact.id];

    // If no interaction on record, treat contact as maximally stale
    const daysSinceContact = lastDateStr
      ? differenceInDays(today, parseISO(lastDateStr))
      : threshold + 1;

    if (daysSinceContact < threshold) continue;

    const daysOverdue = daysSinceContact - threshold;

    const item: ActionItem = {
      id: `stale-${contact.id}`,
      type: "stale_contact",
      priority: 0,
      contactId: contact.id,
      contactName: contactName(contact),
      contactTier: contact.tier,
      contactHealthScore: contact.health_score ?? 0,
      contactBrokerage: contact.brokerage,
      contactPhone: contact.phone,
      contactEmail: contact.email,
      title: `Re-engage ${contactName(contact)}`,
      subtitle: lastDateStr
        ? `No contact in ${daysSinceContact} day${daysSinceContact === 1 ? "" : "s"}`
        : "No interaction on record",
      dueDate: null,
      daysOverdue,
      sourceId: contact.id,
      sourceTable: "contacts",
    };

    item.priority = scoreAction(item);
    items.push(item);
  }

  return items;
}
