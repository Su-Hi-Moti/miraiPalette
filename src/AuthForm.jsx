import { useEffect, useState } from 'react'
import { signInWithPassword, signUp } from './lib/auth'
import { supabase } from './lib/supabase'

const roleOptions = [
  ['parent', '保護者'],
  ['child', '子ども'],
  ['facilitator', '運営者'],
]

export default function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('parent')
  const [childId, setChildId] = useState('')
  const [children, setChildren] = useState([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [childrenError, setChildrenError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'sign-up' || role !== 'parent') return
    let ignore = false
    const loadChildren = async () => {
      setChildrenLoading(true)
      setChildrenError('')
      const { data, error: loadError } = await supabase
        .from('children')
        .select('id, name, grade')
        .order('name')
      if (ignore) return
      setChildren(data || [])
      setChildrenError(loadError?.message ?? '')
      setChildrenLoading(false)
    }
    loadChildren()
    return () => { ignore = true }
  }, [mode, role])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (mode === 'sign-up' && !displayName.trim()) {
      setError('名前を入力してください')
      return
    }
    if (mode === 'sign-up' && role === 'parent' && !childId) {
      setError('お子さまを選択してください')
      return
    }
    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    setIsSubmitting(true)
    const result = mode === 'sign-up'
      ? await signUp({ email, password, displayName, role, childId })
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
      {mode === 'sign-up' && <>
        <label>名前<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" maxLength="80" /></label>
        <label>利用者区分<select value={role} onChange={(event) => { setRole(event.target.value); setChildId('') }}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {role === 'parent' && <label>お子さま<select value={childId} onChange={(event) => setChildId(event.target.value)} disabled={childrenLoading || Boolean(childrenError)} required><option value="">{childrenLoading ? '読み込み中…' : '選択してください'}</option>{children.map((child) => <option key={child.id} value={child.id}>{child.name}（小学{child.grade}年生）</option>)}</select></label>}
        {childrenError && role === 'parent' && <p className="auth-error" role="alert">お子さま一覧を取得できませんでした: {childrenError}</p>}
      </>}
      <label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength="8" required /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button type="submit" disabled={isSubmitting}>{isSubmitting ? '処理中…' : mode === 'sign-up' ? 'アカウントを作成' : 'ログイン'}</button>
    </form>
  )
}
