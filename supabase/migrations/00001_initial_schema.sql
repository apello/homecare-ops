-- ============================================================
-- Home Healthcare Operations Platform
-- PostgreSQL / Supabase Schema + RLS
-- Source: schema-model.pdf + rls-plan
-- ============================================================


-- ============================================================
-- SECTION 1: EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- SECTION 2: IDENTITY AND ACCESS TABLES
-- (Helper functions follow in Section 3 — they reference these tables
--  and must be created after them.)
-- ============================================================

create table organizations (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  status       text        not null default 'Active'
                           check (status in ('Active', 'Suspended', 'Archived')),
  timezone     text        not null,
  data_region  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  archived_at  timestamptz
);

create table user_profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  first_name          text        not null,
  last_name           text        not null,
  phone               text,
  access_status       text        not null default 'Pending'
                                  check (access_status in ('Active', 'Disabled', 'Pending')),
  last_login_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  disabled_at         timestamptz,
  disabled_by_user_id uuid        references user_profiles(id)
);

-- Platform-level roles. Having one of these does NOT grant access to agency records.
create table platform_user_roles (
  user_id    uuid        not null references user_profiles(id) on delete cascade,
  role       text        not null check (role in ('Platform Administrator', 'Technical Support')),
  status     text        not null default 'Active' check (status in ('Active', 'Disabled')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table organization_memberships (
  id                    uuid        primary key default gen_random_uuid(),
  organization_id       uuid        not null references organizations(id) on delete restrict,
  user_id               uuid        not null references user_profiles(id) on delete restrict,
  role                  text        not null check (role in (
                                      'Agency Administrator',
                                      'Scheduler',
                                      'Clinical Manager',
                                      'HR Coordinator',
                                      'Compliance Administrator'
                                    )),
  status                text        not null default 'Active'
                                    check (status in ('Active', 'Suspended', 'Revoked')),
  joined_at             timestamptz not null default now(),
  disabled_at           timestamptz,
  disabled_by_user_id   uuid        references user_profiles(id),
  last_access_review_at timestamptz,
  unique (organization_id, user_id)
);

-- Role-level permission defaults. Policies delegate to has_org_permission() which reads this table.
create table role_permission_defaults (
  id              uuid        primary key default gen_random_uuid(),
  role            text        not null,
  permission_code text        not null,
  enabled         boolean     not null default true,
  created_at      timestamptz not null default now(),
  unique (role, permission_code)
);

-- Explicit per-membership permission overrides (grants beyond the default role).
create table membership_permission_grants (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null references organizations(id) on delete restrict,
  membership_id       uuid        not null references organization_memberships(id) on delete cascade,
  permission_code     text        not null,
  reason              text,
  granted_by_user_id  uuid        not null references user_profiles(id),
  granted_at          timestamptz not null default now(),
  expires_at          timestamptz,
  revoked_at          timestamptz
);


-- ============================================================
-- SECTION 3: RLS HELPER FUNCTIONS
-- Defined after identity/access tables because LANGUAGE sql functions
-- are validated at creation time — referenced tables must already exist.
-- ============================================================

-- Returns true if the current user has any active membership in the org.
create or replace function is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = org_id
      and user_id          = auth.uid()
      and status           = 'Active'
  );
$$;

-- Returns true if the current user is an active Agency Administrator in the org.
create or replace function is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships
    where organization_id = org_id
      and user_id          = auth.uid()
      and role             = 'Agency Administrator'
      and status           = 'Active'
  );
$$;

-- Returns true if the current user has the given permission in the org,
-- either through their role default or an explicit non-expired, non-revoked grant.
create or replace function has_org_permission(org_id uuid, perm_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_memberships m
    where m.organization_id = org_id
      and m.user_id          = auth.uid()
      and m.status           = 'Active'
      and (
        exists (
          select 1
          from role_permission_defaults d
          where d.role             = m.role
            and d.permission_code  = perm_code
            and d.enabled          = true
        )
        or
        exists (
          select 1
          from membership_permission_grants g
          where g.membership_id   = m.id
            and g.organization_id = org_id
            and g.permission_code = perm_code
            and g.revoked_at      is null
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;


-- ============================================================
-- SECTION 4: PLATFORM-GLOBAL REFERENCE TABLES
-- No organization_id. Managed by service_role only.
-- ============================================================

create table billing_services (
  id                   uuid        primary key default gen_random_uuid(),
  billing_code         text        not null,
  code_match_type      text        not null check (code_match_type in ('Exact', 'Prefix')),
  service_name         text        not null,
  service_category     text        not null check (service_category in (
                                     'Aide', 'Nursing', 'Assessment', 'Personal Care', 'Homemaker', 'Other'
                                   )),
  default_unit_type    text        not null check (default_unit_type in ('Hour', 'Visit', 'Unit')),
  effective_start_date date        not null,
  effective_end_date   date,
  active               boolean     not null default true,
  source               text        not null,
  version              text        not null,
  approved_by_user_id  uuid        references user_profiles(id),
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  unique (billing_code, version)
);

create table service_code_mappings (
  id                   uuid        primary key default gen_random_uuid(),
  billing_service_id   uuid        not null references billing_services(id) on delete restrict,
  evv_service_id       text        not null,
  evv_service_name     text        not null,
  payer_type           text        not null,
  program_name         text,
  effective_start_date date        not null,
  effective_end_date   date,
  active               boolean     not null default true,
  source               text        not null,
  version              text        not null,
  approved_by_user_id  uuid        references user_profiles(id),
  approved_at          timestamptz,
  created_at           timestamptz not null default now()
);

-- Stores versioned matching algorithm configurations.
create table matching_rulesets (
  id                 uuid        primary key default gen_random_uuid(),
  ruleset_key        text        not null,
  version            text        not null,
  description        text,
  configuration      jsonb       not null default '{}',
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  created_by_user_id uuid        references user_profiles(id),
  unique (ruleset_key, version)
);

-- Controlled notification templates. Prevents free-text PHI from entering outreach messages.
create table notification_templates (
  id                         uuid        primary key default gen_random_uuid(),
  template_key               text        not null,
  notification_type          text        not null,
  channel                    text        not null check (channel in ('In-App', 'Email', 'SMS', 'Phone', 'Other')),
  audience                   text        not null check (audience in ('Internal Staff', 'Caregiver', 'Administrator')),
  allowed_variables          text[],
  sensitivity_classification text        not null default 'General'
                                         check (sensitivity_classification in ('General', 'Operational', 'Restricted')),
  active                     boolean     not null default true,
  version                    text        not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz,
  unique (template_key, version)
);


-- ============================================================
-- SECTION 5: PATIENT TABLES
-- ============================================================

create table patients (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null references organizations(id) on delete restrict,
  patient_external_id text,
  first_name          text        not null,
  middle_name         text,
  last_name           text        not null,
  date_of_birth       date,
  status              text        not null default 'Intake'
                                  check (status in ('Intake', 'Active', 'Suspended', 'Discharged', 'Archived')),
  created_at          timestamptz not null default now(),
  created_by_user_id  uuid        not null references user_profiles(id),
  updated_at          timestamptz,
  updated_by_user_id  uuid        references user_profiles(id),
  archived_at         timestamptz,
  -- Composite key required for child table composite FK references.
  unique (organization_id, id)
);

-- Partial index: enforces uniqueness of external ID per org only when set.
create unique index patients_org_external_id_idx
  on patients(organization_id, patient_external_id)
  where patient_external_id is not null;

create table patient_addresses (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null,
  patient_id         uuid        not null,
  address_type       text        not null check (address_type in ('Service', 'Mailing', 'Other')),
  address_line_1     text        not null,
  address_line_2     text,
  city               text        not null,
  state              text        not null,
  zip_code           text        not null,
  latitude           numeric(9,6),
  longitude          numeric(9,6),
  location_hash      text,
  geocoding_provider text,
  geocoded_at        timestamptz,
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);

create table patient_contacts (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null,
  patient_id         uuid        not null,
  contact_type       text        not null,
  contact_name       text        not null,
  relationship       text,
  phone              text,
  email              text,
  authorized_contact boolean     not null default false,
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  archived_at        timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);

-- visibility_level gates clinical/restricted rows behind patients.read_clinical permission.
create table patient_requirements (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null,
  patient_id           uuid        not null,
  requirement_type     text        not null check (requirement_type in (
                                     'Skill', 'Language', 'Gender Preference', 'Travel',
                                     'Pets', 'Smoking', 'Lifting', 'Schedule', 'Other'
                                   )),
  requirement_code     text        not null,
  matching_effect      text        not null check (matching_effect in (
                                     'Required', 'Preferred', 'Review Required', 'Exclude'
                                   )),
  required_skill_code  text,
  structured_value     jsonb,
  restricted_note_id   uuid,
  visibility_level     text        not null default 'Operational'
                                   check (visibility_level in ('Operational', 'Clinical', 'Restricted')),
  effective_start_date date        not null,
  effective_end_date   date,
  active               boolean     not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict
);


-- ============================================================
-- SECTION 6: AUTHORIZATION AND SERVICE TABLES
-- ============================================================

create table payers (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null references organizations(id) on delete restrict,
  payer_name      text        not null,
  payer_type      text        not null check (payer_type in (
                                'Medicare', 'Medicaid', 'Waiver', 'Managed Care', 'Private Pay', 'Other'
                              )),
  program_name    text,
  status          text        not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  unique (organization_id, id)
);

-- Agency-activated service definitions with local overrides.
create table organization_services (
  id                         uuid        primary key default gen_random_uuid(),
  organization_id            uuid        not null references organizations(id) on delete restrict,
  service_code_mapping_id    uuid        not null references service_code_mappings(id) on delete restrict,
  local_service_name         text,
  default_reimbursement_rate numeric(10,2),
  default_rate_unit          text        not null default 'Hour'
                                         check (default_rate_unit in ('Hour', 'Visit', 'Unit')),
  requires_clinical_approval boolean     not null default false,
  enabled                    boolean     not null default true,
  created_at                 timestamptz not null default now(),
  created_by_user_id         uuid        not null references user_profiles(id),
  updated_at                 timestamptz,
  updated_by_user_id         uuid        references user_profiles(id),
  unique (organization_id, id),
  unique (organization_id, service_code_mapping_id)
);

create table patient_authorizations (
  id                          uuid        primary key default gen_random_uuid(),
  organization_id             uuid        not null,
  patient_id                  uuid        not null,
  payer_id                    uuid        not null,
  encrypted_prior_auth_number text,
  masked_prior_auth_number    text,
  authorization_start_date    date        not null,
  authorization_end_date      date        not null,
  status                      text        not null default 'Active' check (status in (
                                            'Active', 'Pending Recertification', 'Under Review', 'Suspended', 'Expired'
                                          )),
  retention_category          text,
  created_at                  timestamptz not null default now(),
  created_by_user_id          uuid        not null references user_profiles(id),
  updated_at                  timestamptz,
  updated_by_user_id          uuid        references user_profiles(id),
  archived_at                 timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, patient_id) references patients(organization_id, id) on delete restrict,
  foreign key (organization_id, payer_id)   references payers(organization_id, id)   on delete restrict
);

-- Authorized services and approved reimbursement rates per authorization.
create table authorization_services (
  id                       uuid          primary key default gen_random_uuid(),
  organization_id          uuid          not null,
  authorization_id         uuid          not null,
  organization_service_id  uuid          not null,
  authorized_quantity      numeric(10,2) not null,
  quantity_unit            text          not null check (quantity_unit in ('Hours', 'Visits', 'Units')),
  quantity_period          text          not null check (quantity_period in (
                                           'Day', 'Week', 'Month', 'Authorization Period'
                                         )),
  reimbursement_rate       numeric(10,2),
  rate_unit                text          not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  service_requirement_code text,
  restricted_note_id       uuid,
  effective_start_date     date          not null,
  effective_end_date       date          not null,
  active                   boolean       not null default true,
  created_at               timestamptz   not null default now(),
  updated_at               timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, authorization_id)
    references patient_authorizations(organization_id, id) on delete restrict,
  foreign key (organization_id, organization_service_id)
    references organization_services(organization_id, id) on delete restrict
);


-- ============================================================
-- SECTION 7: CAREGIVER TABLES
-- ============================================================

create table caregivers (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null references organizations(id) on delete restrict,
  employee_external_id text,
  first_name           text        not null,
  last_name            text        not null,
  email                text,
  phone                text,
  classification       text        not null check (classification in ('RN', 'LPN', 'HHA', 'STNA')),
  employment_status    text        not null default 'Active' check (employment_status in (
                                     'Active', 'Inactive', 'Suspended', 'Terminated'
                                   )),
  max_hours_per_week   numeric(5,2),
  service_area_zip     text,
  travel_radius_miles  numeric(6,2),
  matching_status      text        not null default 'Active'
                                   check (matching_status in ('Active', 'Inactive', 'Suspended')),
  created_at           timestamptz not null default now(),
  created_by_user_id   uuid        not null references user_profiles(id),
  updated_at           timestamptz,
  updated_by_user_id   uuid        references user_profiles(id),
  archived_at          timestamptz,
  unique (organization_id, id)
);

create unique index caregivers_org_employee_id_idx
  on caregivers(organization_id, employee_external_id)
  where employee_external_id is not null;

-- Sensitive pay rate data. Requires caregivers.read_compensation permission to read.
create table caregiver_compensation_rates (
  id                      uuid          primary key default gen_random_uuid(),
  organization_id         uuid          not null,
  caregiver_id            uuid          not null,
  organization_service_id uuid,
  pay_rate                numeric(10,2) not null,
  rate_unit               text          not null check (rate_unit in ('Hour', 'Visit', 'Unit')),
  effective_start_date    date          not null,
  effective_end_date      date,
  approved_by_user_id     uuid          not null references user_profiles(id),
  approved_at             timestamptz   not null,
  active                  boolean       not null default true,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_credentials (
  id                          uuid        primary key default gen_random_uuid(),
  organization_id             uuid        not null,
  caregiver_id                uuid        not null,
  credential_type             text        not null,
  credential_name             text        not null,
  encrypted_credential_number text,
  issued_date                 date,
  expiration_date             date,
  status                      text        not null default 'Active'
                                          check (status in ('Active', 'Expired', 'Pending', 'Revoked')),
  verified_by_user_id         uuid        references user_profiles(id),
  verified_at                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_service_eligibility (
  id                      uuid        primary key default gen_random_uuid(),
  organization_id         uuid        not null,
  caregiver_id            uuid        not null,
  organization_service_id uuid        not null,
  supervision_required    boolean     not null default false,
  approved_by_user_id     uuid        not null references user_profiles(id),
  approved_at             timestamptz not null,
  active                  boolean     not null default true,
  foreign key (organization_id, caregiver_id)
    references caregivers(organization_id, id) on delete restrict,
  foreign key (organization_id, organization_service_id)
    references organization_services(organization_id, id) on delete restrict
);

create table caregiver_skills (
  id              uuid        primary key default gen_random_uuid(),
  organization_id uuid        not null,
  caregiver_id    uuid        not null,
  skill_code      text        not null,
  skill_name      text        not null,
  verified_at     timestamptz,
  expires_at      timestamptz,
  active          boolean     not null default true,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

-- Recurring weekly availability windows.
create table caregiver_availability (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null,
  caregiver_id         uuid        not null,
  day_of_week          smallint    not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time           time        not null,
  end_time             time        not null,
  availability_status  text        not null check (availability_status in ('Available', 'Unavailable', 'Preferred')),
  effective_start_date date        not null,
  effective_end_date   date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

-- One-time overrides (time off, special availability blocks).
create table caregiver_availability_exceptions (
  id                  uuid        primary key default gen_random_uuid(),
  organization_id     uuid        not null,
  caregiver_id        uuid        not null,
  exception_date      date        not null,
  start_time          time,
  end_time            time,
  availability_status text        not null check (availability_status in ('Available', 'Unavailable')),
  reason_code         text,
  created_at          timestamptz not null default now(),
  created_by_user_id  uuid        not null references user_profiles(id),
  updated_at          timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);

create table caregiver_constraints (
  id                 uuid        primary key default gen_random_uuid(),
  organization_id    uuid        not null,
  caregiver_id       uuid        not null,
  constraint_type    text        not null,
  structured_value   jsonb       not null default '{}',
  matching_effect    text        not null check (matching_effect in ('Exclude', 'Review Required', 'Preference')),
  restricted_note_id uuid,
  active             boolean     not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  foreign key (organization_id, caregiver_id) references caregivers(organization_id, id) on delete restrict
);


-- ============================================================
-- SECTION 8: SCHEDULING AND MATCHING TABLES
-- ============================================================

create table shifts (
  id                              uuid        primary key default gen_random_uuid(),
  organization_id                 uuid        not null,
  patient_id                      uuid        not null,
  authorization_service_id        uuid        not null,
  assigned_caregiver_id           uuid,
  start_datetime                  timestamptz not null,
  end_datetime                    timestamptz not null,
  visit_type                      text        not null,
  status                          text        not null default 'Open' check (status in (
                                                'Open', 'Assigned', 'Replacement Needed',
                                                'Covered', 'Uncovered', 'Completed', 'Cancelled'
                                              )),
  coverage_status                 text        not null default 'Open' check (coverage_status in (
                                                'Open', 'Assigned', 'Call-Off Reported',
                                                'Replacement Pending', 'Covered', 'Uncovered', 'Cancelled'
                                              )),
  assignment_confirmed_by_user_id uuid        references user_profiles(id),
  assignment_confirmed_at         timestamptz,
  version                         integer     not null default 1,
  created_at                      timestamptz not null default now(),
  created_by_user_id              uuid        not null references user_profiles(id),
  updated_at                      timestamptz,
  updated_by_user_id              uuid        references user_profiles(id),
  archived_at                     timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, patient_id)
    references patients(organization_id, id) on delete restrict,
  foreign key (organization_id, authorization_service_id)
    references authorization_services(organization_id, id) on delete restrict
);

-- Immutable assignment audit trail. INSERT via service_role only; no UPDATE or DELETE.
create table shift_assignment_history (
  id                    uuid        primary key default gen_random_uuid(),
  organization_id       uuid        not null,
  shift_id              uuid        not null,
  previous_caregiver_id uuid,
  new_caregiver_id      uuid,
  change_type           text        not null check (change_type in (
                                      'Assigned', 'Reassigned', 'Call-Off', 'Replacement', 'Cancelled'
                                    )),
  reason_code           text,
  changed_by_user_id    uuid        not null references user_profiles(id),
  changed_at            timestamptz not null default now(),
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

create table matching_runs (
  id                       uuid        primary key default gen_random_uuid(),
  organization_id          uuid        not null,
  patient_id               uuid        not null,
  shift_id                 uuid        not null,
  authorization_service_id uuid        not null,
  call_off_id              uuid,
  initiated_by_user_id     uuid        not null references user_profiles(id),
  ruleset_version          text        not null,
  status                   text        not null default 'Started' check (status in (
                                         'Started', 'Completed', 'Failed', 'Expired'
                                       )),
  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  expires_at               timestamptz,
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

-- Handles both standard and call-off replacement candidates.
-- Do not duplicate diagnoses, addresses, auth numbers, or compensation details here.
create table matching_candidates (
  id                    uuid          primary key default gen_random_uuid(),
  organization_id       uuid          not null,
  matching_run_id       uuid          not null references matching_runs(id) on delete cascade,
  caregiver_id          uuid          not null,
  score                 numeric(6,4)  not null,
  recommendation_status text          not null check (recommendation_status in (
                                        'Recommended', 'Review Required', 'Excluded'
                                      )),
  score_components      jsonb,
  explanation_codes     text[],
  review_flags          text[],
  outreach_status       text          check (outreach_status in (
                                        'Not Contacted', 'Contacted', 'Notification Sent', 'Notification Failed'
                                      )),
  response_status       text          check (response_status in (
                                        'Pending', 'Interested', 'Accepted', 'Declined',
                                        'No Response', 'Withdrawn', 'Selected'
                                      )),
  contacted_at          timestamptz,
  responded_at          timestamptz,
  selected_at           timestamptz,
  selected_by_user_id   uuid          references user_profiles(id)
);


-- ============================================================
-- SECTION 9: CALL-OFF TABLES
-- ============================================================

create table call_offs (
  id                        uuid        primary key default gen_random_uuid(),
  organization_id           uuid        not null,
  shift_id                  uuid        not null,
  original_caregiver_id     uuid        not null,
  reported_by_user_id       uuid        not null references user_profiles(id),
  reported_at               timestamptz not null default now(),
  report_source             text        not null check (report_source in (
                                          'Phone', 'Text', 'Email', 'Internal', 'Other'
                                        )),
  reason_code               text        not null check (reason_code in (
                                          'Illness', 'Emergency', 'Transportation',
                                          'Schedule Conflict', 'No Call / No Show', 'Other'
                                        )),
  restricted_reason_note_id uuid,
  status                    text        not null default 'Reported' check (status in (
                                          'Reported', 'Replacement Needed', 'Candidates Available',
                                          'Outreach In Progress', 'Pending Confirmation',
                                          'Resolved', 'Unresolved', 'Cancelled'
                                        )),
  replacement_caregiver_id  uuid,
  resolved_by_user_id       uuid        references user_profiles(id),
  resolved_at               timestamptz,
  resolution_type           text        check (resolution_type in (
                                          'Covered', 'Missed', 'Delayed', 'Shortened', 'Cancelled', 'Other'
                                        )),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, shift_id) references shifts(organization_id, id) on delete restrict
);

-- Immutable outreach log per call-off. No UPDATE or DELETE.
create table call_off_outreach_events (
  id                    uuid        primary key default gen_random_uuid(),
  organization_id       uuid        not null,
  call_off_id           uuid        not null,
  matching_candidate_id uuid        references matching_candidates(id),
  caregiver_id          uuid        not null,
  contact_method        text        not null check (contact_method in ('Phone', 'Text', 'Email', 'Other')),
  outreach_status       text        not null check (outreach_status in (
                                      'Contacted', 'No Answer', 'Message Left', 'Notification Sent', 'Failed'
                                    )),
  response_status       text        not null default 'Pending' check (response_status in (
                                      'Pending', 'Interested', 'Accepted', 'Declined', 'No Response'
                                    )),
  contacted_by_user_id  uuid        not null references user_profiles(id),
  contacted_at          timestamptz not null default now(),
  responded_at          timestamptz,
  restricted_note_id    uuid,
  created_at            timestamptz not null default now(),
  foreign key (organization_id, call_off_id) references call_offs(organization_id, id) on delete restrict
);


-- ============================================================
-- SECTION 10: NOTIFICATION TABLES
-- ============================================================

-- Stores delivery metadata only. Message content must not include unrestricted PHI.
create table notifications (
  id                         uuid        primary key default gen_random_uuid(),
  organization_id            uuid        not null references organizations(id) on delete restrict,
  template_id                uuid        not null references notification_templates(id),
  recipient_user_id          uuid        references user_profiles(id),
  recipient_caregiver_id     uuid,
  channel                    text        not null,
  notification_type          text        not null,
  sensitivity_classification text        not null,
  contains_phi               boolean     not null default false,
  idempotency_key            text,
  provider_message_id        text,
  delivery_status            text        not null default 'Pending' check (delivery_status in (
                                           'Pending', 'Sent', 'Delivered', 'Failed', 'Cancelled'
                                         )),
  delivery_failure_reason_code text,
  approved_by_policy_version text,
  sent_at                    timestamptz,
  created_at                 timestamptz not null default now()
);


-- ============================================================
-- SECTION 11: DISTANCE AND TRAVEL TABLES
-- ============================================================

-- Keyed by hashed location pairs, not raw addresses.
create table travel_result_cache (
  id                        uuid        primary key default gen_random_uuid(),
  organization_id           uuid        not null references organizations(id) on delete restrict,
  origin_location_hash      text        not null,
  destination_location_hash text        not null,
  travel_mode               text        not null,
  service_date              date,
  distance_meters           integer,
  travel_duration_seconds   integer,
  provider                  text        not null,
  calculated_at             timestamptz not null,
  expires_at                timestamptz not null,
  created_at                timestamptz not null default now()
);


-- ============================================================
-- SECTION 12: OPERATIONAL HISTORY TABLES
-- ============================================================

-- Basic MVP activity log for workflow review and dashboard metrics.
-- This is NOT formal HIPAA audit logging (use audit_events in production-readiness phase).
-- Store non-sensitive metadata only — no patient names, addresses, auth numbers,
-- diagnoses, compensation values, or notification content.
create table operational_history_events (
  id                   uuid        primary key default gen_random_uuid(),
  organization_id      uuid        not null references organizations(id) on delete restrict,
  actor_user_id        uuid        references user_profiles(id),
  action_type          text        not null,
  resource_type        text        not null,
  resource_id          uuid        not null,
  related_patient_id   uuid,
  related_caregiver_id uuid,
  related_shift_id     uuid,
  related_call_off_id  uuid,
  status               text        not null check (status in ('Success', 'Failed', 'Blocked', 'Cancelled')),
  summary_code         text,
  metadata             jsonb,
  request_id           text,
  occurred_at          timestamptz not null,
  created_at           timestamptz not null default now()
);


-- ============================================================
-- SECTION 13: INDEXES
-- ============================================================

-- organization_memberships
create index org_memberships_user_idx     on organization_memberships(user_id);
create index org_memberships_org_idx      on organization_memberships(organization_id, status);

-- membership_permission_grants
create index perm_grants_membership_idx   on membership_permission_grants(membership_id);

-- patients
create index patients_org_status_idx      on patients(organization_id, status);

-- patient_addresses / contacts / requirements
create index pat_addresses_patient_idx    on patient_addresses(organization_id, patient_id);
create index pat_contacts_patient_idx     on patient_contacts(organization_id, patient_id);
create index pat_requirements_patient_idx on patient_requirements(organization_id, patient_id, visibility_level);

-- patient_authorizations
create index pat_auth_org_patient_idx     on patient_authorizations(organization_id, patient_id, status);

-- authorization_services
create index auth_svc_auth_idx            on authorization_services(organization_id, authorization_id);

-- caregivers
create index caregivers_org_status_idx    on caregivers(organization_id, matching_status, employment_status);

-- caregiver sub-tables
create index cg_comp_caregiver_idx        on caregiver_compensation_rates(organization_id, caregiver_id);
create index cg_creds_caregiver_idx       on caregiver_credentials(organization_id, caregiver_id);
create index cg_svc_elig_caregiver_idx    on caregiver_service_eligibility(organization_id, caregiver_id);
create index cg_skills_caregiver_idx      on caregiver_skills(organization_id, caregiver_id);
create index cg_avail_caregiver_idx       on caregiver_availability(organization_id, caregiver_id);
create index cg_avail_exc_caregiver_idx   on caregiver_availability_exceptions(organization_id, caregiver_id, exception_date);
create index cg_constraints_caregiver_idx on caregiver_constraints(organization_id, caregiver_id);

-- shifts
create index shifts_org_datetime_idx      on shifts(organization_id, start_datetime, status);
create index shifts_org_patient_idx       on shifts(organization_id, patient_id);
create index shifts_org_caregiver_idx     on shifts(organization_id, assigned_caregiver_id);

-- matching
create index matching_runs_shift_idx      on matching_runs(organization_id, shift_id);
create index matching_cands_run_idx       on matching_candidates(matching_run_id);
create index matching_cands_caregiver_idx on matching_candidates(organization_id, caregiver_id);

-- call_offs
create index call_offs_shift_idx          on call_offs(organization_id, shift_id, status);
create index call_off_events_calloff_idx  on call_off_outreach_events(organization_id, call_off_id);

-- notifications
create index notifications_org_idx        on notifications(organization_id, delivery_status);
create index notifications_recipient_idx  on notifications(recipient_user_id);

-- travel cache
create index travel_cache_lookup_idx      on travel_result_cache(
  organization_id, origin_location_hash, destination_location_hash, travel_mode, service_date
);

-- operational history
create index op_history_org_time_idx      on operational_history_events(organization_id, occurred_at desc);
create index op_history_resource_idx      on operational_history_events(resource_type, resource_id);


-- ============================================================
-- SECTION 14: ROW LEVEL SECURITY
-- ============================================================
-- service_role bypasses RLS by default in Supabase.
-- anon role receives no policies and is denied everything.
-- All policies below apply to the authenticated role.
-- ============================================================

alter table organizations                    enable row level security;
alter table user_profiles                    enable row level security;
alter table platform_user_roles              enable row level security;
alter table organization_memberships         enable row level security;
alter table role_permission_defaults         enable row level security;
alter table membership_permission_grants     enable row level security;
alter table billing_services                 enable row level security;
alter table service_code_mappings            enable row level security;
alter table matching_rulesets                enable row level security;
alter table notification_templates           enable row level security;
alter table patients                         enable row level security;
alter table patient_addresses                enable row level security;
alter table patient_contacts                 enable row level security;
alter table patient_requirements             enable row level security;
alter table payers                           enable row level security;
alter table organization_services            enable row level security;
alter table patient_authorizations           enable row level security;
alter table authorization_services           enable row level security;
alter table caregivers                       enable row level security;
alter table caregiver_compensation_rates     enable row level security;
alter table caregiver_credentials            enable row level security;
alter table caregiver_service_eligibility    enable row level security;
alter table caregiver_skills                 enable row level security;
alter table caregiver_availability           enable row level security;
alter table caregiver_availability_exceptions enable row level security;
alter table caregiver_constraints            enable row level security;
alter table shifts                           enable row level security;
alter table shift_assignment_history         enable row level security;
alter table matching_runs                    enable row level security;
alter table matching_candidates              enable row level security;
alter table call_offs                        enable row level security;
alter table call_off_outreach_events         enable row level security;
alter table notifications                    enable row level security;
alter table travel_result_cache              enable row level security;
alter table operational_history_events       enable row level security;

-- ------------------------------------------------------------
-- organizations
-- ------------------------------------------------------------

create policy "organizations: members read their org"
  on organizations for select to authenticated
  using (is_org_member(id));

-- ------------------------------------------------------------
-- user_profiles
-- ------------------------------------------------------------

create policy "user_profiles: read own profile"
  on user_profiles for select to authenticated
  using (id = auth.uid());

create policy "user_profiles: read co-member profiles"
  on user_profiles for select to authenticated
  using (
    exists (
      select 1
      from organization_memberships m1
      join organization_memberships m2
        on m1.organization_id = m2.organization_id
       and m1.status = 'Active'
       and m2.status = 'Active'
      where m1.user_id = auth.uid()
        and m2.user_id = user_profiles.id
    )
  );

create policy "user_profiles: update own profile"
  on user_profiles for update to authenticated
  using   (id = auth.uid())
  with check (id = auth.uid());

-- INSERT handled by service_role trigger on auth.users.

-- ------------------------------------------------------------
-- platform_user_roles
-- ------------------------------------------------------------

create policy "platform_user_roles: read own entry"
  on platform_user_roles for select to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated users.

-- ------------------------------------------------------------
-- organization_memberships
-- ------------------------------------------------------------

create policy "org_memberships: members read roster"
  on organization_memberships for select to authenticated
  using (is_org_member(organization_id));

create policy "org_memberships: admin insert"
  on organization_memberships for insert to authenticated
  with check (is_org_admin(organization_id));

create policy "org_memberships: admin update"
  on organization_memberships for update to authenticated
  using   (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- No DELETE — use status = 'Revoked'.

-- ------------------------------------------------------------
-- role_permission_defaults
-- ------------------------------------------------------------

create policy "role_permission_defaults: authenticated read all"
  on role_permission_defaults for select to authenticated
  using (true);

-- ------------------------------------------------------------
-- membership_permission_grants
-- ------------------------------------------------------------

create policy "permission_grants: admin read"
  on membership_permission_grants for select to authenticated
  using (is_org_admin(organization_id));

create policy "permission_grants: admin insert"
  on membership_permission_grants for insert to authenticated
  with check (is_org_admin(organization_id));

create policy "permission_grants: admin update (revoke)"
  on membership_permission_grants for update to authenticated
  using   (is_org_admin(organization_id))
  with check (is_org_admin(organization_id));

-- ------------------------------------------------------------
-- billing_services (platform-global, read-only for users)
-- ------------------------------------------------------------

create policy "billing_services: read active records"
  on billing_services for select to authenticated
  using (active = true);

-- ------------------------------------------------------------
-- service_code_mappings (platform-global, read-only for users)
-- ------------------------------------------------------------

create policy "service_code_mappings: read active records"
  on service_code_mappings for select to authenticated
  using (active = true);

-- ------------------------------------------------------------
-- matching_rulesets (platform-global, read-only for users)
-- ------------------------------------------------------------

create policy "matching_rulesets: read active records"
  on matching_rulesets for select to authenticated
  using (active = true);

-- ------------------------------------------------------------
-- notification_templates (platform-global, read-only for users)
-- ------------------------------------------------------------

create policy "notification_templates: read active records"
  on notification_templates for select to authenticated
  using (active = true);

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------

create policy "patients: read with patients.read_basic"
  on patients for select to authenticated
  using (has_org_permission(organization_id, 'patients.read_basic'));

create policy "patients: insert with patients.manage"
  on patients for insert to authenticated
  with check (has_org_permission(organization_id, 'patients.manage'));

create policy "patients: update with patients.manage"
  on patients for update to authenticated
  using   (has_org_permission(organization_id, 'patients.manage'))
  with check (has_org_permission(organization_id, 'patients.manage'));

-- No DELETE — use archived_at.

-- ------------------------------------------------------------
-- patient_addresses
-- ------------------------------------------------------------

create policy "patient_addresses: read with patients.read_basic"
  on patient_addresses for select to authenticated
  using (has_org_permission(organization_id, 'patients.read_basic'));

create policy "patient_addresses: insert with patients.manage"
  on patient_addresses for insert to authenticated
  with check (has_org_permission(organization_id, 'patients.manage'));

create policy "patient_addresses: update with patients.manage"
  on patient_addresses for update to authenticated
  using   (has_org_permission(organization_id, 'patients.manage'))
  with check (has_org_permission(organization_id, 'patients.manage'));

-- ------------------------------------------------------------
-- patient_contacts
-- ------------------------------------------------------------

create policy "patient_contacts: read with patients.read_basic"
  on patient_contacts for select to authenticated
  using (has_org_permission(organization_id, 'patients.read_basic'));

create policy "patient_contacts: insert with patients.manage"
  on patient_contacts for insert to authenticated
  with check (has_org_permission(organization_id, 'patients.manage'));

create policy "patient_contacts: update with patients.manage"
  on patient_contacts for update to authenticated
  using   (has_org_permission(organization_id, 'patients.manage'))
  with check (has_org_permission(organization_id, 'patients.manage'));

-- ------------------------------------------------------------
-- patient_requirements
-- Tiered by visibility_level: Operational rows need read_basic;
-- Clinical and Restricted rows need read_clinical.
-- ------------------------------------------------------------

create policy "patient_requirements: read operational rows"
  on patient_requirements for select to authenticated
  using (
    visibility_level = 'Operational'
    and has_org_permission(organization_id, 'patients.read_basic')
  );

create policy "patient_requirements: read clinical and restricted rows"
  on patient_requirements for select to authenticated
  using (
    visibility_level in ('Clinical', 'Restricted')
    and has_org_permission(organization_id, 'patients.read_clinical')
  );

create policy "patient_requirements: insert with patients.manage"
  on patient_requirements for insert to authenticated
  with check (has_org_permission(organization_id, 'patients.manage'));

create policy "patient_requirements: update with patients.manage"
  on patient_requirements for update to authenticated
  using   (has_org_permission(organization_id, 'patients.manage'))
  with check (has_org_permission(organization_id, 'patients.manage'));

-- ------------------------------------------------------------
-- payers
-- ------------------------------------------------------------

create policy "payers: read for org members"
  on payers for select to authenticated
  using (is_org_member(organization_id));

create policy "payers: insert with authorizations.manage"
  on payers for insert to authenticated
  with check (has_org_permission(organization_id, 'authorizations.manage'));

create policy "payers: update with authorizations.manage"
  on payers for update to authenticated
  using   (has_org_permission(organization_id, 'authorizations.manage'))
  with check (has_org_permission(organization_id, 'authorizations.manage'));

-- ------------------------------------------------------------
-- organization_services
-- ------------------------------------------------------------

create policy "organization_services: read for org members"
  on organization_services for select to authenticated
  using (is_org_member(organization_id));

create policy "organization_services: insert with authorizations.manage"
  on organization_services for insert to authenticated
  with check (has_org_permission(organization_id, 'authorizations.manage'));

create policy "organization_services: update with authorizations.manage"
  on organization_services for update to authenticated
  using   (has_org_permission(organization_id, 'authorizations.manage'))
  with check (has_org_permission(organization_id, 'authorizations.manage'));

-- ------------------------------------------------------------
-- patient_authorizations
-- ------------------------------------------------------------

create policy "patient_authorizations: read with authorizations.manage"
  on patient_authorizations for select to authenticated
  using (has_org_permission(organization_id, 'authorizations.manage'));

create policy "patient_authorizations: insert with authorizations.manage"
  on patient_authorizations for insert to authenticated
  with check (has_org_permission(organization_id, 'authorizations.manage'));

create policy "patient_authorizations: update with authorizations.manage"
  on patient_authorizations for update to authenticated
  using   (has_org_permission(organization_id, 'authorizations.manage'))
  with check (has_org_permission(organization_id, 'authorizations.manage'));

-- ------------------------------------------------------------
-- authorization_services
-- ------------------------------------------------------------

create policy "authorization_services: read with authorizations or shifts permission"
  on authorization_services for select to authenticated
  using (
    has_org_permission(organization_id, 'authorizations.manage')
    or has_org_permission(organization_id, 'shifts.manage')
  );

create policy "authorization_services: insert with authorizations.manage"
  on authorization_services for insert to authenticated
  with check (has_org_permission(organization_id, 'authorizations.manage'));

create policy "authorization_services: update with authorizations.manage"
  on authorization_services for update to authenticated
  using   (has_org_permission(organization_id, 'authorizations.manage'))
  with check (has_org_permission(organization_id, 'authorizations.manage'));

-- ------------------------------------------------------------
-- caregivers
-- ------------------------------------------------------------

create policy "caregivers: read with caregivers, shifts, or matching permission"
  on caregivers for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'shifts.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregivers: insert with caregivers.manage"
  on caregivers for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregivers: update with caregivers.manage"
  on caregivers for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_compensation_rates  (SENSITIVE)
-- Requires caregivers.read_compensation in addition to org membership.
-- ------------------------------------------------------------

create policy "caregiver_compensation_rates: read with read_compensation"
  on caregiver_compensation_rates for select to authenticated
  using (has_org_permission(organization_id, 'caregivers.read_compensation'));

create policy "caregiver_compensation_rates: insert with manage + read_compensation"
  on caregiver_compensation_rates for insert to authenticated
  with check (
    has_org_permission(organization_id, 'caregivers.manage')
    and has_org_permission(organization_id, 'caregivers.read_compensation')
  );

create policy "caregiver_compensation_rates: update with manage + read_compensation"
  on caregiver_compensation_rates for update to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    and has_org_permission(organization_id, 'caregivers.read_compensation')
  )
  with check (
    has_org_permission(organization_id, 'caregivers.manage')
    and has_org_permission(organization_id, 'caregivers.read_compensation')
  );

-- ------------------------------------------------------------
-- caregiver_credentials
-- ------------------------------------------------------------

create policy "caregiver_credentials: read with caregivers.manage"
  on caregiver_credentials for select to authenticated
  using (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_credentials: insert with caregivers.manage"
  on caregiver_credentials for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_credentials: update with caregivers.manage"
  on caregiver_credentials for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_service_eligibility
-- ------------------------------------------------------------

create policy "caregiver_service_eligibility: read with caregivers or matching"
  on caregiver_service_eligibility for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregiver_service_eligibility: insert with caregivers.manage"
  on caregiver_service_eligibility for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_service_eligibility: update with caregivers.manage"
  on caregiver_service_eligibility for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_skills
-- ------------------------------------------------------------

create policy "caregiver_skills: read with caregivers or matching"
  on caregiver_skills for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregiver_skills: insert with caregivers.manage"
  on caregiver_skills for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_skills: update with caregivers.manage"
  on caregiver_skills for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_availability
-- ------------------------------------------------------------

create policy "caregiver_availability: read with caregivers, shifts, or matching"
  on caregiver_availability for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'shifts.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregiver_availability: insert with caregivers.manage"
  on caregiver_availability for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_availability: update with caregivers.manage"
  on caregiver_availability for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_availability_exceptions
-- ------------------------------------------------------------

create policy "caregiver_availability_exceptions: read with caregivers, shifts, or matching"
  on caregiver_availability_exceptions for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'shifts.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregiver_availability_exceptions: insert with caregivers.manage"
  on caregiver_availability_exceptions for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_availability_exceptions: update with caregivers.manage"
  on caregiver_availability_exceptions for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- caregiver_constraints
-- ------------------------------------------------------------

create policy "caregiver_constraints: read with caregivers or matching"
  on caregiver_constraints for select to authenticated
  using (
    has_org_permission(organization_id, 'caregivers.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "caregiver_constraints: insert with caregivers.manage"
  on caregiver_constraints for insert to authenticated
  with check (has_org_permission(organization_id, 'caregivers.manage'));

create policy "caregiver_constraints: update with caregivers.manage"
  on caregiver_constraints for update to authenticated
  using   (has_org_permission(organization_id, 'caregivers.manage'))
  with check (has_org_permission(organization_id, 'caregivers.manage'));

-- ------------------------------------------------------------
-- shifts
-- ------------------------------------------------------------

create policy "shifts: read with shifts or matching"
  on shifts for select to authenticated
  using (
    has_org_permission(organization_id, 'shifts.manage')
    or has_org_permission(organization_id, 'matching.run')
  );

create policy "shifts: insert with shifts.manage"
  on shifts for insert to authenticated
  with check (has_org_permission(organization_id, 'shifts.manage'));

create policy "shifts: update with shifts.manage"
  on shifts for update to authenticated
  using   (has_org_permission(organization_id, 'shifts.manage'))
  with check (has_org_permission(organization_id, 'shifts.manage'));

-- No DELETE — use archived_at / status = 'Cancelled'.

-- ------------------------------------------------------------
-- shift_assignment_history  (append-only)
-- ------------------------------------------------------------

create policy "shift_assignment_history: read with shifts.manage"
  on shift_assignment_history for select to authenticated
  using (has_org_permission(organization_id, 'shifts.manage'));

-- INSERT: service_role only. No UPDATE or DELETE.

-- ------------------------------------------------------------
-- matching_runs
-- ------------------------------------------------------------

create policy "matching_runs: read with matching or shifts"
  on matching_runs for select to authenticated
  using (
    has_org_permission(organization_id, 'matching.run')
    or has_org_permission(organization_id, 'shifts.manage')
  );

create policy "matching_runs: insert with matching.run"
  on matching_runs for insert to authenticated
  with check (has_org_permission(organization_id, 'matching.run'));

-- Status updates written by matching engine via service_role.

-- ------------------------------------------------------------
-- matching_candidates
-- ------------------------------------------------------------

create policy "matching_candidates: read with matching or shifts"
  on matching_candidates for select to authenticated
  using (
    has_org_permission(organization_id, 'matching.run')
    or has_org_permission(organization_id, 'shifts.manage')
  );

-- Scores/recommendations written by matching engine (service_role).
-- Schedulers update outreach and response fields during call-off workflow.
create policy "matching_candidates: update outreach fields with call_offs.manage"
  on matching_candidates for update to authenticated
  using   (has_org_permission(organization_id, 'call_offs.manage'))
  with check (has_org_permission(organization_id, 'call_offs.manage'));

-- ------------------------------------------------------------
-- call_offs
-- ------------------------------------------------------------

create policy "call_offs: read with call_offs or shifts"
  on call_offs for select to authenticated
  using (
    has_org_permission(organization_id, 'call_offs.manage')
    or has_org_permission(organization_id, 'shifts.manage')
  );

create policy "call_offs: insert with call_offs.manage"
  on call_offs for insert to authenticated
  with check (has_org_permission(organization_id, 'call_offs.manage'));

create policy "call_offs: update with call_offs.manage"
  on call_offs for update to authenticated
  using   (has_org_permission(organization_id, 'call_offs.manage'))
  with check (has_org_permission(organization_id, 'call_offs.manage'));

-- ------------------------------------------------------------
-- call_off_outreach_events  (append-only)
-- ------------------------------------------------------------

create policy "call_off_outreach_events: read with call_offs.manage"
  on call_off_outreach_events for select to authenticated
  using (has_org_permission(organization_id, 'call_offs.manage'));

create policy "call_off_outreach_events: insert with call_offs.manage"
  on call_off_outreach_events for insert to authenticated
  with check (has_org_permission(organization_id, 'call_offs.manage'));

-- No UPDATE or DELETE — immutable outreach record.

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------

create policy "notifications: read with notifications.send"
  on notifications for select to authenticated
  using (has_org_permission(organization_id, 'notifications.send'));

create policy "notifications: read own notifications"
  on notifications for select to authenticated
  using (recipient_user_id = auth.uid());

-- Dispatch written by notification service via service_role.

-- ------------------------------------------------------------
-- travel_result_cache
-- ------------------------------------------------------------

create policy "travel_result_cache: read for org members"
  on travel_result_cache for select to authenticated
  using (is_org_member(organization_id));

-- Cache written and expired by matching engine via service_role.

-- ------------------------------------------------------------
-- operational_history_events  (append-only, service_role writes)
-- ------------------------------------------------------------

create policy "operational_history_events: read with dashboard.read"
  on operational_history_events for select to authenticated
  using (has_org_permission(organization_id, 'dashboard.read'));

-- No INSERT, UPDATE, or DELETE for authenticated users.


-- ============================================================
-- SECTION 15: ROLE PERMISSION DEFAULTS (SEED DATA)
-- ============================================================
-- Defines which permissions each role has out of the box.
-- Explicit grants in membership_permission_grants extend these.
-- ============================================================

insert into role_permission_defaults (role, permission_code, enabled) values

  -- Agency Administrator: full access to all org capabilities
  ('Agency Administrator', 'patients.read_basic',          true),
  ('Agency Administrator', 'patients.read_clinical',       true),
  ('Agency Administrator', 'patients.manage',              true),
  ('Agency Administrator', 'caregivers.manage',            true),
  ('Agency Administrator', 'caregivers.read_compensation', true),
  ('Agency Administrator', 'authorizations.manage',        true),
  ('Agency Administrator', 'shifts.manage',                true),
  ('Agency Administrator', 'matching.run',                 true),
  ('Agency Administrator', 'call_offs.manage',             true),
  ('Agency Administrator', 'notifications.send',           true),
  ('Agency Administrator', 'dashboard.read',               true),
  ('Agency Administrator', 'users.manage',                 true),

  -- Scheduler: scheduling, matching, call-offs, basic patient read
  -- Caregiver read access comes via shifts.manage and matching.run policies (no manage needed).
  ('Scheduler', 'patients.read_basic',  true),
  ('Scheduler', 'shifts.manage',        true),
  ('Scheduler', 'matching.run',         true),
  ('Scheduler', 'call_offs.manage',     true),
  ('Scheduler', 'notifications.send',   true),
  ('Scheduler', 'dashboard.read',       true),

  -- Clinical Manager: patient and clinical data, authorizations, caregiver oversight
  ('Clinical Manager', 'patients.read_basic',     true),
  ('Clinical Manager', 'patients.read_clinical',  true),
  ('Clinical Manager', 'patients.manage',         true),
  ('Clinical Manager', 'caregivers.manage',       true),
  ('Clinical Manager', 'authorizations.manage',   true),
  ('Clinical Manager', 'dashboard.read',          true),

  -- HR Coordinator: caregiver management including compensation, no patient clinical data
  ('HR Coordinator', 'patients.read_basic',          true),
  ('HR Coordinator', 'caregivers.manage',            true),
  ('HR Coordinator', 'caregivers.read_compensation', true),
  ('HR Coordinator', 'notifications.send',           true),
  ('HR Coordinator', 'dashboard.read',               true),

  -- Compliance Administrator (future role): read-only across most data
  ('Compliance Administrator', 'patients.read_basic',          true),
  ('Compliance Administrator', 'patients.read_clinical',       true),
  ('Compliance Administrator', 'caregivers.manage',            true),
  ('Compliance Administrator', 'caregivers.read_compensation', true),
  ('Compliance Administrator', 'authorizations.manage',        true),
  ('Compliance Administrator', 'dashboard.read',               true);
