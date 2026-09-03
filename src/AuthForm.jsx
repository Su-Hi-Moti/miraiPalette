import { useState } from 'react'
import { signInWithPassword, signUp } from './lib/auth'

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'sign-up' && !displayName.trim()) {
      setError('名前を入力してください')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    setIsSubmitting(true)
    const result = mode === 'sign-up'
      ? await signUp({ email, password, displayName })
      : await signInWithPassword({ email, password })

    if (result.error) {
      setError(result.error.message)
    } else if (mode === 'sign-up' && !result.data.session) {
      setMessage('確認メールを送信しました。メールのリンクから登録を完了してください。')
    } else {
      onAuthenticated?.(result.data)
    }
    setIsSubmitting(false)
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-form-tabs">
        <button type="button" className={mode === 'sign-in' ? 'active' : ''} onClick={() => setMode('sign-in')}>ログイン</button>
        <button type="button" className={mode === 'sign-up' ? 'active' : ''} onClick={() => setMode('sign-up')}>アカウント作成</button>
      </div>
      {mode === 'sign-up' && <label>名前<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength="80" /></label>}
      <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength="8" required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? '処理中…' : mode === 'sign-up' ? 'アカウントを作成' : 'ログイン'}</button>
    </form>
  )
}
