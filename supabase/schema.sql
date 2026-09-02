-- 1. 子ども
create table children (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade smallint not null check (grade between 3 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ミッション
create table missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  theme text not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ミッション1回分の参加記録
create table mission_sessions (
  id uuid primary key default gen_random_uuid(),

  child_id uuid not null
    references children(id),

  mission_id uuid not null
    references missions(id),

  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'completed')),

  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 4. 子どもとGeminiの会話
create table chat_messages (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references mission_sessions(id),

  role text not null
    check (role in ('user', 'assistant')),

  content text not null,
  created_at timestamptz not null default now()
);

-- 5. 子どもの振り返り
create table reflections (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references mission_sessions(id),

  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. ファシリテーターの授業後メモ
create table facilitator_notes (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references mission_sessions(id),

  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. AI分析
create table analyses (
  id uuid primary key default gen_random_uuid(),

  child_id uuid not null
    references children(id),

  session_id uuid
    references mission_sessions(id),

  analysis_type text not null
    check (analysis_type in ('session_finding', 'cross_mission')),

  content text not null,
  created_at timestamptz not null default now()
);

-- 8. 保護者向けレポート
create table parent_reports (
  id uuid primary key default gen_random_uuid(),

  child_id uuid not null
    references children(id),

  analysis_id uuid not null
    references analyses(id),

  content text not null,

  status text not null default 'draft'
    check (status in ('draft', 'approved')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. 保護者とAIのチャット
create table parent_chat_messages (
  id uuid primary key default gen_random_uuid(),

  child_id uuid not null
    references children(id),

  role text not null
    check (role in ('user', 'assistant')),

  content text not null,
  created_at timestamptz not null default now()
);