// src/lib/activity/queries.ts
// Read queries for the activity_events ledger.
// Uses the browser-side Supabase client -- RLS scopes results to auth.uid().
// Slice 1 -- 2026-04-22.

import { createClient } from '@/lib/supabase/client';
import type { ActivityEvent } from './types';

export async function getContactTimeline(
  contactId: string,
  limit = 50
): Promise<ActivityEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .or(`object_id.eq.${contactId},context->>contact_id.eq.${contactId}`)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[activity/queries] getContactTimeline error:', error.message);
    return [];
  }
  return (data ?? []) as ActivityEvent[];
}

export async function getRecentActivity(limit = 100): Promise<ActivityEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[activity/queries] getRecentActivity error:', error.message);
    return [];
  }
  return (data ?? []) as ActivityEvent[];
}
