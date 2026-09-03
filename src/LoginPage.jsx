import AuthForm from './AuthForm'
import { useAuth } from './useAuth'
import './LoginPage.css'

const roleLabels = {
  parent: '保護者',
  child: '子ども',
  facilitator: '運営者',
}

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
          <p className="login-eyebrow">ミライパレット</p>
          <h1>ログインしています</h1>
          <dl className="auth-details">
            <div><dt>メール</dt><dd>{user.email || '未設定'}</dd></div>
            <div><dt>ユーザーID</dt><dd>{user.id}</dd></div>
            <div><dt>利用者区分</dt><dd>{roleLabels[role] || '未設定'}</dd></div>
            {role === 'parent' && <div><dt>お子さまID</dt><dd>{linkedChildId || '未設定'}</dd></div>}
            <div><dt>ログイン状態</dt><dd>{session ? 'ログイン中' : 'ログアウト'}</dd></div>
          </dl>
          {profileError && <p className="auth-error" role="alert">利用者情報を読み込めませんでした。</p>}
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
        <p className="login-eyebrow">ミライパレット</p>
        <h1>アカウントにログイン</h1>
        <p className="login-description">登録したメールアドレスとパスワードを入力してください。</p>
        <AuthForm onAuthenticated={handleAuthenticated} />
      </section>
    </main>
  )
}
