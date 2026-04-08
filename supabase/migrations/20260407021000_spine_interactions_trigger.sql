-- supabase/migrations/20260407021000_spine_interactions_trigger.sql
-- Denormalizes interactions.created_at into cycle_state.last_touched_at
-- so /api/spine/today can read recent-touch data without joining.
--
-- NOTE: contacts.tier uses letter grades ('A', 'B', 'C', 'P') in this
-- database -- not the numeric values shown in the spec. Both sets are
-- included in the CASE so this function works against both naming
-- conventions without requiring a schema change.

create or replace function public.spine_update_cycle_on_interaction()
returns trigger language plpgsql security definer as $$
declare
  v_contact_tier text;
  v_default_days integer;
  v_cadence_days integer;
begin
  if new.contact_id is null then
    return new;
  end if;

  -- Look up tier from contacts to pick a default cadence.
  select tier into v_contact_tier
  from public.contacts where id = new.contact_id;

  v_default_days := case coalesce(v_contact_tier, '')
    when '1' then 7
    when 'tier1' then 7
    when 'A' then 7
    when '2' then 14
    when 'tier2' then 14
    when 'B' then 14
    when '3' then 30
    when 'tier3' then 30
    when 'C' then 30
    else 30
  end;

  -- Upsert cycle_state for this contact and recompute next_due_at.
  insert into public.cycle_state (contact_id, user_id, last_touched_at, next_due_at, current_streak_days, status)
  values (
    new.contact_id,
    coalesce(new.user_id, auth.uid()),
    new.created_at,
    new.created_at + make_interval(days => v_default_days),
    0,
    'active'
  )
  on conflict (contact_id) do update
  set last_touched_at = excluded.last_touched_at,
      next_due_at = excluded.last_touched_at + make_interval(
        days => coalesce(public.cycle_state.cadence_days, v_default_days)
      ),
      current_streak_days = 0,
      updated_at = now();

  return new;
end
$$;

drop trigger if exists interactions_update_cycle on public.interactions;
create trigger interactions_update_cycle
  after insert on public.interactions
  for each row execute function public.spine_update_cycle_on_interaction();
