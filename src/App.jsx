import { useEffect, useRef, useState } from 'react'
import FacilitatorView from './FacilitatorView'
import ParentReport from './ParentReport'
import './App.css'

const initialMessages = [{ id: 'welcome', role: 'assistant', content: 'こんにちは！きょうのミッションについて、いっしょに考えよう。まず、どんな橋を作ってみたい？' }]
const demoReplies = ['いい考えだね！どうしてそう思ったの？', 'なるほど。どの部分から試してみたい？', 'おもしろそう！強くするために、どんな形が使えそう？', 'その考えを、小さく試すとしたら何ができるかな？']
const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

function App() {
  const [appMode, setAppMode] = useState('child')
  const [screen, setScreen] = useState('chat')
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [reflection, setReflection] = useState({ enjoyed: '', difficult: '', next: '' })
  const [finding, setFinding] = useState('')
  const [reflectionError, setReflectionError] = useState('')
  const [isReflectionLoading, setIsReflectionLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef(null)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const sessionId = import.meta.env.VITE_DEMO_SESSION_ID
  const isDemo = !supabaseUrl || !supabaseAnonKey || !sessionId

  const apiHeaders = { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isSending])

  useEffect(() => {
    if (screen !== 'reflection' || isDemo) return
    let ignore = false
    const loadReflection = async () => {
      setIsReflectionLoading(true)
      setReflectionError('')
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/reflection-insight?session_id=${sessionId}`, {
          headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '振り返りを読み込めませんでした')
        if (!ignore && data.reflection?.answers) setReflection(data.reflection.answers)
        if (!ignore && data.finding?.content) setFinding(data.finding.content)
      } catch (loadError) {
        if (!ignore) setReflectionError(loadError.message)
      } finally {
        if (!ignore) setIsReflectionLoading(false)
      }
    }
    loadReflection()
    return () => { ignore = true }
  }, [screen, isDemo, sessionId, supabaseUrl, supabaseAnonKey])

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
          headers: apiHeaders,
          body: JSON.stringify({ session_id: sessionId, message }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'AIとの通信に失敗しました')
        reply = data.message
      }
      setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: reply }])
    } catch (sendError) { setError(sendError.message) } finally { setIsSending(false) }
  }

  const submitReflection = async (event) => {
    event.preventDefault()
    if (Object.values(reflection).some((answer) => !answer.trim()) || isGenerating) return
    setIsGenerating(true)
    setReflectionError('')
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 900))
        setFinding(`橋を強くするために、形を変えながら試すことができたね。難しかったところも言葉にできたから、次は「${reflection.next}」を小さく試してみよう。`)
      } else {
        const response = await fetch(`${supabaseUrl}/functions/v1/reflection-insight`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ session_id: sessionId, reflection }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '今回の発見を生成できませんでした')
        setFinding(data.finding.content)
      }
    } catch (submitError) { setReflectionError(submitError.message) } finally { setIsGenerating(false) }
  }

  if (appMode === 'facilitator') return <FacilitatorView onBack={() => setAppMode('child')} />
  if (appMode === 'parent') return <ParentReport onBack={() => setAppMode('child')} />

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="ミライパレット ホーム"><span className="brand-mark">M</span><span>ミライパレット</span></a>
        <div className="profile">
	  <button
 	   className="parent-report-button"
 	   type="button"
 	   onClick={() => setAppMode('parent')}
	  >
 	   保護者レポート
	  </button>
          <button className="admin-link" type="button" onClick={() => setAppMode('facilitator')}>運営画面</button>
          <span className={`mode-badge ${isDemo ? 'demo' : ''}`}><span className="status-dot" />{isDemo ? 'デモモード' : 'AI接続中'}</span>
          <span className="avatar">た</span><span className="profile-name">デモ太郎</span>
        </div>
      </header>

      <section className="mission-strip" aria-label="今日のミッション">
        <div className="mission-icon">橋</div>
        <div><p className="eyebrow">TODAY&apos;S MISSION</p><h1>強い橋を作ろう</h1><p>どうしたら、少ない材料でも強い橋になるかな？</p></div>
        <div className="step-chip">{screen === 'chat' ? 'STEP 2 / 3' : 'STEP 3 / 3'}</div>
      </section>

      {screen === 'chat' ? <section className="chat-panel">
        <div className="chat-heading">
          <div><p className="eyebrow">AI THINKING PARTNER</p><h2>いっしょに考えてみよう</h2></div>
          <div className="heading-actions"><p className="helper">正解はひとつじゃないよ。思ったことを自由に話してね。</p><button className="reflection-link" type="button" onClick={() => setScreen('reflection')}>振り返りへ <span>→</span></button></div>
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
      </section> : <section className="reflection-panel">
        <div className="reflection-heading">
          <button className="back-button" type="button" onClick={() => setScreen('chat')}>← 会話に戻る</button>
          <p className="eyebrow">MY REFLECTION</p>
          <h2>今日のことを振り返ろう</h2>
          <p>うまく書こうとしなくて大丈夫。感じたことを自分の言葉で教えてね。</p>
        </div>

        {isReflectionLoading ? <div className="reflection-loading">振り返りを読み込んでいます…</div> : finding ? <div className="finding-view">
          <div className="finding-mark">✦</div>
          <p className="eyebrow">TODAY&apos;S DISCOVERY</p>
          <h2>今回の発見</h2>
          <p className="finding-text">{finding}</p>
          <div className="finding-actions">
            <button className="secondary-button" type="button" onClick={() => setFinding('')}>振り返りを編集</button>
            <button className="primary-button" type="button" onClick={() => setScreen('chat')}>会話を見返す</button>
          </div>
        </div> : <form className="reflection-form" onSubmit={submitReflection}>
          {[
            ['enjoyed', '1', 'いちばん楽しかったことは？', '作っているとき、話しているときに「いいな」と思ったこと'],
            ['difficult', '2', '難しかったことは？', '迷ったこと、うまくいかなかったことも大切な発見だよ'],
            ['next', '3', '次に試してみたいことは？', 'もう一度できるなら、変えたいことや試したいこと'],
          ].map(([key, number, title, hint]) => <label className="reflection-question" key={key}>
            <span className="question-number">{number}</span><span className="question-copy"><strong>{title}</strong><small>{hint}</small></span>
            <textarea value={reflection[key]} onChange={(event) => setReflection((current) => ({ ...current, [key]: event.target.value }))} maxLength="1000" rows="3" placeholder="ここに書いてね…" />
          </label>)}
          {reflectionError && <p className="error-message">{reflectionError}</p>}
          <button className="discover-button" type="submit" disabled={Object.values(reflection).some((answer) => !answer.trim()) || isGenerating}>{isGenerating ? 'ミライが整理しています…' : '今回の発見を見る'} <span>✦</span></button>
        </form>}
      </section>}
    </main>
  )
}

export default App
