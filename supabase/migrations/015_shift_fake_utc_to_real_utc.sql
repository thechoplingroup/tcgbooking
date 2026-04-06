-- Shift existing appointment and blocked_time rows from the old
-- "Central wall-clock labeled as UTC" storage convention to real UTC.
--
-- Background: prior to this migration, `src/lib/availability.ts::formatSlot`
-- wrote ISO strings like `2026-04-07T10:00:00Z` when the user picked a 10 AM
-- Central slot. Postgres happily stored them as real UTC instants, which is
-- actually 5 AM Central (during CDT). Display code compensated by reading
-- everything back with `timeZone: "UTC"`, but any timezone-aware consumer
-- (Google Calendar export, calendar apps, etc.) saw the wrong absolute time.
--
-- This migration rewrites every affected row so the stored instant matches
-- the wall-clock time the booker actually selected, and the app code has
-- been updated in lockstep to read/write real UTC from now on.
--
-- The conversion works by taking the current stored timestamp, pulling its
-- wall-clock parts as if they were UTC (`at time zone 'UTC'`), then
-- re-interpreting those parts as Central time (`at time zone 'America/Chicago'`).
-- Postgres's `at time zone` is DST-aware, so March/November appointments
-- land on the correct offset automatically.
--
-- Idempotency: the migration records completion in `_central_time_migration`
-- and becomes a no-op if re-run.

create table if not exists public._central_time_migration (
  id int primary key default 1,
  applied_at timestamptz not null default now(),
  constraint _central_time_migration_singleton check (id = 1)
);

do $mig$
begin
  if exists (select 1 from public._central_time_migration) then
    raise notice 'central-time shift already applied — skipping';
    return;
  end if;

  -- Appointments (start_at, end_at)
  update public.appointments
  set
    start_at = (start_at at time zone 'UTC') at time zone 'America/Chicago',
    end_at   = (end_at   at time zone 'UTC') at time zone 'America/Chicago';

  -- Blocked times (start_at, end_at)
  update public.blocked_times
  set
    start_at = (start_at at time zone 'UTC') at time zone 'America/Chicago',
    end_at   = (end_at   at time zone 'UTC') at time zone 'America/Chicago';

  -- Record that the shift is done.
  insert into public._central_time_migration (id) values (1);
end
$mig$;
