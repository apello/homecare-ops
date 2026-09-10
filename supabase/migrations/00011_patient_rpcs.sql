-- ============================================================
-- Migration: Patient operations RPCs
-- Purpose:
-- - Provide controlled RPC for creating patients with addresses
-- - Provide RPC for upserting patient requirements
-- - Authorization enforced via has_org_permission() (patients.manage)
-- ============================================================

-- Helper function to check if user can manage patients in org
create or replace function public.can_manage_org_patients(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'patients.manage');
$$;

-- Helper function to check if user can read basic patient data
create or replace function public.can_read_org_patients(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'patients.read_basic');
$$;

-- Helper function to check if user can read clinical patient data
create or replace function public.can_read_org_patients_clinical(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_org_permission(org_id, 'patients.read_clinical');
$$;

-- ============================================================
-- 1. Create patient with optional service address
-- ============================================================

create or replace function public.create_patient_with_address(
  target_org_id uuid,
  first_name text,
  last_name text,
  middle_name text default null,
  date_of_birth date default null,
  patient_external_id text default null,
  status text default 'Intake',
  address_line_1 text default null,
  address_line_2 text default null,
  city text default null,
  state text default null,
  zip_code text default null,
  latitude numeric default null,
  longitude numeric default null
)
returns public.patients
language plpgsql
security definer
set search_path = public
as $$
declare
  new_patient public.patients;
begin
  if not public.can_manage_org_patients(target_org_id) then
    raise exception 'Not authorized to manage patients for this organization';
  end if;

  if first_name is null or first_name = '' then
    raise exception 'First name is required';
  end if;

  if last_name is null or last_name = '' then
    raise exception 'Last name is required';
  end if;

  if status not in ('Intake', 'Active', 'Suspended', 'Discharged', 'Archived') then
    raise exception 'Invalid patient status';
  end if;

  -- Create patient
  insert into public.patients (
    organization_id,
    first_name,
    last_name,
    middle_name,
    date_of_birth,
    patient_external_id,
    status,
    created_by_user_id
  )
  values (
    target_org_id,
    first_name,
    last_name,
    middle_name,
    date_of_birth,
    patient_external_id,
    status,
    auth.uid()
  )
  returning * into new_patient;

  -- Create service address if provided
  if address_line_1 is not null then
    insert into public.patient_addresses (
      organization_id,
      patient_id,
      address_type,
      address_line_1,
      address_line_2,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      active
    )
    values (
      target_org_id,
      new_patient.id,
      'Service',
      address_line_1,
      address_line_2,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      true
    );
  end if;

  return new_patient;
end;
$$;

revoke all on function public.create_patient_with_address(uuid, text, text, text, date, text, text, text, text, text, text, text, numeric, numeric) from public;
grant execute on function public.create_patient_with_address(uuid, text, text, text, date, text, text, text, text, text, text, text, numeric, numeric) to authenticated;


-- ============================================================
-- 2. Upsert patient requirement
-- ============================================================
-- Ensures only one active requirement per type+code pair
-- Updates existing or inserts new

create or replace function public.upsert_patient_requirement(
  target_org_id uuid,
  target_patient_id uuid,
  req_type text,
  req_code text,
  matching_effect text,
  required_skill_code text default null,
  structured_value jsonb default null,
  restricted_note_id uuid default null,
  visibility_level text default 'Operational',
  effective_start_date date default current_date,
  effective_end_date date default null
)
returns public.patient_requirements
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.patient_requirements;
  existing_id uuid;
  valid_types text[] := array[
    'Skill', 'Language', 'Gender Preference', 'Travel',
    'Pets', 'Smoking', 'Lifting', 'Schedule', 'Other'
  ];
  valid_effects text[] := array['Required', 'Preferred', 'Review Required', 'Exclude'];
  valid_visibility text[] := array['Operational', 'Clinical', 'Restricted'];
begin
  if not public.can_manage_org_patients(target_org_id) then
    raise exception 'Not authorized to manage patients for this organization';
  end if;

  if not (req_type = any(valid_types)) then
    raise exception 'Invalid requirement type: %', req_type;
  end if;

  if not (matching_effect = any(valid_effects)) then
    raise exception 'Invalid matching effect: %', matching_effect;
  end if;

  if not (visibility_level = any(valid_visibility)) then
    raise exception 'Invalid visibility level: %', visibility_level;
  end if;

  -- Find existing active requirement for this type+code
  select id into existing_id
  from public.patient_requirements
  where organization_id = target_org_id
    and patient_id = target_patient_id
    and requirement_type = req_type
    and requirement_code = req_code
    and active = true
  limit 1;

  if existing_id is not null then
    -- Update existing
    update public.patient_requirements
    set
      matching_effect = upsert_patient_requirement.matching_effect,
      required_skill_code = upsert_patient_requirement.required_skill_code,
      structured_value = upsert_patient_requirement.structured_value,
      restricted_note_id = upsert_patient_requirement.restricted_note_id,
      visibility_level = upsert_patient_requirement.visibility_level,
      effective_start_date = upsert_patient_requirement.effective_start_date,
      effective_end_date = upsert_patient_requirement.effective_end_date,
      updated_at = now()
    where id = existing_id
    returning * into result;
  else
    -- Insert new
    insert into public.patient_requirements (
      organization_id,
      patient_id,
      requirement_type,
      requirement_code,
      matching_effect,
      required_skill_code,
      structured_value,
      restricted_note_id,
      visibility_level,
      effective_start_date,
      effective_end_date,
      active
    )
    values (
      target_org_id,
      target_patient_id,
      req_type,
      req_code,
      upsert_patient_requirement.matching_effect,
      upsert_patient_requirement.required_skill_code,
      upsert_patient_requirement.structured_value,
      upsert_patient_requirement.restricted_note_id,
      upsert_patient_requirement.visibility_level,
      upsert_patient_requirement.effective_start_date,
      upsert_patient_requirement.effective_end_date,
      true
    )
    returning * into result;
  end if;

  return result;
end;
$$;

revoke all on function public.upsert_patient_requirement(uuid, uuid, text, text, text, text, jsonb, uuid, text, date, date) from public;
grant execute on function public.upsert_patient_requirement(uuid, uuid, text, text, text, text, jsonb, uuid, text, date, date) to authenticated;


-- ============================================================
-- 3. List visible patient requirements filtered by visibility level
-- ============================================================

create or replace function public.list_patient_requirements_by_visibility(
  target_org_id uuid,
  target_patient_id uuid,
  target_visibility text default 'Operational'
)
returns table (
  id uuid,
  organization_id uuid,
  patient_id uuid,
  requirement_type text,
  requirement_code text,
  matching_effect text,
  required_skill_code text,
  structured_value jsonb,
  restricted_note_id uuid,
  visibility_level text,
  effective_start_date date,
  effective_end_date date,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.organization_id,
    r.patient_id,
    r.requirement_type,
    r.requirement_code,
    r.matching_effect,
    r.required_skill_code,
    r.structured_value,
    r.restricted_note_id,
    r.visibility_level,
    r.effective_start_date,
    r.effective_end_date,
    r.active,
    r.created_at,
    r.updated_at
  from public.patient_requirements r
  where r.organization_id = target_org_id
    and r.patient_id = target_patient_id
    and r.active = true
    and (
      (target_visibility = 'Operational' and r.visibility_level = 'Operational')
      or
      (target_visibility = 'Clinical' and r.visibility_level in ('Operational', 'Clinical'))
      or
      (target_visibility = 'Restricted' and r.visibility_level in ('Operational', 'Clinical', 'Restricted'))
    )
  order by r.created_at asc;
$$;

revoke all on function public.list_patient_requirements_by_visibility(uuid, uuid, text) from public;
grant execute on function public.list_patient_requirements_by_visibility(uuid, uuid, text) to authenticated;
