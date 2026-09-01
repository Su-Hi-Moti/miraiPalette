# mission-chat Edge Function

子どもの発言を保存し、直近20件の会話を文脈としてGeminiへ送り、回答も保存します。

## 設定とデプロイ

```sh
supabase secrets set GEMINI_API_KEY=your_api_key
supabase functions deploy mission-chat
```

既定モデルは無料枠のある安定版 `gemini-2.5-flash-lite` です。変更時のみ
`GEMINI_MODEL` を設定します。課金を確実に避けるには、請求先を紐づけていない
Free TierのGoogle AI StudioプロジェクトでAPIキーを発行してください。無料枠の
上限到達時は課金されずAPIエラーになります。

## API

会話送信: `POST /functions/v1/mission-chat`

```json
{
  "session_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "message": "三角形なら橋は強くなるかな？"
}
```

履歴取得: `GET /functions/v1/mission-chat?session_id=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

フロントエンドのSupabase `Authorization` ヘッダーを渡してください。DB操作はそのJWTで
行うため、`mission_sessions` と `chat_messages` のRLSでアクセスを制限してください。
