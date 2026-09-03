import { useEffect } from 'react'
import RoleRouter from './RoleRouter'
import { useAuth } from './useAuth'

function App() {
  const {
    role,
    isLoading,
    isAuthenticated,
    profileError,
  } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.replace('/login')
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return <main>認証状態を確認しています...</main>
  }

  if (!isAuthenticated) {
    return <main>ログイン画面へ移動しています...</main>
  }

  if (profileError) {
    return <main>権限情報を取得できませんでした：{profileError}</main>
  }

  if (!role) {
    return <main>このアカウントには権限が設定されていません。</main>
  }

  return <RoleRouter role={role} />
}

export default App