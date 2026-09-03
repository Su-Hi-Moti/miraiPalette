import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { useAuth } from './useAuth'
import miraiPaletteIcon from './assets/mirai-palette-logo.png'
import miraiRobotIcon from './assets/mirai-robot.png'
import './App.css'

const demoReplies = ['いい考えだね！どうしてそう思ったの？', 'なるほど。どの部分から試してみたい？', 'おもしろそう！強くするために、どんな形が使えそう？', 'その考えを、小さく試すとしたら何ができるかな？']
const suggestions = ['ヒントをちょうだい', 'もっと簡単に説明して', 'クイズを出して']
const demoMonthlyMission = {
  month: '9月',
  title: '丈夫な橋を設計しよう',
  description: '観察して、考えて、作って、伝える。4週間で自分だけの橋を完成させよう。',
  weeks: [
    { number: 1, title: '身近な橋を観察しよう', description: '橋の形や支え方を見つける', status: 'done' },
    { number: 2, title: '強くなる形を考えよう', description: '形と材料の組み合わせを考える', status: 'current' },
    { number: 3, title: '作って、強さを試そう', description: '模型を作って実験する', status: 'upcoming' },
    { number: 4, title: '発見をみんなに伝えよう', description: '結果をまとめて振り返る', status: 'upcoming' },
  ],
}
const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`
const createOpeningMessage = (week) => ({
  id: `welcome-${week.id || week.number}`,
  role: 'assistant',
  content: `こんにちは！第${week.number}週は「${week.title}」に取り組もう。${week.description}。まず、今考えていることを聞かせてくれる？`,
})

function ChildView() {
  const { session: authSession, profile, linkedChildId, isLoading: isAuthLoading } = useAuth()
  const [screen, setScreen] = useState('overview')
  const [monthlyMission, setMonthlyMission] = useState(demoMonthlyMission)
  const [selectedWeek, setSelectedWeek] = useState(demoMonthlyMission.weeks[1])
  const [messages, setMessages] = useState([])
  const [activeSessionId, setActiveSessionId] = useState('')
  const [isMissionLoading, setIsMissionLoading] = useState(true)
  const [missionLoadError, setMissionLoadError] = useState('')
  const [openingWeekId, setOpeningWeekId] = useState('')
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
  const demoSessionId = import.meta.env.VITE_DEMO_SESSION_ID
  const demoChildId = import.meta.env.VITE_DEMO_CHILD_ID
  const sessionId = activeSessionId || demoSessionId
  const isDemo = !supabaseUrl || !supabaseAnonKey

  const apiHeaders = { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${authSession?.access_token || supabaseAnonKey}` }

  useEffect(() => {
    if (isAuthLoading) return
    let ignore = false
    const loadMonthlyMission = async () => {
      if (isDemo) {
        setMonthlyMission(demoMonthlyMission)
        setSelectedWeek(demoMonthlyMission.weeks.find((week) => week.status === 'current') || demoMonthlyMission.weeks[0])
        setIsMissionLoading(false)
        return
      }

      setIsMissionLoading(true)
      setMissionLoadError('')
      try {
        let childId = profile?.child_id || linkedChildId || demoChildId
        if (!childId && demoSessionId) {
          const { data: demoSession, error: demoSessionError } = await supabase.from('mission_sessions').select('child_id').eq('id', demoSessionId).maybeSingle()
          if (demoSessionError) throw demoSessionError
          childId = demoSession?.child_id
        }
        if (!childId) throw new Error('ログイン中のアカウントに子どもIDが設定されていません')

        const today = new Date().toISOString().slice(0, 10)
        const { data: assignment, error: assignmentError } = await supabase
          .from('child_monthly_missions')
          .select('id, status, monthly_missions!inner(id, title, description, starts_on, ends_on, status)')
          .eq('child_id', childId)
          .eq('monthly_missions.status', 'published')
          .lte('monthly_missions.starts_on', today)
          .gte('monthly_missions.ends_on', today)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (assignmentError) throw assignmentError
        if (!assignment?.monthly_missions) throw new Error('今月のミッションが割り当てられていません')

        const monthRecord = assignment.monthly_missions
        const { data: weekRecords, error: weeksError } = await supabase
          .from('missions')
          .select('id, title, description, week_number, opens_on, closes_on')
          .eq('monthly_mission_id', monthRecord.id)
          .order('week_number')
        if (weeksError) throw weeksError

        const missionIds = (weekRecords || []).map((week) => week.id)
        let sessions = []
        if (missionIds.length) {
          const { data: sessionRecords, error: sessionsError } = await supabase
            .from('mission_sessions')
            .select('id, mission_id, status')
            .eq('child_id', childId)
            .in('mission_id', missionIds)
          if (sessionsError) throw sessionsError
          sessions = sessionRecords || []
        }

        const sessionsByMission = new Map(sessions.map((item) => [item.mission_id, item]))
        const weeks = (weekRecords || []).map((week) => {
          const weekSession = sessionsByMission.get(week.id)
          return {
            id: week.id,
            number: week.week_number,
            title: week.title,
            description: week.description,
            opensOn: week.opens_on,
            closesOn: week.closes_on,
            sessionId: weekSession?.id || '',
            sessionStatus: weekSession?.status || 'planned',
            status: weekSession?.status === 'completed' ? 'done' : weekSession?.status === 'in_progress' ? 'current' : 'upcoming',
          }
        })
        if (!weeks.some((week) => week.status === 'current')) {
          const nextWeek = weeks.find((week) => week.status !== 'done')
          if (nextWeek) nextWeek.status = 'current'
        }

        const monthLabel = new Date(`${monthRecord.starts_on}T00:00:00`).toLocaleDateString('ja-JP', { month: 'long' })
        const nextMission = { ...monthRecord, month: monthLabel, weeks }
        if (!ignore) {
          setMonthlyMission(nextMission)
          setSelectedWeek(weeks.find((week) => week.status === 'current') || weeks[0])
        }
      } catch (loadError) {
        if (!ignore) setMissionLoadError(loadError.message)
      } finally {
        if (!ignore) setIsMissionLoading(false)
      }
    }
    void loadMonthlyMission()
    return () => { ignore = true }
  }, [demoChildId, demoSessionId, isAuthLoading, isDemo, linkedChildId, profile?.child_id])

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

  const openWeek = async (week) => {
    if (!week || openingWeekId) return
    setOpeningWeekId(week.id || String(week.number))
    setMissionLoadError('')
    try {
      let nextSessionId = week.sessionId || ''
      let history = []
      if (!isDemo) {
        let childId = profile?.child_id || linkedChildId || demoChildId
        if (!childId && demoSessionId) {
          const { data: demoSession, error: demoSessionError } = await supabase.from('mission_sessions').select('child_id').eq('id', demoSessionId).maybeSingle()
          if (demoSessionError) throw demoSessionError
          childId = demoSession?.child_id
        }
        if (!childId) throw new Error('子どもIDを取得できませんでした')

        if (!nextSessionId) {
          const { data: createdSession, error: createError } = await supabase
            .from('mission_sessions')
            .insert({ child_id: childId, mission_id: week.id, status: 'in_progress', started_at: new Date().toISOString() })
            .select('id')
            .single()
          if (createError) throw createError
          nextSessionId = createdSession.id
        } else if (week.sessionStatus === 'planned') {
          const { error: updateError } = await supabase
            .from('mission_sessions')
            .update({ status: 'in_progress', started_at: new Date().toISOString() })
            .eq('id', nextSessionId)
          if (updateError) throw updateError
        }

        const { data: savedMessages, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, role, content, created_at')
          .eq('session_id', nextSessionId)
          .order('created_at')
        if (messagesError) throw messagesError
        history = savedMessages || []
      }

      const activeWeek = { ...week, sessionId: nextSessionId, sessionStatus: 'in_progress', status: 'current' }
      setSelectedWeek(activeWeek)
      setActiveSessionId(nextSessionId)
      setMonthlyMission((current) => ({ ...current, weeks: current.weeks.map((item) => item.id === week.id || item.number === week.number ? activeWeek : item) }))
      setMessages(history.length ? history : [createOpeningMessage(activeWeek)])
      setScreen('chat')
    } catch (openError) {
      setMissionLoadError(openError.message)
    } finally {
      setOpeningWeekId('')
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || isSending) return
    if (!isDemo && !sessionId) {
      setError('ミッションのセッションを開始できていません')
      return
    }
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

  const currentWeek = monthlyMission.weeks.find((week) => week.status === 'current') || monthlyMission.weeks.find((week) => week.status !== 'done') || monthlyMission.weeks[0]
  const completedWeeks = monthlyMission.weeks.filter((week) => week.status === 'done').length

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="ミライパレット ホーム"><img className="brand-mark" src={miraiPaletteIcon} alt="" /><span>ミライパレット</span></a>
          <div className="profile"><span className="avatar">た</span><span className="profile-name">デモ太郎</span></div>
        </div>
      </header>
      {screen === 'overview' ? <section className="mission-overview retro-window">
        <div className="window-bar coral"><strong>{monthlyMission.month}のミッション</strong><span className="window-controls">－ □ ×</span></div>
        {isMissionLoading && <div className="mission-state">今月のミッションを読み込んでいます…</div>}
        {missionLoadError && <div className="mission-error" role="alert"><strong>ミッションを読み込めませんでした</strong><span>{missionLoadError}</span></div>}
        <div className="mission-hero">
          <div className="month-stamp"><span>{monthlyMission.month}</span><strong>月間</strong></div>
          <div><p className="section-label">今月のミッション</p><h1>{monthlyMission.title}</h1><p>{monthlyMission.description}</p></div>
          <div className="month-progress"><strong>{completedWeeks} / {monthlyMission.weeks.length}</strong><span>週間 完了</span></div>
        </div>
        <div className="month-progress-line" aria-label={`${monthlyMission.weeks.length}週間のうち${completedWeeks}週間完了`}>{monthlyMission.weeks.map((week, index) => <i className={index < completedWeeks ? 'completed' : ''} key={week.id || week.number} />)}</div>
        <div className="week-grid">
          {monthlyMission.weeks.map((week) => <button className={`week-card ${week.status}`} type="button" key={week.id || week.number} onClick={() => openWeek(week)} disabled={Boolean(openingWeekId)}>
            <span className="week-number">第{week.number}週</span>
            <span className="week-status">{week.status === 'done' ? '✓ 完了' : week.status === 'current' ? '● 取組中' : '○ これから'}</span>
            <strong>{week.title}</strong>
            <small>{week.description}</small>
            <span className="week-open">{openingWeekId === (week.id || String(week.number)) ? '読み込み中…' : week.status === 'current' ? 'つづきから →' : '見る →'}</span>
          </button>)}
        </div>
        {currentWeek && <div className="current-mission-callout">
          <div><span>今週はここ！</span><strong>{currentWeek.title}</strong></div>
          <button type="button" onClick={() => openWeek(currentWeek)} disabled={Boolean(openingWeekId)}>{openingWeekId ? '読み込み中…' : 'ミライと始める →'}</button>
        </div>}
      </section> : screen === 'chat' ? <div className="learning-workspace">
        <div className="main-column">
          <section className="chat-panel retro-window">
            <div className="window-bar blue"><div><span className="online-dot" />ミライ学習アシスタント</div><span className="window-controls">－ □ ×</span></div>
            <div className="chat-heading">
              <div><p className="section-label">{monthlyMission.month}のミッション・第{selectedWeek.number}週</p><h1>{selectedWeek.title}</h1></div>
              <div className="chat-actions"><button className="overview-link" type="button" onClick={() => setScreen('overview')}>月間一覧</button><button className="reflection-link" type="button" onClick={() => setScreen('reflection')}>振り返り →</button></div>
            </div>
            <div className="messages" aria-live="polite">
              {messages.map((message) => (
                <article key={message.id} className={`message-row ${message.role}`}>
                  {message.role === 'assistant' && <img className="ai-avatar" src={miraiRobotIcon} alt="" />}
                  <div className="message-copy"><p className="speaker">{message.role === 'assistant' ? 'ミライ' : 'あなた'}</p><div className="bubble">{message.content}</div></div>
                  {message.role === 'user' && <span className="user-avatar" aria-hidden="true">☺</span>}
                </article>
              ))}
              {isSending && <article className="message-row assistant"><img className="ai-avatar" src={miraiRobotIcon} alt="" /><div className="message-copy"><p className="speaker">ミライ</p><div className="bubble typing" aria-label="考え中"><i /><i /><i /></div></div></article>}
              <div ref={messagesEndRef} />
            </div>
            <form className="composer" onSubmit={sendMessage}>
              {error && <p className="error-message">{error}</p>}
              <div className="input-row">
                <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="メッセージを入力" aria-label="メッセージ" rows="1" maxLength="2000" />
                <button type="submit" disabled={!input.trim() || isSending} aria-label="送信する">➤</button>
              </div>
              <div className="suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div>
            </form>
          </section>

          <section className="mastery-window retro-window" aria-label="学習の進み具合">
            <div className="window-bar yellow"><strong>学習の進み具合</strong><span>×</span></div>
            <div className="mastery-content"><span>橋のしくみ</span><div className="pixel-progress" aria-label="65パーセント"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><strong>65%</strong><button type="button">OK</button></div>
          </section>
        </div>
      </div> : <section className="reflection-panel retro-window">
        <div className="window-bar coral"><strong>振り返り</strong><span className="window-controls">－ □ ×</span></div>
        <div className="reflection-heading">
          <button className="back-button" type="button" onClick={() => setScreen('chat')}>← 会話に戻る</button>
          <p className="section-label">振り返り</p>
          <h2>今日のことを振り返ろう</h2>
          <p>うまく書こうとしなくて大丈夫。感じたことを自分の言葉で教えてね。</p>
        </div>

        {isReflectionLoading ? <div className="reflection-loading">振り返りを読み込んでいます…</div> : finding ? <div className="finding-view">
          <p className="section-label">まとめ</p>
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
          <button className="discover-button" type="submit" disabled={Object.values(reflection).some((answer) => !answer.trim()) || isGenerating}>{isGenerating ? 'ミライが整理しています…' : '今回の発見を見る'}</button>
        </form>}
      </section>}
    </main>
  )
}

export default ChildView
