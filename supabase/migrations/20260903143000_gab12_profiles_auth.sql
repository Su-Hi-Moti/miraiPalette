create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('child', 'parent', 'facilitator')),
  child_id uuid references public.children(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users can read own profile"
on public.profiles;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

grant select on public.profiles to authenticated;