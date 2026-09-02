import { useEffect, useRef, useState } from 'react'
import './App.css'
import ParentReport from './ParentReport'

const initialMessages = [{ id: 'welcome', role: 'assistant', content: 'こんにちは！きょうのミッションについて、いっしょに考えよう。まず、どんな橋を作ってみたい？' }]
const demoReplies = ['いい考えだね！どうしてそう思ったの？', 'なるほど。どの部分から試してみたい？', 'おもしろそう！強くするために、どんな形が使えそう？', 'その考えを、小さく試すとしたら何ができるかな？']
const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

function App() {
  const [view, setView] = useState('child')
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const sessionId = import.meta.env.VITE_DEMO_SESSION_ID
  const isDemo = !supabaseUrl || !supabaseAnonKey || !sessionId

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isSending])

  const getDemoReply = (message) => {
    if (message.includes('三角')) return '三角形を、橋のどの部分に使ってみたい？'
    if (message.includes('強')) return '強い橋にするには、どこを工夫できそう？'
    return demoReplies[(messages.length - 1) % demoReplies.length]
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || isSending) return
    setMessages((current) => [...current, { id: createMessageId(), role: 'user', content: message }])
    setInput(''); setError(''); setIsSending(true)
    try {
      let reply
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 650))
        reply = getDemoReply(message)
      } else {
        const response = await fetch(`${supabaseUrl}/functions/v1/mission-chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
          body: JSON.stringify({ session_id: sessionId, message }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'AIとの通信に失敗しました')
        reply = data.message
      }
      setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: reply }])
    } catch (sendError) { setError(sendError.message) } finally { setIsSending(false) }
  }
  if (view === 'parent') {
  return <ParentReport onBack={() => setView('child')} />
}
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ミライパレット ホーム"><span className="brand-mark">M</span><span>ミライパレット</span></a>
        <div className="profile">
          <button
 	 type="button"
  	  className="parent-report-button"
  	  onClick={() => setView('parent')}
	 >
  	  保護者レポート
	 </button>
          <span className={`mode-badge ${isDemo ? 'demo' : ''}`}><span className="status-dot" />{isDemo ? 'デモモード' : 'AI接続中'}</span>
          <span className="avatar">た</span><span className="profile-name">デモ太郎</span>
        </div>
      </header>
      <section className="mission-strip" aria-label="今日のミッション">
        <div className="mission-icon">橋</div>
        <div><p className="eyebrow">TODAY&apos;S MISSION</p><h1>強い橋を作ろう</h1><p>どうしたら、少ない材料でも強い橋になるかな？</p></div>
        <div className="step-chip">STEP 2 / 3</div>
      </section>

      <section className="chat-panel">
        <div className="chat-heading">
          <div><p className="eyebrow">AI THINKING PARTNER</p><h2>いっしょに考えてみよう</h2></div>
          <p className="helper">正解はひとつじゃないよ。思ったことを自由に話してね。</p>
        </div>
        <div className="messages" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`message-row ${message.role}`}>
              {message.role === 'assistant' && <div className="ai-avatar">M</div>}
              <div><p className="speaker">{message.role === 'assistant' ? 'ミライ' : 'あなた'}</p><div className="bubble">{message.content}</div></div>
            </article>
          ))}
          {isSending && <article className="message-row assistant"><div className="ai-avatar">M</div><div><p className="speaker">ミライ</p><div className="bubble typing" aria-label="考え中"><i /><i /><i /></div></div></article>}
          <div ref={messagesEndRef} />
        </div>
        <form className="composer" onSubmit={sendMessage}>
          {error && <p className="error-message">{error}</p>}
          <div className="input-row">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="考えていることを入力してね…" aria-label="メッセージ" rows="1" maxLength="2000" />
            <button type="submit" disabled={!input.trim() || isSending} aria-label="送信する"><span>送る</span><span>→</span></button>
          </div>
          <p className="input-hint">Enterで送信 ・ Shift + Enterで改行</p>
        </form>
      </section>
    </main>
  )
}

export default App
