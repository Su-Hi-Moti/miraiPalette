# reflection-insight Edge Function

ミッション後の振り返りを保存し、AI会話履歴と合わせてGeminiへ送り、短い「今回の発見」を生成・保存します。

- `POST`: 振り返り保存 → Gemini生成 → `analyses(session_finding)` 保存
- `GET ?session_id=...`: 保存済み振り返りと今回の発見を取得
- モデル: `GEMINI_MODEL`（未設定時は `gemini-3.5-flash-lite`）

```sh
supabase functions deploy reflection-insight
```

`reflections` と `analyses` に対する SELECT / INSERT / UPDATE のRLSポリシーが必要です。
