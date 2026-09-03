import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import './ParentReport.css'

function ParentReport() {
  const { linkedChildId, session } = useAuth()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const getApiHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    }),
    [supabaseAnonKey, session?.access_token],
  )

  useEffect(() => {
    if (!linkedChildId) return

    const loadReports = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/parent-report?child_id=${linkedChildId}`,
          {
            headers: getApiHeaders(),
          },
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.error || 'レポートを取得できませんでした',
          )
        }

        setData(result)
      } catch (loadError) {
        setError(loadError.message)
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [linkedChildId, supabaseUrl, getApiHeaders])

  const updateLatestReport = async () => {
    if (!linkedChildId) return

    setUpdating(true)
    setError('')

    try {
      const updateResponse = await fetch(
        `${supabaseUrl}/functions/v1/parent-report`,
        {
          method: 'POST',
          headers: getApiHeaders(),
          body: JSON.stringify({
            child_id: linkedChildId,
          }),
        },
      )

      const updateResult = await updateResponse.json()

      if (!updateResponse.ok) {
        throw new Error(
          updateResult.error ||
            '最新の内容に更新できませんでした',
        )
      }

      const reloadResponse = await fetch(
        `${supabaseUrl}/functions/v1/parent-report?child_id=${linkedChildId}`,
        {
          headers: getApiHeaders(),
        },
      )

      const reloadResult = await reloadResponse.json()

      if (!reloadResponse.ok) {
        throw new Error(
          reloadResult.error ||
            'レポートを再取得できませんでした',
        )
      }

      setData(reloadResult)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setUpdating(false)
    }
  }

  if (!linkedChildId) {
    return (
      <main className="parent-page">
        エラー: 紐づいている子どもの情報がありません
      </main>
    )
  }

  if (loading) {
    return (
      <main className="parent-page">
        レポートを読み込んでいます...
      </main>
    )
  }

  if (error) {
    return (
      <main className="parent-page">
        エラー: {error}
      </main>
    )
  }

  const reports = data?.reports ?? []
  const latest = reports[0]
  const report = latest?.content

  return (
    <main className="parent-page">
      <header className="parent-header">
        <div>
          <p className="parent-eyebrow">
            PARENT REPORT
          </p>

          <h1>
            {data?.child?.name}さんの活動レポート
          </h1>

          <p>{data?.child?.grade}年生</p>
        </div>

        <div className="parent-header-actions">
          <button
            type="button"
            onClick={updateLatestReport}
            disabled={updating}
          >
            {updating
              ? '更新しています...'
              : '最新の内容に更新'}
          </button>
        </div>
      </header>

      {!report ? (
        <section className="report-card">
          <p>まだレポートがありません。</p>
        </section>
      ) : (
        <>
          <section className="report-card report-hero">
            <p className="parent-eyebrow">
              LATEST ACTIVITY
            </p>

            <h2>{report.title}</h2>
            <p>{report.summary}</p>
          </section>

          <section className="report-grid">
            <article className="report-card">
              <h3>今回の活動</h3>
              <p>{report.current_activity}</p>
            </article>

            <article className="report-card">
              <h3>楽しかったこと・難しかったこと</h3>
              <p>{report.enjoyed_and_challenged}</p>
            </article>

            <article className="report-card">
              <h3>考え方から見えたこと</h3>
              <p>{report.thinking_seen}</p>
            </article>

            <article className="report-card">
              <h3>ファシリテーター所感</h3>
              <p>{report.facilitator_view}</p>
            </article>
          </section>

          <section className="report-card">
            <h3>継続して見えていること</h3>

            <ul>
              {report.continuing_patterns?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="report-card">
            <h3>最近の変化</h3>

            <ul>
              {report.recent_changes?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="report-card">
            <h3>次に試してみたい体験</h3>

            <ul>
              {report.next_experiences?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="report-card conversation-card">
            <h3>
              おうちでこんな会話をしてみませんか？
            </h3>

            {report.parent_child_conversation?.map((item) => (
              <p key={item}>「{item}」</p>
            ))}
          </section>

          <section className="report-card">
            <h3>これまでのレポート</h3>

            {reports.map((savedReport) => (
              <div
                className="past-report"
                key={savedReport.id}
              >
                <strong>
                  {savedReport.content?.title ??
                    '活動レポート'}
                </strong>

                <span>
                  {new Date(
                    savedReport.created_at,
                  ).toLocaleDateString('ja-JP')}
                </span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  )
}

export default ParentReport