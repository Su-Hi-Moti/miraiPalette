-- GAB-22: 月間ミッション / 週次ミッション管理

-- =========================================================
-- 1. monthly_missions
-- =========================================================

create table if not exists public.monthly_missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint monthly_missions_status_check
    check (status in ('draft', 'published', 'archived')),

  constraint monthly_missions_dates_check
    check (starts_on <= ends_on)
);


-- =========================================================
-- 2. missions を週次ミッションとして拡張
-- 既存データを壊さないため全てNULL許可
-- =========================================================

alter table public.missions
  add column if not exists monthly_mission_id uuid
    references public.monthly_missions(id);

alter table public.missions
  add column if not exists week_number smallint;

alter table public.missions
  add column if not exists opens_on date;

alter table public.missions
  add column if not exists closes_on date;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'missions_week_number_check'
      and conrelid = 'public.missions'::regclass
  ) then
    alter table public.missions
      add constraint missions_week_number_check
      check (week_number between 1 and 5);
  end if;
end
$$;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'missions_monthly_week_unique'
      and conrelid = 'public.missions'::regclass
  ) then
    alter table public.missions
      add constraint missions_monthly_week_unique
      unique (monthly_mission_id, week_number);
  end if;
end
$$;


-- =========================================================
-- 3. child_monthly_missions
-- =========================================================

create table if not exists public.child_monthly_missions (
  id uuid primary key default gen_random_uuid(),

  child_id uuid not null
    references public.children(id),

  monthly_mission_id uuid not null
    references public.monthly_missions(id),

  status text not null default 'planned',

  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  constraint child_monthly_missions_status_check
    check (status in ('planned', 'in_progress', 'completed')),

  constraint child_monthly_missions_child_month_unique
    unique (child_id, monthly_mission_id)
);


-- =========================================================
-- 4. mission_sessions 重複防止
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'mission_sessions_child_mission_unique'
      and conrelid = 'public.mission_sessions'::regclass
  ) then
    alter table public.mission_sessions
      add constraint mission_sessions_child_mission_unique
      unique (child_id, mission_id);
  end if;
end
$$;


-- =========================================================
-- 5. indexes
-- unique制約のある3組についてはPostgreSQLが自動で
-- B-tree indexを作るため、重複indexは作成しない
-- =========================================================

create index if not exists idx_monthly_missions_period_status
  on public.monthly_missions (
    starts_on,
    ends_on,
    status
  );

-- 以下はunique制約により自動的にindexが作られる
-- missions(monthly_mission_id, week_number)
-- child_monthly_missions(child_id, monthly_mission_id)
-- mission_sessions(child_id, mission_id)


-- =========================================================
-- 6. RLSを有効化
-- =========================================================

alter table public.monthly_missions enable row level security;
alter table public.child_monthly_missions enable row level security;
alter table public.missions enable row level security;
alter table public.mission_sessions enable row level security;


-- 新規テーブルにauthenticated権限を付与
-- 実際のアクセス可否はRLSで制御する

grant select, insert, update, delete
on public.monthly_missions
to authenticated;

grant select, insert, update, delete
on public.child_monthly_missions
to authenticated;


-- =========================================================
-- monthly_missions RLS
-- child / parent:
--   profiles.child_id に紐づいた割当のみ
-- facilitator:
--   全データ管理
-- =========================================================

drop policy if exists "gab22 monthly missions select"
on public.monthly_missions;

drop policy if exists "gab22 facilitator manages monthly missions"
on public.monthly_missions;


create policy "gab22 monthly missions select"
on public.monthly_missions
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or (
    public.current_user_role() in ('child', 'parent')
    and exists (
      select 1
      from public.child_monthly_missions cmm
      where cmm.monthly_mission_id = monthly_missions.id
        and cmm.child_id = public.current_child_id()
    )
  )
);


create policy "gab22 facilitator manages monthly missions"
on public.monthly_missions
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- child_monthly_missions RLS
-- child / parent:
--   profiles.child_id の割当のみ
-- facilitator:
--   全データ管理
-- =========================================================

drop policy if exists "gab22 child monthly missions select"
on public.child_monthly_missions;

drop policy if exists "gab22 facilitator manages child monthly missions"
on public.child_monthly_missions;


create policy "gab22 child monthly missions select"
on public.child_monthly_missions
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or (
    public.current_user_role() in ('child', 'parent')
    and child_id = public.current_child_id()
  )
);


create policy "gab22 facilitator manages child monthly missions"
on public.child_monthly_missions
for all
to authenticated
using (
  public.current_user_role() = 'facilitator'
)
with check (
  public.current_user_role() = 'facilitator'
);


-- =========================================================
-- missions RLS
--
-- 既存の「全authenticatedが閲覧可能」は削除。
--
-- child / parent:
--   1. 自分の月間割当に含まれる週次mission
--   2. 既存sessionがあるmission
--
-- 2を残すことで既存チャットを壊さない。
-- =========================================================

drop policy if exists "authenticated missions select"
on public.missions;

drop policy if exists "gab22 role based missions select"
on public.missions;


create policy "gab22 role based missions select"
on public.missions
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'

  or (

    public.current_user_role() in ('child', 'parent')

    and (

      exists (
        select 1
        from public.child_monthly_missions cmm
        where cmm.child_id = public.current_child_id()
          and cmm.monthly_mission_id = missions.monthly_mission_id
      )

      or

      exists (
        select 1
        from public.mission_sessions ms
        where ms.child_id = public.current_child_id()
          and ms.mission_id = missions.id
      )

    )
  )
);


-- 既存の facilitator manages missions policy はそのまま利用


-- =========================================================
-- mission_sessions RLS
-- child: 自分
-- parent: 関連する子ども
-- facilitator: 全件
-- =========================================================

drop policy if exists "role based sessions select"
on public.mission_sessions;

drop policy if exists "gab22 role based sessions select"
on public.mission_sessions;


create policy "gab22 role based sessions select"
on public.mission_sessions
for select
to authenticated
using (
  public.current_user_role() = 'facilitator'
  or (
    public.current_user_role() in ('child', 'parent')
    and child_id = public.current_child_id()
  )
);


-- 既存の facilitator manages sessions policy はそのまま利用


-- =========================================================
-- 7. 2026年9月 デモデータ
-- =========================================================

insert into public.monthly_missions (
  id,
  title,
  description,
  starts_on,
  ends_on,
  status
)
values (
  '20000001-0000-4000-8000-000000000001',
  '9月 つくって試すチャレンジ',
  '身近な材料や仕組みを使って、作る・試す・考え直すことを楽しむ1か月のミッションです。',
  '2026-09-01',
  '2026-09-30',
  'published'
)
on conflict (id)
do update set
  title = excluded.title,
  description = excluded.description,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  updated_at = now();


-- Week 1: 現在チャットで利用している「強い橋を作ろう」
update public.missions
set
  monthly_mission_id = '20000001-0000-4000-8000-000000000001',
  week_number = 1,
  opens_on = '2026-09-01',
  closes_on = '2026-09-07',
  updated_at = now()
where id = '349c3147-ff3b-4d1b-943e-cd2e4579bff6';


-- Week 2
update public.missions
set
  monthly_mission_id = '20000001-0000-4000-8000-000000000001',
  week_number = 2,
  opens_on = '2026-09-08',
  closes_on = '2026-09-14',
  updated_at = now()
where id = '10000001-0000-4000-8000-000000000001';


-- Week 3
update public.missions
set
  monthly_mission_id = '20000001-0000-4000-8000-000000000001',
  week_number = 3,
  opens_on = '2026-09-15',
  closes_on = '2026-09-21',
  updated_at = now()
where id = '10000002-0000-4000-8000-000000000002';


-- Week 4
update public.missions
set
  monthly_mission_id = '20000001-0000-4000-8000-000000000001',
  week_number = 4,
  opens_on = '2026-09-22',
  closes_on = '2026-09-30',
  updated_at = now()
where id = '10000003-0000-4000-8000-000000000003';


-- デモ児童へ9月月間ミッションを割り当て
insert into public.child_monthly_missions (
  id,
  child_id,
  monthly_mission_id,
  status,
  assigned_at,
  started_at
)
values (
  '30000001-0000-4000-8000-000000000001',
  'd5cdb109-8ec6-4d8d-a1af-67b457f3ec04',
  '20000001-0000-4000-8000-000000000001',
  'in_progress',
  now(),
  now()
)
on conflict (child_id, monthly_mission_id)
do update set
  status = excluded.status;


-- =========================================================
-- 完了
-- =========================================================