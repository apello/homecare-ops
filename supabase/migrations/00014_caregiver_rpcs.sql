-- ============================================================
-- Migration: Caregiver operations RPCs
-- Purpose:
-- - Controlled creation of caregivers (created_by_user_id can never be spoofed)
-- - Availability upsert with overlap protection
-- - Compensation rate versioning (closes the prior active rate)
-- - Opportunistic expiry of caregiver credentials
-- - Soft-delete column for caregiver availability exceptions
-- - Authorization enforced via has_org_permission()
--   (caregivers.manage, caregivers.read_compensation)
-- ============================================================

alter table public.caregiver_availability_exceptions
  add column if not exists active boolean not null default true;

-- Helper function to check if user can manage caregivers in org
create or replace function public.can_manage_org_caregivers(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'caregivers.manage');
$$;

-- Helper function to check if user can read caregiver compensation in org
create or replace function public.can_read_org_compensation(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'caregivers.read_compensation');
$$;

-- ============================================================
-- 1. Create caregiver
-- ============================================================

create or replace function public.create_caregiver(
  target_org_id uuid,
  first_name text,
  last_name text,
  classification text,
  email text default null,
  phone text default null,
  employee_external_id text default null,
  max_hours_per_week numeric default null,
  service_area_zip text default null,
  travel_radius_miles numeric default null
)
returns public.caregivers
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.caregivers;
begin
  if not public.can_manage_org_caregivers(target_org_id) then
    raise exception 'Not authorized to manage caregivers for this organization';
  end if;

  if first_name is null or first_name = '' then
    raise exception 'First name is required';
  end if;

  if last_name is null or last_name = '' then
    raise exception 'Last name is required';
  end if;

  if classification not in ('RN', 'LPN', 'HHA', 'STNA') then
    raise exception 'Invalid caregiver classification';
  end if;

  insert into public.caregivers (
    organization_id,
    first_name,
    last_name,
    classification,
    email,
    phone,
    employee_external_id,
    max_hours_per_week,
    service_area_zip,
    travel_radius_miles,
    created_by_user_id
  )
  values (
    target_org_id,
    create_caregiver.first_name,
    create_caregiver.last_name,
    create_caregiver.classification,
    create_caregiver.email,
    create_caregiver.phone,
    create_caregiver.employee_external_id,
    create_caregiver.max_hours_per_week,
    create_caregiver.service_area_zip,
    create_caregiver.travel_radius_miles,
    auth.uid()
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.create_caregiver(uuid, text, text, text, text, text, text, numeric, text, numeric) from public;
grant execute on function public.create_caregiver(uuid, text, text, text, text, text, text, numeric, text, numeric) to authenticated;


-- ============================================================
-- 2. Upsert caregiver availability window
-- ============================================================
-- Updates the matching window (same day + times + effective start) when it
-- already exists, otherwise inserts a new window. Overlapping windows on the
-- same day whose effective ranges intersect are rejected.

create or replace function public.upsert_caregiver_availability(
  target_org_id uuid,
  target_caregiver_id uuid,
  day_of_week smallint,
  start_time time,
  end_time time,
  availability_status text,
  effective_start_date date,
  effective_end_date date default null
)
returns public.caregiver_availability
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.caregiver_availability;
  existing_id uuid;
begin
  if not public.can_manage_org_caregivers(target_org_id) then
    raise exception 'Not authorized to manage caregivers for this organization';
  end if;

  if availability_status not in ('Available', 'Unavailable', 'Preferred') then
    raise exception 'Invalid availability status';
  end if;

  if day_of_week is null or day_of_week < 0 or day_of_week > 6 then
    raise exception 'Invalid day of week';
  end if;

  if end_time <= start_time then
    raise exception 'End time must be after start time';
  end if;

  if effective_end_date is not null and effective_end_date < effective_start_date then
    raise exception 'Effective end date must be on or after the effective start date';
  end if;

  if not exists (
    select 1 from public.caregivers
    where id = target_caregiver_id and organization_id = target_org_id
  ) then
    raise exception 'Caregiver not found';
  end if;

  select id into existing_id
  from public.caregiver_availability
  where organization_id = target_org_id
    and caregiver_id = target_caregiver_id
    and caregiver_availability.day_of_week = upsert_caregiver_availability.day_of_week
    and caregiver_availability.start_time = upsert_caregiver_availability.start_time
    and caregiver_availability.end_time = upsert_caregiver_availability.end_time
    and caregiver_availability.effective_start_date = upsert_caregiver_availability.effective_start_date
  limit 1;

  if exists (
    select 1
    from public.caregiver_availability existing
    where existing.organization_id = target_org_id
      and existing.caregiver_id = target_caregiver_id
      and existing.day_of_week = upsert_caregiver_availability.day_of_week
      and (existing_id is null or existing.id <> existing_id)
      and existing.start_time < upsert_caregiver_availability.end_time
      and existing.end_time > upsert_caregiver_availability.start_time
      and existing.effective_start_date
          <= coalesce(upsert_caregiver_availability.effective_end_date, 'infinity'::date)
      and coalesce(existing.effective_end_date, 'infinity'::date)
          >= upsert_caregiver_availability.effective_start_date
  ) then
    raise exception 'Availability window overlaps an existing window';
  end if;

  if existing_id is not null then
    update public.caregiver_availability
    set
      availability_status = upsert_caregiver_availability.availability_status,
      effective_end_date = upsert_caregiver_availability.effective_end_date,
      updated_at = now()
    where id = existing_id
    returning * into result_row;
  else
    insert into public.caregiver_availability (
      organization_id,
      caregiver_id,
      day_of_week,
      start_time,
      end_time,
      availability_status,
      effective_start_date,
      effective_end_date
    )
    values (
      target_org_id,
      target_caregiver_id,
      upsert_caregiver_availability.day_of_week,
      upsert_caregiver_availability.start_time,
      upsert_caregiver_availability.end_time,
      upsert_caregiver_availability.availability_status,
      upsert_caregiver_availability.effective_start_date,
      upsert_caregiver_availability.effective_end_date
    )
    returning * into result_row;
  end if;

  return result_row;
end;
$$;

revoke all on function public.upsert_caregiver_availability(uuid, uuid, smallint, time, time, text, date, date) from public;
grant execute on function public.upsert_caregiver_availability(uuid, uuid, smallint, time, time, text, date, date) to authenticated;


-- ============================================================
-- 3. Set caregiver compensation rate
-- ============================================================
-- Closes the current active rate for the same organization service
-- (null-safe) and inserts the new rate approved by the caller.

create or replace function public.set_caregiver_compensation_rate(
  target_org_id uuid,
  target_caregiver_id uuid,
  pay_rate numeric,
  rate_unit text,
  effective_start_date date,
  organization_service_id uuid default null
)
returns public.caregiver_compensation_rates
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.caregiver_compensation_rates;
begin
  if not public.can_manage_org_caregivers(target_org_id) then
    raise exception 'Not authorized to manage caregivers for this organization';
  end if;

  if not public.can_read_org_compensation(target_org_id) then
    raise exception 'Not authorized to manage caregiver compensation for this organization';
  end if;

  if rate_unit not in ('Hour', 'Visit', 'Unit') then
    raise exception 'Invalid rate unit';
  end if;

  if pay_rate is null or pay_rate <= 0 then
    raise exception 'Pay rate must be greater than zero';
  end if;

  if not exists (
    select 1 from public.caregivers
    where id = target_caregiver_id and organization_id = target_org_id
  ) then
    raise exception 'Caregiver not found';
  end if;

  if set_caregiver_compensation_rate.organization_service_id is not null
    and not exists (
      select 1 from public.organization_services
      where id = set_caregiver_compensation_rate.organization_service_id
        and organization_id = target_org_id
    ) then
    raise exception 'Organization service not found';
  end if;

  update public.caregiver_compensation_rates
  set
    effective_end_date = set_caregiver_compensation_rate.effective_start_date - 1,
    active = false
  where organization_id = target_org_id
    and caregiver_id = target_caregiver_id
    and active = true
    and caregiver_compensation_rates.organization_service_id
        is not distinct from set_caregiver_compensation_rate.organization_service_id;

  insert into public.caregiver_compensation_rates (
    organization_id,
    caregiver_id,
    organization_service_id,
    pay_rate,
    rate_unit,
    effective_start_date,
    approved_by_user_id,
    approved_at,
    active
  )
  values (
    target_org_id,
    target_caregiver_id,
    set_caregiver_compensation_rate.organization_service_id,
    set_caregiver_compensation_rate.pay_rate,
    set_caregiver_compensation_rate.rate_unit,
    set_caregiver_compensation_rate.effective_start_date,
    auth.uid(),
    now(),
    true
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.set_caregiver_compensation_rate(uuid, uuid, numeric, text, date, uuid) from public;
grant execute on function public.set_caregiver_compensation_rate(uuid, uuid, numeric, text, date, uuid) to authenticated;


-- ============================================================
-- 4. Mark expired credentials
-- ============================================================
-- Called opportunistically by the caregiver list so 'Expired' is never stale.

create or replace function public.mark_expired_credentials(target_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if not public.can_manage_org_caregivers(target_org_id) then
    raise exception 'Not authorized to manage caregivers for this organization';
  end if;

  update public.caregiver_credentials
  set
    status = 'Expired',
    updated_at = now()
  where organization_id = target_org_id
    and status = 'Active'
    and expiration_date is not null
    and expiration_date < current_date;

  get diagnostics updated_count = row_count;

  return updated_count;
end;
$$;

revoke all on function public.mark_expired_credentials(uuid) from public;
grant execute on function public.mark_expired_credentials(uuid) to authenticated;
