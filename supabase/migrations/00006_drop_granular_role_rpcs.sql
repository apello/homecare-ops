-- ============================================================
-- Migration: Drop add/remove role RPCs
-- Purpose:
-- - set_org_member_roles covers all role management needs
-- - add_org_member_role and remove_org_member_role are unused
-- ============================================================

drop function if exists public.add_org_member_role(uuid, uuid, text);
drop function if exists public.remove_org_member_role(uuid, uuid, text);
