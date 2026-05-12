-- Phase 3 of ~/.claude/plans/idempotent-toasting-tome.md (Option A).
-- AFTER UPDATE OF stage trigger on public.opportunities emits one
-- transaction.<verb> row into activity_events per stage transition.
--
-- Fires only on UPDATE (per Phase 3 plan revision: transitions only, not
-- inserts). New opportunities therefore do not emit transaction.opened on
-- creation; transaction.opened fires only when stage is moved TO 'prospect'
-- from another stage. Inserts can be instrumented separately if needed.
--
-- Stage -> verb mapping:
--   prospect       -> transaction.opened
--   under_contract -> transaction.under_contract
--   in_escrow      -> transaction.in_escrow
--   closed         -> transaction.closed
--   fell_through   -> transaction.fell_through
--
-- Idempotency: WHEN clause filters OLD.stage IS DISTINCT FROM NEW.stage, so
-- re-running an UPDATE that does not change stage produces no event. Also
-- skips when NEW.deleted_at is not null (soft-deleted rows do not emit).
--
-- actor_id resolution: COALESCE(auth.uid(), NEW.user_id, system_actor_id()).
-- opportunities.user_id is NOT NULL with DEFAULT auth.uid(), so the system
-- fallback is effectively unreachable for application writes, but the chain
-- defends against service-role or migration-time updates with no JWT context.

CREATE OR REPLACE FUNCTION public.emit_opportunity_transaction_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verb text;
  v_actor uuid;
BEGIN
  -- Skip soft-deleted rows.
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_verb := CASE NEW.stage
    WHEN 'prospect'       THEN 'transaction.opened'
    WHEN 'under_contract' THEN 'transaction.under_contract'
    WHEN 'in_escrow'      THEN 'transaction.in_escrow'
    WHEN 'closed'         THEN 'transaction.closed'
    WHEN 'fell_through'   THEN 'transaction.fell_through'
    ELSE NULL
  END;

  -- Unknown stage label (future enum addition without trigger update). Skip
  -- silently rather than break the underlying UPDATE.
  IF v_verb IS NULL THEN
    RETURN NEW;
  END IF;

  v_actor := COALESCE(auth.uid(), NEW.user_id, public.system_actor_id());

  INSERT INTO public.activity_events (
    user_id,
    actor_id,
    verb,
    object_table,
    object_id,
    context
  )
  VALUES (
    NEW.user_id,
    v_actor,
    v_verb,
    'opportunities',
    NEW.id,
    jsonb_build_object(
      'contact_id', NEW.contact_id,
      'sale_price', NEW.sale_price,
      'prior_stage', OLD.stage,
      'new_stage', NEW.stage,
      'escrow_number', NEW.escrow_number,
      'expected_close_date', NEW.expected_close_date
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.emit_opportunity_transaction_event() IS
  'AFTER UPDATE OF stage on opportunities: emits transaction.<verb> row into activity_events. See Phase 3 plan.';

DROP TRIGGER IF EXISTS opportunities_emit_transaction_event ON public.opportunities;

CREATE TRIGGER opportunities_emit_transaction_event
AFTER UPDATE OF stage ON public.opportunities
FOR EACH ROW
WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
EXECUTE FUNCTION public.emit_opportunity_transaction_event();
