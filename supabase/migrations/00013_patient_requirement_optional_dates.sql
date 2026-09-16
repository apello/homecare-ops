-- ============================================================
-- Migration: Optional patient requirement dates
-- Purpose:
-- - Allow patient requirements without an effective start date
-- - Stop defaulting omitted start dates to the current date
-- ============================================================

alter table public.patient_requirements
  alter column effective_start_date drop not null;

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
  effective_start_date date default null,
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

  select id into existing_id
  from public.patient_requirements
  where organization_id = target_org_id
    and patient_id = target_patient_id
    and requirement_type = req_type
    and requirement_code = req_code
    and active = true
  limit 1;

  if existing_id is not null then
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

revoke all on function public.upsert_patient_requirement(
  uuid, uuid, text, text, text, text, jsonb, uuid, text, date, date
) from public;
grant execute on function public.upsert_patient_requirement(
  uuid, uuid, text, text, text, text, jsonb, uuid, text, date, date
) to authenticated;
