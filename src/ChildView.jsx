import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import miraiPaletteIcon from './assets/mirai-palette-logo.png'
import miraiRobotIcon from './assets/mirai-robot.png'
import './App.css'

const initialMessages = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'こんにちは！きょうのミッションについて、いっしょに考えよう。まず、どんな橋を作ってみたい？',
  },
]

const demoReplies = [
  'いい考えだね！どうしてそう思ったの？',
  'なるほど。どの部分から試してみたい？',
  'おもしろそう！強くするために、どんな形が使えそう？',
  'その考えを、小さく試すとしたら何ができるかな？',
]

const suggestions = [
  'ヒントをちょうだい',
  'もっと簡単に説明して',
  'クイズを出して',
]

const createMessageId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`

function ChildView() {
  const [screen, setScreen] = useState('chat')
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [reflection, setReflection] = useState({
    enjoyed: '',
    difficult: '',
    next: '',
  })
  const [finding, setFinding] = useState('')
  const [reflectionError, setReflectionError] = useState('')
  const [isReflectionLoading, setIsReflectionLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const messagesEndRef = useRef(null)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const sessionId = import.meta.env.VITE_DEMO_SESSION_ID

  const isDemo = !supabaseUrl || !supabaseAnonKey || !sessionId

  const getApiHeaders = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    return {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    }
  }, [supabaseAnonKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  useEffect(() => {
    if (screen !== 'reflection' || isDemo) return

    let ignore = false

    const loadReflection = async () => {
      setIsReflectionLoading(true)
      setReflectionError('')

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/reflection-insight?session_id=${sessionId}`,
          {
            headers: await getApiHeaders(),
          },
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || '振り返りを読み込めませんでした')
        }

        if (!ignore && data.reflection?.answers) {
          setReflection(data.reflection.answers)
        }

        if (!ignore && data.finding?.content) {
          setFinding(data.finding.content)
        }
      } catch (loadError) {
        if (!ignore) {
          setReflectionError(loadError.message)
        }
      } finally {
        if (!ignore) {
          setIsReflectionLoading(false)
        }
      }
    }

    loadReflection()

    return () => {
      ignore = true
    }
  }, [screen, isDemo, sessionId, supabaseUrl, getApiHeaders])

  const getDemoReply = (message) => {
    if (message.includes('三角')) {
      return '三角形を、橋のどの部分に使ってみたい？'
    }

    if (message.includes('強')) {
      return '強い橋にするには、どこを工夫できそう？'
    }

    return demoReplies[(messages.length - 1) % demoReplies.length]
  }

  const sendMessage = async (event) => {
    event.preventDefault()

    const message = input.trim()

    if (!message || isSending) return

    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: 'user',
        content: message,
      },
    ])

    setInput('')
    setError('')
    setIsSending(true)

    try {
      let reply

      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 650))
        reply = getDemoReply(message)
      } else {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/mission-chat`,
          {
            method: 'POST',
            headers: await getApiHeaders(),
            body: JSON.stringify({
              session_id: sessionId,
              message,
            }),
          },
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'AIとの通信に失敗しました')
        }

        reply = data.message
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: reply,
        },
      ])
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setIsSending(false)
    }
  }

  const submitReflection = async (event) => {
    event.preventDefault()

    if (
      Object.values(reflection).some((answer) => !answer.trim()) ||
      isGenerating
    ) {
      return
    }

    setIsGenerating(true)
    setReflectionError('')

    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 900))

        setFinding(
          `橋を強くするために、形を変えながら試すことができたね。難しかったところも言葉にできたから、次は「${reflection.next}」を小さく試してみよう。`,
        )
      } else {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/reflection-insight`,
          {
            method: 'POST',
            headers: await getApiHeaders(),
            body: JSON.stringify({
              session_id: sessionId,
              reflection,
            }),
          },
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error || '今回の発見を生成できませんでした',
          )
        }

        setFinding(data.finding.content)
      }
    } catch (submitError) {
      setReflectionError(submitError.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a
            className="brand"
            href="/"
            aria-label="ミライパレット ホーム"
          >
            <img
              className="brand-mark"
              src={miraiPaletteIcon}
              alt=""
            />
            <span>ミライパレット</span>
          </a>

          <div className="profile">
            <span className={`mode-badge ${isDemo ? 'demo' : ''}`}>
              <span className="status-dot" />
              {isDemo ? 'デモ表示' : '接続中'}
            </span>

            <span className="avatar">た</span>
            <span className="profile-name">デモ太郎</span>
          </div>
        </div>
      </header>

      {screen === 'chat' ? (
        <div className="learning-workspace">
          <div className="main-column">
            <section className="chat-panel retro-window">
              <div className="window-bar blue">
                <div>
                  <span className="online-dot" />
                  ミライ学習アシスタント
                </div>
                <span className="window-controls">－ □ ×</span>
              </div>

              <div className="chat-heading">
                <div>
                  <p className="section-label">今日のミッション</p>
                  <h1>強い橋を作ろう</h1>
                </div>

                <button
                  className="reflection-link"
                  type="button"
                  onClick={() => setScreen('reflection')}
                >
                  振り返り →
                </button>
              </div>

              <div className="messages" aria-live="polite">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message-row ${message.role}`}
                  >
                    {message.role === 'assistant' && (
                      <img
                        className="ai-avatar"
                        src={miraiRobotIcon}
                        alt=""
                      />
                    )}

                    <div className="message-copy">
                      <p className="speaker">
                        {message.role === 'assistant'
                          ? 'ミライ'
                          : 'あなた'}
                      </p>

                      <div className="bubble">
                        {message.content}
                      </div>
                    </div>

                    {message.role === 'user' && (
                      <span
                        className="user-avatar"
                        aria-hidden="true"
                      >
                        ☺
                      </span>
                    )}
                  </article>
                ))}

                {isSending && (
                  <article className="message-row assistant">
                    <img
                      className="ai-avatar"
                      src={miraiRobotIcon}
                      alt=""
                    />

                    <div className="message-copy">
                      <p className="speaker">ミライ</p>

                      <div
                        className="bubble typing"
                        aria-label="考え中"
                      >
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </article>
                )}

                <div ref={messagesEndRef} />
              </div>

              <form
                className="composer"
                onSubmit={sendMessage}
              >
                {error && (
                  <p className="error-message">{error}</p>
                )}

                <div className="input-row">
                  <textarea
                    value={input}
                    onChange={(event) =>
                      setInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === 'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault()
                        event.currentTarget.form?.requestSubmit()
                      }
                    }}
                    placeholder="メッセージを入力"
                    aria-label="メッセージ"
                    rows="1"
                    maxLength="2000"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isSending}
                    aria-label="送信する"
                  >
                    ➤
                  </button>
                </div>

                <div className="suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : (
        <section className="reflection-panel retro-window">
          <div className="window-bar coral">
            <strong>振り返り</strong>
            <span className="window-controls">－ □ ×</span>
          </div>

          <div className="reflection-heading">
            <button
              className="back-button"
              type="button"
              onClick={() => setScreen('chat')}
            >
              ← 会話に戻る
            </button>

            <p className="section-label">振り返り</p>
            <h2>今日のことを振り返ろう</h2>
            <p>
              うまく書こうとしなくて大丈夫。感じたことを自分の言葉で教えてね。
            </p>
          </div>

          {isReflectionLoading ? (
            <div className="reflection-loading">
              振り返りを読み込んでいます…
            </div>
          ) : finding ? (
            <div className="finding-view">
              <p className="section-label">まとめ</p>
              <h2>今回の発見</h2>

              <p className="finding-text">
                {finding}
              </p>

              <div className="finding-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setFinding('')}
                >
                  振り返りを編集
                </button>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setScreen('chat')}
                >
                  会話を見返す
                </button>
              </div>
            </div>
          ) : (
            <form
              className="reflection-form"
              onSubmit={submitReflection}
            >
              {[
                [
                  'enjoyed',
                  '1',
                  'いちばん楽しかったことは？',
                  '作っているとき、話しているときに「いいな」と思ったこと',
                ],
                [
                  'difficult',
                  '2',
                  '難しかったことは？',
                  '迷ったこと、うまくいかなかったことも大切な発見だよ',
                ],
                [
                  'next',
                  '3',
                  '次に試してみたいことは？',
                  'もう一度できるなら、変えたいことや試したいこと',
                ],
              ].map(([key, number, title, hint]) => (
                <label
                  className="reflection-question"
                  key={key}
                >
                  <span className="question-number">
                    {number}
                  </span>

                  <span className="question-copy">
                    <strong>{title}</strong>
                    <small>{hint}</small>
                  </span>

                  <textarea
                    value={reflection[key]}
                    onChange={(event) =>
                      setReflection((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    maxLength="1000"
                    rows="3"
                    placeholder="ここに書いてね…"
                  />
                </label>
              ))}

              {reflectionError && (
                <p className="error-message">
                  {reflectionError}
                </p>
              )}

              <button
                className="discover-button"
                type="submit"
                disabled={
                  Object.values(reflection).some(
                    (answer) => !answer.trim(),
                  ) || isGenerating
                }
              >
                {isGenerating
                  ? 'ミライが整理しています…'
                  : '今回の発見を見る'}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  )
}

export default ChildView