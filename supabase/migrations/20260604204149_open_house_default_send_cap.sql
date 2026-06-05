-- Warmup: default every new open house blast to a 50-recipient-per-run cap.
-- The sender enforces daily_send_cap (over-cap recipients queue for the next run).
-- createBlast omits the column, so this column default applies to new blasts.
-- Raise this default (or set a higher per-blast cap) as the subdomain warms up.
ALTER TABLE public.open_house_blasts ALTER COLUMN daily_send_cap SET DEFAULT 50;
