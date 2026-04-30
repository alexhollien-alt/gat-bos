// Slice 5B Task 3 -- project-created handler.
//
// Fires after a row lands in public.projects. The dispatcher
// (src/lib/hooks/post-creation.ts) catches anything thrown here and
// records the failure to activity_events + error_logs, so handlers
// throw on unexpected DB errors but never on idempotency short-circuits.
//
// Idempotency guard: a single activity_events row with
// verb='project.hook_fired' and object_id=projectId. If present, exit
// before any side-effect writes.
//
// Listing projects (type='listing') receive:
//   1 listing-setup touchpoint (due+1d)
//   2 proactive email_drafts (synthetic emails parents, idempotent on
//     emails.gmail_id sentinel `proactive-listing-launch-{pid}-{slug}`)
//   3 logistics tasks: photographer (+1d), neighbor email (+2d),
//     open-house event (+5d)
//
// Other project types receive:
//   1 generic note touchpoint (due+2d)
//   3 generic tasks: define scope (+1d), next action (+3d), milestone (+7d)

import { adminClient } from '@/lib/supabase/admin';
import { writeEvent } from '@/lib/activity/writeEvent';
import { logError } from '@/lib/error-log';
import type { FirePostCreationHooksInput } from '../post-creation';

const HOOK_SOURCE = 'project_hook';
const ROUTE = 'hooks/project-created';

interface ProjectRow {
  id: string;
  type: string;
  title: string;
  status: string;
  owner_contact_id: string | null;
  metadata: Record<string, unknown> | null;
  deleted_at: string | null;
}

interface TemplateRow {
  id: string;
  slug: string;
  version: number;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
}

const LISTING_TEMPLATE_SLUGS = ['listing-launch-invite', 'listing-launch-social'] as const;
type ListingTemplateSlug = (typeof LISTING_TEMPLATE_SLUGS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

export async function projectCreatedHandler(
  input: FirePostCreationHooksInput,
): Promise<void> {
  const { entityId: projectId, ownerUserId } = input;

  // Idempotency: skip if hook already fired for this project.
  const { data: alreadyFired } = await adminClient
    .from('activity_events')
    .select('id')
    .eq('object_table', 'projects')
    .eq('object_id', projectId)
    .eq('verb', 'project.hook_fired')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (alreadyFired?.id) {
    return;
  }

  // Read live row (don't trust dispatch payload).
  const { data: project, error: projectErr } = await adminClient
    .from('projects')
    .select('id, type, title, status, owner_contact_id, metadata, deleted_at')
    .eq('id', projectId)
    .maybeSingle<ProjectRow>();
  if (projectErr || !project) {
    await logError(ROUTE, 'project lookup failed or row missing', {
      projectId,
      error: projectErr?.message,
    });
    return;
  }
  if (project.deleted_at) {
    return;
  }

  const isListing = project.type === 'listing';

  // Touchpoint -- one row regardless of type. Self-referential:
  // entity_table='projects' + entity_id=project.id.
  const touchpointType = isListing ? 'listing_setup' : 'contact_note';
  const dueAt = isListing ? daysFromNow(1) : daysFromNow(2);
  const touchpointNote = isListing
    ? `Listing setup checklist for ${project.title}`
    : `Follow-up note for ${project.title}`;

  const { error: touchpointErr } = await adminClient
    .from('project_touchpoints')
    .insert({
      project_id: project.id,
      touchpoint_type: touchpointType,
      entity_table: 'projects',
      entity_id: project.id,
      due_at: dueAt,
      note: touchpointNote,
      user_id: ownerUserId,
    });
  if (touchpointErr) {
    await logError(ROUTE, `touchpoint insert failed: ${touchpointErr.message}`, {
      projectId,
    });
    throw new Error(`touchpoint insert failed: ${touchpointErr.message}`);
  }

  // Tasks -- 3 rows. Listing path uses launch checklist; other types use
  // generic placeholders so the project surfaces in /today regardless.
  const tasks = isListing
    ? [
        {
          title: 'Confirm photographer',
          due: daysFromNow(1),
          hint: 'Lock the photographer slot before MLS goes live.',
        },
        {
          title: `Send launch email to neighbors -- ${project.title}`,
          due: daysFromNow(2),
          hint: 'Use the listing-launch-invite draft in /drafts.',
        },
        {
          title: `Schedule open-house event -- ${project.title}`,
          due: daysFromNow(5),
          hint: 'Create the event from /calendar so it auto-links to this project.',
        },
      ]
    : [
        {
          title: `Define scope -- ${project.title}`,
          due: daysFromNow(1),
          hint: 'Capture goal, deliverable, and success criteria.',
        },
        {
          title: `Identify next action -- ${project.title}`,
          due: daysFromNow(3),
          hint: 'Smallest concrete move that unblocks momentum.',
        },
        {
          title: `First milestone -- ${project.title}`,
          due: daysFromNow(7),
          hint: 'First visible outcome the project should produce.',
        },
      ];

  const taskRows = tasks.map((t) => ({
    title: t.title,
    description: null,
    due_date: t.due,
    priority: 'medium',
    status: 'open',
    type: 'follow_up',
    source: HOOK_SOURCE,
    action_hint: t.hint,
    user_id: ownerUserId,
    project_id: project.id,
    contact_id: project.owner_contact_id ?? null,
  }));

  const { error: tasksErr } = await adminClient.from('tasks').insert(taskRows);
  if (tasksErr) {
    await logError(ROUTE, `tasks insert failed: ${tasksErr.message}`, {
      projectId,
    });
    throw new Error(`tasks insert failed: ${tasksErr.message}`);
  }

  // Listing-only: synthesize 2 email_drafts via parent emails sentinel rows.
  if (isListing) {
    const { data: templates, error: tplErr } = await adminClient
      .from('templates')
      .select('id, slug, version, subject, body_html, body_text')
      .in('slug', LISTING_TEMPLATE_SLUGS as readonly string[])
      .is('deleted_at', null)
      .order('version', { ascending: false });
    if (tplErr) {
      await logError(ROUTE, `template lookup failed: ${tplErr.message}`, { projectId });
      throw new Error(`template lookup failed: ${tplErr.message}`);
    }

    const ownerEmail = process.env.RESEND_SAFE_RECIPIENT ?? 'alex@alexhollienco.com';
    const expiresAt = new Date(Date.now() + 7 * DAY_MS).toISOString();

    for (const slug of LISTING_TEMPLATE_SLUGS) {
      const tpl = (templates ?? []).find((t) => t.slug === slug) as TemplateRow | undefined;
      if (!tpl) {
        await logError(ROUTE, `template missing: ${slug}`, { projectId });
        continue;
      }
      await ensureProactiveDraft({
        projectId: project.id,
        projectTitle: project.title,
        slug,
        template: tpl,
        ownerEmail,
        expiresAt,
      });
    }
  }

  // Mark hook as fired so retries are no-ops.
  await writeEvent({
    userId: ownerUserId,
    actorId: ownerUserId,
    verb: 'project.hook_fired',
    object: { table: 'projects', id: project.id },
    context: {
      handler: 'project-created',
      project_type: project.type,
      tasks_inserted: taskRows.length,
      drafts_inserted: isListing ? LISTING_TEMPLATE_SLUGS.length : 0,
    },
  });
}

interface EnsureDraftInput {
  projectId: string;
  projectTitle: string;
  slug: ListingTemplateSlug;
  template: TemplateRow;
  ownerEmail: string;
  expiresAt: string;
}

async function ensureProactiveDraft(input: EnsureDraftInput): Promise<void> {
  const { projectId, projectTitle, slug, template, ownerEmail, expiresAt } = input;
  const sentinelGmailId = `proactive-listing-launch-${projectId}-${slug}`;

  // Synthetic parent emails row. UNIQUE(gmail_id) gives idempotency.
  const subject = template.subject ?? `Listing launch -- ${projectTitle}`;
  const { data: emailRow, error: emailErr } = await adminClient
    .from('emails')
    .upsert(
      {
        gmail_id: sentinelGmailId,
        from_email: ownerEmail,
        from_name: 'Alex Hollien',
        subject,
        body_plain: template.body_text,
        body_html: template.body_html,
        snippet: template.body_text?.slice(0, 200) ?? null,
        is_unread: false,
        is_contact_match: false,
        is_potential_re_pro: false,
        labels: [],
        created_at: new Date().toISOString(),
      },
      { onConflict: 'gmail_id' },
    )
    .select('id')
    .single<{ id: string }>();
  if (emailErr || !emailRow) {
    await logError(ROUTE, `synthetic emails upsert failed: ${emailErr?.message ?? 'no row'}`, {
      projectId,
      slug,
    });
    throw new Error(`synthetic emails upsert failed: ${emailErr?.message ?? 'no row'}`);
  }

  // If a draft already exists for this email_id, skip the second insert.
  const { data: existingDraft } = await adminClient
    .from('email_drafts')
    .select('id')
    .eq('email_id', emailRow.id)
    .neq('status', 'discarded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingDraft?.id) {
    return;
  }

  const generatedAt = new Date().toISOString();
  const { error: draftErr } = await adminClient.from('email_drafts').insert({
    email_id: emailRow.id,
    draft_subject: subject,
    draft_body_plain: template.body_text,
    draft_body_html: template.body_html,
    status: 'generated',
    escalation_flag: null,
    escalation_reason: null,
    generated_at: generatedAt,
    expires_at: expiresAt,
    audit_log: {
      event_sequence: [
        {
          timestamp: generatedAt,
          event: 'proactive_draft_seeded',
          source: HOOK_SOURCE,
          template_slug: slug,
          template_version: template.version,
          project_id: projectId,
        },
      ],
      metadata: {
        source: HOOK_SOURCE,
        template_slug: slug,
        template_version: template.version,
        project_id: projectId,
      },
    },
    metadata: {
      source: HOOK_SOURCE,
      template_slug: slug,
      project_id: projectId,
    },
  });
  if (draftErr) {
    await logError(ROUTE, `email_drafts insert failed: ${draftErr.message}`, {
      projectId,
      slug,
    });
    throw new Error(`email_drafts insert failed: ${draftErr.message}`);
  }
}
