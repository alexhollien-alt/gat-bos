import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const envPath = resolve(homedir(), 'crm', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g, '')]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const mode = process.argv[2];
if (mode === 'list') {
  const { data, error } = await admin.from('events')
    .select('id, gcal_event_id, title, start_at, end_at, source, project_id, contact_id, synced_at, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
} else if (mode === 'by-gcal') {
  const gcalId = process.argv[3];
  const { data, error } = await admin.from('events').select('*').eq('gcal_event_id', gcalId).maybeSingle();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
} else if (mode === 'by-id') {
  const id = process.argv[3];
  const { data, error } = await admin.from('events').select('*').eq('id', id).maybeSingle();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
} else if (mode === 'link-project') {
  const eventId = process.argv[3];
  const projectId = process.argv[4];
  const { data, error } = await admin.from('events').update({ project_id: projectId }).eq('id', eventId).select().single();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
} else if (mode === 'create-project') {
  const { data, error } = await admin.from('projects').insert({
    type: 'other',
    title: 'Phase 7 gate test -- calendar',
    status: 'active',
  }).select().single();
  if (error) { console.error(error); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
} else if (mode === 'delete-event') {
  const id = process.argv[3];
  const { error } = await admin.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error(error); process.exit(1); }
  console.log('soft-deleted', id);
} else if (mode === 'cleanup') {
  // Soft-delete Phase 7 Supabase fixtures per standing rule 3.
  // project_touchpoints has no deleted_at column; it rides parent project
  // lifecycle per phase-1.4 migration (comment lines 25-28). Soft-deleting
  // the project is sufficient -- touchpoint 0fa14529 remains in the table
  // but app-layer queries filter via projects.deleted_at IS NULL.
  //
  // GCal-side fixtures (4f325404bksb50mvt162s3t42a, qqdtvo4048vl7ses48orhcc3l4)
  // are deleted separately via MCP delete_event, not from this script.
  const now = new Date().toISOString();
  const EVENT_IDS = [
    '6f3433b1-4cb0-4a8b-9922-163f4e2958fc',
    'b2353054-e232-4d97-ac2c-f6b624ee6e6c',
  ];
  const PROJECT_IDS = ['f9179653-b1d4-4e17-a736-c816f145a6c2'];
  const ORPHAN_TOUCHPOINT_IDS = ['0fa14529-7bcc-4abe-a579-9baaeed2bc68'];

  const report = { events: [], projects: [], orphan_touchpoints: [] };

  for (const id of EVENT_IDS) {
    const { data, error } = await admin.from('events')
      .update({ deleted_at: now })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, deleted_at')
      .maybeSingle();
    if (error) { console.error('events', id, error); process.exit(1); }
    report.events.push({ id, result: data ?? 'already-deleted-or-missing' });
  }

  for (const id of PROJECT_IDS) {
    const { data, error } = await admin.from('projects')
      .update({ deleted_at: now })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, deleted_at')
      .maybeSingle();
    if (error) { console.error('projects', id, error); process.exit(1); }
    report.projects.push({ id, result: data ?? 'already-deleted-or-missing' });
  }

  // Surface orphan touchpoint state so it's visible in the report even
  // though we don't soft-delete it directly.
  for (const id of ORPHAN_TOUCHPOINT_IDS) {
    const { data, error } = await admin.from('project_touchpoints')
      .select('id, project_id, touchpoint_type, entity_id, entity_table')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('project_touchpoints', id, error); process.exit(1); }
    report.orphan_touchpoints.push({ id, state: data ?? 'missing', note: 'parent project soft-deleted; row remains per migration design (no deleted_at column)' });
  }

  console.log(JSON.stringify(report, null, 2));
}
