-- GAB-22 role based RLS checks
-- Supabase SQL Editor 用

-- =========================================================
-- CHILD
-- 期待値: leaked_assignments = 0 / leaked_progress = 0
-- =========================================================
begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select id::text
    from public.profiles
    where role = 'child'
    limit 1
  ),
  true
);

set local role authenticated;

select
  public.current_user_role() as role,
  public.current_child_id() as child_id,
  (
    select count(*)
    from public.child_monthly_missions
    where child_id <> public.current_child_id()
  ) as leaked_assignments,
  (
    select count(*)
    from public.mission_sessions
    where child_id <> public.current_child_id()
  ) as leaked_progress;

rollback;


-- =========================================================
-- PARENT
-- 期待値: leaked_assignments = 0 / leaked_progress = 0
-- =========================================================
begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select id::text
    from public.profiles
    where role = 'parent'
    limit 1
  ),
  true
);

set local role authenticated;

select
  public.current_user_role() as role,
  public.current_child_id() as child_id,
  (
    select count(*)
    from public.child_monthly_missions
    where child_id <> public.current_child_id()
  ) as leaked_assignments,
  (
    select count(*)
    from public.mission_sessions
    where child_id <> public.current_child_id()
  ) as leaked_progress;

rollback;


-- =========================================================
-- FACILITATOR
-- 期待値: INSERT / UPDATE / DELETE 全て成功
-- rollbackするのでテストデータは残らない
-- =========================================================
begin;

select set_config(
  'request.jwt.claim.sub',
  (
    select id::text
    from public.profiles
    where role = 'facilitator'
    limit 1
  ),
  true
);

set local role authenticated;

insert into public.monthly_missions (
  id,
  title,
  description,
  starts_on,
  ends_on,
  status
)
values (
  'ffffffff-ffff-4fff-8fff-000000000001',
  'RLSテスト',
  '運営者CRUD確認用',
  '2026-10-01',
  '2026-10-31',
  'draft'
);

update public.monthly_missions
set status = 'published'
where id = 'ffffffff-ffff-4fff-8fff-000000000001';

delete from public.monthly_missions
where id = 'ffffffff-ffff-4fff-8fff-000000000001';

rollback;