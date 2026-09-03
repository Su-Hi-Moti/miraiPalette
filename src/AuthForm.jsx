import { useState } from 'react'
import { signInWithPassword } from './lib/auth'

export default function AuthForm({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('パスワードは8文字以上で入力してください')
      return
    }

    setIsSubmitting(true)

    const result = await signInWithPassword({
      email,
      password,
    })

    if (result.error) {
      setError(result.error.message)
    } else {
      onAuthenticated?.(result.data)
    }

    setIsSubmitting(false)
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        メールアドレス
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label>
        パスワード
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          minLength="8"
          required
        />
      </label>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'ログイン中…' : 'ログイン'}
      </button>
    </form>
  )
}