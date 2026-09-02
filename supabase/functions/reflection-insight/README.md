# reflection-insight Edge Function

ミッション後の振り返りを保存し、AI会話履歴と合わせてGeminiへ送り、短い「今回の発見」を生成・保存します。

- `POST`: 振り返り保存 → Gemini生成 → `analyses(session_finding)` 保存
- `GET ?session_id=...`: 保存済み振り返りと今回の発見を取得
- モデル: `GEMINI_MODEL`（未設定時は `gemini-3.5-flash-lite`）

```sh
supabase functions deploy reflection-insight
```

必要なRLS権限:

- `mission_sessions`: SELECT
- `chat_messages`: SELECT
- `reflections`: SELECT / INSERT / UPDATE
- `analyses`: SELECT / INSERT / UPDATE

匿名デモ用ポリシーは本番データと分離してください。本番ではSupabase AuthのJWTと、
ログインユーザーが対象の子ども・セッションへアクセスできることを検証するポリシーが必要です。
