-- ============================================================
-- Migration: Authorization operations RPCs
-- Purpose:
-- - Transactionally create an authorization and its service rows
-- - Resolve authorization-service effective rates
-- - Allow schedulers to read authorization parents needed for shifts
-- - Authorization enforced via has_org_permission()
-- ============================================================

drop policy if exists "patient_authorizations: read with authorizations.manage"
  on public.patient_authorizations;

create policy "patient_authorizations: read with authorizations or shifts permission"
  on public.patient_authorizations for select to authenticated
  using (
    public.has_org_permission(organization_id, 'authorizations.manage')
    or public.has_org_permission(organization_id, 'shifts.manage')
  );

create or replace function public.can_manage_org_authorizations(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'authorizations.manage');
$$;

create or replace function public.can_read_org_authorizations(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_org_permission(org_id, 'authorizations.manage')
    or public.has_org_permission(org_id, 'shifts.manage');
$$;

create or replace function public.create_authorization_with_services(
  target_org_id uuid,
  target_patient_id uuid,
  target_payer_id uuid,
  authorization_start_date date,
  authorization_end_date date,
  status text default 'Active',
  prior_auth_number text default null,
  services jsonb default '[]'::jsonb
)
returns public.patient_authorizations
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.patient_authorizations;
  service_input jsonb;
  service_start_date date;
  service_end_date date;
begin
  if not public.can_manage_org_authorizations(target_org_id) then
    raise exception 'Not authorized to manage authorizations for this organization';
  end if;

  if authorization_end_date < authorization_start_date then
    raise exception 'Authorization end date must be on or after start date';
  end if;

  if status not in ('Active', 'Pending Recertification', 'Under Review', 'Suspended', 'Expired') then
    raise exception 'Invalid authorization status';
  end if;

  if jsonb_typeof(services) <> 'array' then
    raise exception 'Services must be an array';
  end if;

  if not exists (
    select 1 from public.patients
    where id = target_patient_id
      and organization_id = target_org_id
      and archived_at is null
  ) then
    raise exception 'Patient not found';
  end if;

  if not exists (
    select 1 from public.payers
    where id = target_payer_id
      and organization_id = target_org_id
  ) then
    raise exception 'Payer not found';
  end if;

  insert into public.patient_authorizations (
    organization_id,
    patient_id,
    payer_id,
    encrypted_prior_auth_number,
    masked_prior_auth_number,
    authorization_start_date,
    authorization_end_date,
    status,
    created_by_user_id
  )
  values (
    target_org_id,
    target_patient_id,
    target_payer_id,
    prior_auth_number,
    case
      when prior_auth_number is null or prior_auth_number = '' then null
      else '****' || right(prior_auth_number, 4)
    end,
    authorization_start_date,
    authorization_end_date,
    status,
    auth.uid()
  )
  returning * into result_row;

  for service_input in select value from jsonb_array_elements(services)
  loop
    service_start_date := coalesce((service_input ->> 'effective_start_date')::date, authorization_start_date);
    service_end_date := coalesce((service_input ->> 'effective_end_date')::date, authorization_end_date);

    if service_end_date < service_start_date then
      raise exception 'Service end date must be on or after start date';
    end if;

    if (service_input ->> 'authorized_quantity')::numeric <= 0 then
      raise exception 'Authorized quantity must be greater than zero';
    end if;

    if service_input ->> 'quantity_unit' not in ('Hours', 'Visits', 'Units')
      or service_input ->> 'quantity_period' not in ('Day', 'Week', 'Month', 'Authorization Period')
      or service_input ->> 'rate_unit' not in ('Hour', 'Visit', 'Unit') then
      raise exception 'Invalid authorization service values';
    end if;

    if not exists (
      select 1 from public.organization_services
      where id = (service_input ->> 'organization_service_id')::uuid
        and organization_id = target_org_id
        and enabled = true
    ) then
      raise exception 'Organization service not found or disabled';
    end if;

    insert into public.authorization_services (
      organization_id, authorization_id, organization_service_id,
      authorized_quantity, quantity_unit, quantity_period,
      reimbursement_rate, rate_unit, service_requirement_code,
      effective_start_date, effective_end_date
    )
    values (
      target_org_id, result_row.id, (service_input ->> 'organization_service_id')::uuid,
      (service_input ->> 'authorized_quantity')::numeric,
      service_input ->> 'quantity_unit', service_input ->> 'quantity_period',
      nullif(service_input ->> 'reimbursement_rate', '')::numeric,
      service_input ->> 'rate_unit', nullif(service_input ->> 'service_requirement_code', ''),
      service_start_date, service_end_date
    );
  end loop;

  return result_row;
end;
$$;

revoke all on function public.create_authorization_with_services(uuid, uuid, uuid, date, date, text, text, jsonb) from public;
grant execute on function public.create_authorization_with_services(uuid, uuid, uuid, date, date, text, text, jsonb) to authenticated;
