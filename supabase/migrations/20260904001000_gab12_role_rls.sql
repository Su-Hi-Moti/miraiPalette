-- GAB-12: Auth role based RLS

-- =========================================================
-- RLSを有効化
-- =========================================================

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.missions enable row level security;
alter table public.mission_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reflections enable row level security;
alter table public.facilitator_notes enable row level security;
alter table public.analyses enable row level security;
alter table public.parent_reports enable row level security;
alter table public.parent_chat_messages enable row level security;


-- =========================================================
-- ログインユーザーのrole / child_idを取得するhelper
-- =========================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_child_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select child_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_user_owns_session(
  target_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mission_sessions ms
    join public.profiles p
      on p.child_id = ms.child_id
    where p.id = auth.uid()
      and p.role = 'child'
      and ms.id = target_session_id
  )
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_child_id() from public;
revoke all on function public.current_user_owns_session(uuid) from public;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_child_id() to authenticated;
grant execute on function public.current_user_owns_session(uuid) to authenticated;


-- =========================================================
-- 既存policyを削除
-- =========================================================

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles',
        'children',
        'missions',
        'mission_sessions',
        'chat_messages',
        'reflections',
        'facilitator_notes',
        'analyses',
        'parent_reports',
        'parent_chat_messages'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      p.policyname,
      p.tablename
    );
  end loop;
end
$$;


-- =========================================================
-- profiles
-- 自分自身のプロフィールだけ取得可能
-- =========================================================

create policy "read own profile"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
);


-- =========================================================
-- children
-- child: 自分
-- parent: 紐づく子ども
-- facilitator: 全員
-- =========================================================

create policy "role based children select"
on public.children
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or id = public.current_child_id()
);


-- =========================================================
-- missions
-- ログインユーザーは閲覧可能
-- facilitatorのみ管理可能
-- =========================================================

create policy "authenticated missions select"
on public.missions
for select
to authenticated
using (true);

create policy "facilitator manages missions"
on public.missions
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- mission_sessions
-- child: 自分のsession
-- facilitator: 全session
-- parentは直接閲覧しない
-- =========================================================

create policy "role based sessions select"
on public.mission_sessions
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or (
    public.current_user_role() = 'child'
    and child_id = public.current_child_id()
  )
);

create policy "facilitator manages sessions"
on public.mission_sessions
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- chat_messages
-- child: 自分のsessionのみ
-- facilitator: 閲覧可能
-- =========================================================

create policy "child reads own chat"
on public.chat_messages
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or public.current_user_owns_session(session_id)
);

create policy "child inserts own chat"
on public.chat_messages
for insert
to authenticated
with check (
  public.current_user_role() = 'child'
  and public.current_user_owns_session(session_id)
);


-- =========================================================
-- reflections
-- child: 自分のsession
-- facilitator: 閲覧
-- =========================================================

create policy "role based reflections select"
on public.reflections
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or public.current_user_owns_session(session_id)
);

create policy "child inserts own reflection"
on public.reflections
for insert
to authenticated
with check (
  public.current_user_role() = 'child'
  and public.current_user_owns_session(session_id)
);

create policy "child updates own reflection"
on public.reflections
for update
to authenticated
using (
  public.current_user_role() = 'child'
  and public.current_user_owns_session(session_id)
)
with check (
  public.current_user_role() = 'child'
  and public.current_user_owns_session(session_id)
);


-- =========================================================
-- facilitator_notes
-- facilitatorのみ
-- =========================================================

create policy "facilitator reads notes"
on public.facilitator_notes
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
);

create policy "facilitator manages notes"
on public.facilitator_notes
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- analyses
-- child: 自分の分析
-- facilitator: 全分析
-- parentは直接閲覧しない
-- =========================================================

create policy "role based analyses select"
on public.analyses
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or (
    public.current_user_role() = 'child'
    and child_id = public.current_child_id()
  )
);

create policy "child inserts own analyses"
on public.analyses
for insert
to authenticated
with check (
  public.current_user_role() = 'child'
  and child_id = public.current_child_id()
);

create policy "child updates own analyses"
on public.analyses
for update
to authenticated
using (
  public.current_user_role() = 'child'
  and child_id = public.current_child_id()
)
with check (
  public.current_user_role() = 'child'
  and child_id = public.current_child_id()
);

create policy "facilitator manages analyses"
on public.analyses
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- parent_reports
-- parent: 紐づく子どものreport
-- facilitator: 閲覧可能
-- =========================================================

create policy "parent reads own child reports"
on public.parent_reports
for select
to authenticated
using (
  public.current_user_role() = 'parent'
  and child_id = public.current_child_id()
);

create policy "facilitator reads reports"
on public.parent_reports
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- parent_chat_messages
-- parent: 紐づく子どもの保護者チャットのみ
-- =========================================================

create policy "parent accesses own child chat"
on public.parent_chat_messages
for select
to authenticated
using (
  public.current_user_role() = 'parent'
  and child_id = public.current_child_id()
);

create policy "parent inserts own child chat"
on public.parent_chat_messages
for insert
to authenticated
with check (
  public.current_user_role() = 'parent'
  and child_id = public.current_child_id()
);