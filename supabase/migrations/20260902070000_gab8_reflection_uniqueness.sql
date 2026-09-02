-- 1セッションにつき振り返りと「今回の発見」を1件に保ち、同時送信でも重複させない。
create unique index if not exists reflections_one_per_session_idx
  on public.reflections (session_id);

create unique index if not exists analyses_one_type_per_session_idx
  on public.analyses (session_id, analysis_type);
