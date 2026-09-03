# miraiPalette
Product For Gabaithon

## GAB-12 認証

Supabase Authを使ったアカウント登録・ログイン・セッション管理を実装しています。

- `/login`: 認証画面（登録時にロールを選択し、保護者は子どもも選択）
- `src/AuthForm.jsx`: メールアドレス＋パスワードの登録／ログインフォーム
- `src/AuthProvider.jsx`: Authセッションの初期化と変更監視
- `src/useAuth.js`: 画面側から認証状態を読むHook
- `src/lib/auth.js`: Supabase Auth APIの薄いラッパー

選択したロールと保護者の子どもIDはSupabase Authの`user_metadata`へ保存されます。`profiles.role`が存在する場合はDBのロールを優先し、まだプロフィール行がない場合はAuthメタデータを利用します。ロール別画面・RLSは別担当の実装を利用してください。認証済みEdge Functionを呼び出す場合は、Supabaseセッションのアクセストークンを`Authorization: Bearer <access_token>`で渡します。
