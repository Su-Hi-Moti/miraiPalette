import AuthForm from './AuthForm'
import { useAuth } from './useAuth'
import './LoginPage.css'

export default function LoginPage() {
  const { session, user, profile, role, linkedChildId, profileError, isLoading, isAuthenticated, signOut } = useAuth()

  const handleAuthenticated = () => {
    window.location.assign('/')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (isLoading) {
    return <main className="login-page"><section className="login-card"><p>認証状態を確認しています…</p></section></main>
  }

  if (isAuthenticated) {
    return (
      <main className="login-page">
        <section className="login-card authenticated-card">
          <p className="login-eyebrow">MIRAI PALETTE</p>
          <h1>ログインしています</h1>
          <dl className="auth-details">
            <div><dt>メール</dt><dd>{user.email || '未設定'}</dd></div>
            <div><dt>ユーザーID</dt><dd>{user.id}</dd></div>
            <div><dt>ロール</dt><dd>{role || '未設定'}</dd></div>
            {role === 'parent' && <div><dt>子どもID</dt><dd>{linkedChildId || '未設定'}</dd></div>}
            <div><dt>セッション</dt><dd>{session ? '有効' : 'なし'}</dd></div>
          </dl>
          {profileError && <p className="auth-error" role="alert">ロール情報を取得できませんでした: {profileError}</p>}
          {!profile && !profileError && <p className="auth-message">プロフィールを読み込んでいます…</p>}
          <div className="authenticated-actions">
            <a href="/">アプリへ戻る</a>
            <button type="button" onClick={handleSignOut}>ログアウト</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="login-eyebrow">MIRAI PALETTE</p>
        <h1>ログイン</h1>
        <p className="login-description">アカウントを作成するか、登録済みのメールアドレスでログインしてください。</p>
        <AuthForm onAuthenticated={handleAuthenticated} />
      </section>
    </main>
  )
}
