import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthProvider.jsx'
import LoginPage from './LoginPage.jsx'

const isLoginPath = window.location.pathname.replace(/\/+$/, '') === '/login'
const rootPage = isLoginPath ? <LoginPage /> : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      {rootPage}
    </AuthProvider>
  </StrictMode>,
)
