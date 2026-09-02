-- 1セッションにつきファシリテーターメモを1件に保つ。
create unique index if not exists facilitator_notes_one_per_session_idx
  on public.facilitator_notes (session_id);
