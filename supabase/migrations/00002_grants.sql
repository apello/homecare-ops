-- ============================================================
-- SECTION: Role grants
-- Raw SQL migrations do not automatically grant table privileges
-- the way the Supabase dashboard does. This migration adds the
-- minimum grants so RLS policies can evaluate correctly.
--
-- anon  : schema usage only — all table access denied by default
-- authenticated : full DML on all public tables; RLS policies
--                determine what each user can actually read/write
-- ============================================================

grant usage on schema public to anon, authenticated;

grant all on all tables     in schema public to authenticated;
grant all on all sequences  in schema public to authenticated;
grant all on all routines   in schema public to authenticated;
