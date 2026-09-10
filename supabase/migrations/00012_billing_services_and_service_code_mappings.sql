-- ============================================================
-- Migration: Ohio Medicaid billing services and EVV mappings
-- Purpose:
-- - Add the billing-code reference data used by EVV integrations
-- - Map all 22 EVV service IDs to their billing-code patterns
-- ============================================================

insert into public.billing_services (
  billing_code,
  code_match_type,
  service_name,
  service_category,
  default_unit_type,
  effective_start_date,
  active,
  source,
  version
) values
  ('G0156', 'Exact',  'Home Health Aide Services',                 'Aide',          'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('G0299', 'Exact',  'Skilled Nursing Services - RN',             'Nursing',       'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('G0300', 'Exact',  'Skilled Nursing Services - LPN',            'Nursing',       'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('T1000', 'Exact',  'Private Duty Nursing',                      'Nursing',       'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('T1002', 'Exact',  'Nursing Services - RN',                     'Nursing',       'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('T1003', 'Exact',  'Nursing Services - LPN',                    'Nursing',       'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('S5125', 'Exact',  'Home Care Attendant Services',              'Personal Care', 'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('T1019', 'Exact',  'Personal Care Services',                    'Personal Care', 'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('DD25',  'Prefix', 'Homemaker/Personal Care - DD25 Series',     'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('MR81',  'Prefix', 'Homemaker/Personal Care - MR81 Series',     'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('MR9',   'Prefix', 'Homemaker/Personal Care - MR9 Series',      'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('DD26',  'Prefix', 'Homemaker/Personal Care - DD26 Series',     'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('MR82',  'Prefix', 'Homemaker/Personal Care - MR82 Series',     'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('MR970', 'Exact',  'Homemaker/Personal Care - MR970',           'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('MR980', 'Exact',  'Homemaker/Personal Care - MR980',           'Homemaker',     'Unit',  '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024'),
  ('T1001', 'Exact',  'Nursing Assessment',                        'Assessment',    'Visit', '2024-01-01', true, 'Ohio Medicaid EVV service-code reference', '2024')
on conflict (billing_code, version) do update set
  code_match_type = excluded.code_match_type,
  service_name = excluded.service_name,
  service_category = excluded.service_category,
  default_unit_type = excluded.default_unit_type,
  effective_start_date = excluded.effective_start_date,
  effective_end_date = null,
  active = excluded.active,
  source = excluded.source;

with mapping_values (
  id,
  billing_code,
  evv_service_id,
  evv_service_name,
  payer_type,
  program_name
) as (
  values
    ('30000000-0000-0000-0000-000000000101'::uuid, 'G0156', '101', 'SPHH Aide',                    'Medicaid State Plan', 'SPHH'),
    ('30000000-0000-0000-0000-000000000202'::uuid, 'G0299', '202', 'SPHH Nursing - RN',            'Medicaid State Plan', 'SPHH'),
    ('30000000-0000-0000-0000-000000000303'::uuid, 'G0300', '303', 'SPHH Nursing - LPN',           'Medicaid State Plan', 'SPHH'),
    ('30000000-0000-0000-0000-000000000404'::uuid, 'T1000', '404', 'Private Duty Nursing',         'Medicaid',            'Private Duty Nursing'),
    ('30000000-0000-0000-0000-000000000505'::uuid, 'T1002', '505', 'OHCW Nursing - RN',            'Waiver',              'OHCW'),
    ('30000000-0000-0000-0000-000000000515'::uuid, 'T1002', '515', 'PASSPORT Nursing - RN',        'Waiver',              'PASSPORT'),
    ('30000000-0000-0000-0000-000000000535'::uuid, 'T1002', '535', 'IO Nursing - RN',              'Waiver',              'IO'),
    ('30000000-0000-0000-0000-000000000555'::uuid, 'T1002', '555', 'MyCare Nursing - RN',          'Managed Care',        'MyCare'),
    ('30000000-0000-0000-0000-000000000606'::uuid, 'T1003', '606', 'OHCW Nursing - LPN',           'Waiver',              'OHCW'),
    ('30000000-0000-0000-0000-000000000616'::uuid, 'T1003', '616', 'PASSPORT Nursing - LPN',       'Waiver',              'PASSPORT'),
    ('30000000-0000-0000-0000-000000000636'::uuid, 'T1003', '636', 'IO Nursing - LPN',             'Waiver',              'IO'),
    ('30000000-0000-0000-0000-000000000656'::uuid, 'T1003', '656', 'MyCare Nursing - LPN',         'Managed Care',        'MyCare'),
    ('30000000-0000-0000-0000-000000000707'::uuid, 'S5125', '707', 'OHCW Home Care Attendant',     'Waiver',              'OHCW'),
    ('30000000-0000-0000-0000-000000000717'::uuid, 'S5125', '717', 'PASSPORT Home Care Attendant', 'Waiver',              'PASSPORT'),
    ('30000000-0000-0000-0000-000000000757'::uuid, 'S5125', '757', 'MyCare Home Care Attendant',   'Managed Care',        'MyCare'),
    ('30000000-0000-0000-0000-000000000777'::uuid, 'S5125', '777', 'PASSPORT HCA Personal Care',   'Waiver',              'PASSPORT'),
    ('30000000-0000-0000-0000-000000000808'::uuid, 'T1019', '808', 'OHCW Personal Care Aide',      'Waiver',              'OHCW'),
    ('30000000-0000-0000-0000-000000000818'::uuid, 'T1019', '818', 'PASSPORT Personal Care Aide',  'Waiver',              'PASSPORT'),
    ('30000000-0000-0000-0000-000000000831'::uuid, 'DD25',  '838', 'IO HPC',                       'Waiver',              'IO'),
    ('30000000-0000-0000-0000-000000000832'::uuid, 'MR81',  '838', 'IO HPC',                       'Waiver',              'IO'),
    ('30000000-0000-0000-0000-000000000833'::uuid, 'MR9',   '838', 'IO HPC',                       'Waiver',              'IO'),
    ('30000000-0000-0000-0000-000000000851'::uuid, 'DD25',  '858', 'Level One HPC',                'Waiver',              'Level One'),
    ('30000000-0000-0000-0000-000000000852'::uuid, 'DD26',  '858', 'Level One HPC',                'Waiver',              'Level One'),
    ('30000000-0000-0000-0000-000000000853'::uuid, 'MR82',  '858', 'Level One HPC',                'Waiver',              'Level One'),
    ('30000000-0000-0000-0000-000000000854'::uuid, 'MR970', '858', 'Level One HPC',                'Waiver',              'Level One'),
    ('30000000-0000-0000-0000-000000000855'::uuid, 'MR980', '858', 'Level One HPC',                'Waiver',              'Level One'),
    ('30000000-0000-0000-0000-000000000878'::uuid, 'T1019', '878', 'MyCare Personal Care Aide',    'Managed Care',        'MyCare'),
    ('30000000-0000-0000-0000-000000000909'::uuid, 'T1001', '909', 'RN Assessment',                'Medicaid',            null)
)
insert into public.service_code_mappings (
  id,
  billing_service_id,
  evv_service_id,
  evv_service_name,
  payer_type,
  program_name,
  effective_start_date,
  active,
  source,
  version
)
select
  mapping_values.id,
  billing_services.id,
  mapping_values.evv_service_id,
  mapping_values.evv_service_name,
  mapping_values.payer_type,
  mapping_values.program_name,
  '2024-01-01',
  true,
  'Ohio Medicaid EVV service-code reference',
  '2024'
from mapping_values
join public.billing_services
  on billing_services.billing_code = mapping_values.billing_code
 and billing_services.version = '2024'
on conflict (id) do update set
  billing_service_id = excluded.billing_service_id,
  evv_service_id = excluded.evv_service_id,
  evv_service_name = excluded.evv_service_name,
  payer_type = excluded.payer_type,
  program_name = excluded.program_name,
  effective_start_date = excluded.effective_start_date,
  effective_end_date = null,
  active = excluded.active,
  source = excluded.source,
  version = excluded.version;
