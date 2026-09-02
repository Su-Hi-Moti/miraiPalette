import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import './FacilitatorView.css'

const parseReflection = (content) => {
  try {
    const value = JSON.parse(content)
    return [value.enjoyed, value.difficult, value.next].filter(Boolean)
  } catch { return content ? [content] : [] }
}

const formatDate = (value) => value ? new Intl.DateTimeFormat('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '日時未設定'

export default function FacilitatorView({ onBack }) {
  const [children, setChildren] = useState([])
  const [selectedChildId, setSelectedChildId] = useState('')
  const [records, setRecords] = useState([])
  const [missionFilter, setMissionFilter] = useState('all')
  const [notes, setNotes] = useState({})
  const [savedNotes, setSavedNotes] = useState({})
  const [savingSessionId, setSavingSessionId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedChild = children.find((child) => child.id === selectedChildId)
  const visibleRecords = useMemo(() => missionFilter === 'all' ? records : records.filter((record) => record.mission_id === missionFilter), [records, missionFilter])
  const missionOptions = useMemo(() => [...new Map(records.map((record) => [record.mission_id, record.missions])).entries()], [records])

  useEffect(() => {
    const loadChildren = async () => {
      setIsLoading(true); setError('')
      const { data, error: loadError } = await supabase.from('children').select('id, name, grade').order('name')
      if (loadError) setError(loadError.message)
      else { setChildren(data || []); if (data?.[0]) setSelectedChildId(data[0].id) }
      setIsLoading(false)
    }
    loadChildren()
  }, [])

  useEffect(() => {
    if (!selectedChildId) return
    let ignore = false
    const loadHistory = async () => {
      setIsLoading(true); setError(''); setMissionFilter('all')
      const { data: sessions, error: sessionError } = await supabase
        .from('mission_sessions')
        .select('id, child_id, mission_id, status, started_at, completed_at, created_at, missions(id, title, theme, description)')
        .eq('child_id', selectedChildId).order('created_at', { ascending: false })
      if (sessionError) { if (!ignore) setError(sessionError.message); setIsLoading(false); return }
      const ids = (sessions || []).map((session) => session.id)
      if (!ids.length) { if (!ignore) { setRecords([]); setIsLoading(false) }; return }
      const [messagesResult, reflectionsResult, notesResult, analysesResult] = await Promise.all([
        supabase.from('chat_messages').select('id, session_id, role, content, created_at').in('session_id', ids).order('created_at'),
        supabase.from('reflections').select('id, session_id, content, updated_at').in('session_id', ids),
        supabase.from('facilitator_notes').select('id, session_id, content, updated_at').in('session_id', ids),
        supabase.from('analyses').select('id, session_id, analysis_type, content, created_at').eq('child_id', selectedChildId),
      ])
      const firstError = [messagesResult, reflectionsResult, notesResult, analysesResult].find((result) => result.error)?.error
      if (firstError) { if (!ignore) setError(firstError.message); setIsLoading(false); return }
      const group = (items, key = 'session_id') => (items || []).reduce((map, item) => ({ ...map, [item[key]]: [...(map[item[key]] || []), item] }), {})
      const messagesBySession = group(messagesResult.data)
      const reflectionsBySession = group(reflectionsResult.data)
      const notesBySession = group(notesResult.data)
      const analysesBySession = group((analysesResult.data || []).filter((analysis) => analysis.session_id))
      const nextRecords = sessions.map((session) => ({ ...session, messages: messagesBySession[session.id] || [], reflection: reflectionsBySession[session.id]?.at(-1), note: notesBySession[session.id]?.at(-1), analyses: analysesBySession[session.id] || [] }))
      if (!ignore) {
        setRecords(nextRecords)
        const initialNotes = Object.fromEntries(nextRecords.map((record) => [record.id, record.note?.content || '']))
        setNotes(initialNotes); setSavedNotes(initialNotes); setIsLoading(false)
      }
    }
    loadHistory()
    return () => { ignore = true }
  }, [selectedChildId])

  const saveNote = async (record) => {
    const content = (notes[record.id] || '').trim()
    if (!content) return
    setSavingSessionId(record.id); setError('')
    const query = record.note
      ? supabase.from('facilitator_notes').update({ content, updated_at: new Date().toISOString() }).eq('id', record.note.id)
      : supabase.from('facilitator_notes').insert({ session_id: record.id, content })
    const { data, error: saveError } = await query.select('id, session_id, content, updated_at').single()
    if (saveError) setError(saveError.message)
    else {
      setSavedNotes((current) => ({ ...current, [record.id]: content }))
      setRecords((current) => current.map((item) => item.id === record.id ? { ...item, note: data } : item))
    }
    setSavingSessionId('')
  }

  return <main className="facilitator-shell">
    <header className="facilitator-topbar"><div className="facilitator-brand"><span>M</span><div><small>FACILITATOR</small><strong>ミライパレット 運営</strong></div></div><button type="button" onClick={onBack}>子ども画面へ</button></header>
    <div className="facilitator-layout">
      <aside className="children-sidebar"><p className="facilitator-eyebrow">CHILDREN</p><h1>子ども一覧</h1>{children.map((child) => <button type="button" key={child.id} className={child.id === selectedChildId ? 'selected' : ''} onClick={() => setSelectedChildId(child.id)}><span>{child.name.slice(0, 1)}</span><div><strong>{child.name}</strong><small>小学{child.grade}年生</small></div></button>)}</aside>
      <section className="history-area">
        <div className="history-header"><div><p className="facilitator-eyebrow">LEARNING HISTORY</p><h2>{selectedChild?.name || '子ども'}さんの活動履歴</h2></div><select value={missionFilter} onChange={(event) => setMissionFilter(event.target.value)}><option value="all">すべてのミッション</option>{missionOptions.map(([id, mission]) => <option key={id} value={id}>{mission?.title}</option>)}</select></div>
        {error && <div className="admin-error">{error}</div>}
        {isLoading ? <div className="admin-empty">読み込んでいます…</div> : !visibleRecords.length ? <div className="admin-empty">活動記録がまだありません</div> : visibleRecords.map((record) => <article className="session-card" key={record.id}>
          <div className="session-title"><div><span className={`session-status ${record.status}`}>{record.status === 'completed' ? '完了' : record.status === 'in_progress' ? '進行中' : '予定'}</span><h3>{record.missions?.title || 'ミッション'}</h3><p>{record.missions?.theme} ・ {formatDate(record.completed_at || record.started_at || record.created_at)}</p></div><span className="message-count">会話 {record.messages.length}件</span></div>
          <div className="record-grid"><section><h4>AIとの会話</h4><div className="mini-chat">{record.messages.length ? record.messages.slice(-6).map((message) => <p key={message.id} className={message.role}><b>{message.role === 'user' ? '子ども' : 'AI'}</b>{message.content}</p>) : <small>会話記録なし</small>}</div></section><section><h4>振り返り</h4>{record.reflection ? <ul>{parseReflection(record.reflection.content).map((item) => <li key={item}>{item}</li>)}</ul> : <small>振り返りなし</small>}<h4 className="finding-heading">今回の発見</h4><p className="finding-summary">{record.analyses.find((analysis) => analysis.analysis_type === 'session_finding')?.content || '分析結果なし'}</p></section></div>
          <div className="note-area"><label htmlFor={`note-${record.id}`}>授業後メモ</label><textarea id={`note-${record.id}`} value={notes[record.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))} rows="3" placeholder="様子や気づきを短く記録…" maxLength="2000"/><div><span>{savedNotes[record.id] === notes[record.id] && notes[record.id] ? '保存済み' : ''}</span><button type="button" disabled={!notes[record.id]?.trim() || savedNotes[record.id] === notes[record.id] || savingSessionId === record.id} onClick={() => saveNote(record)}>{savingSessionId === record.id ? '保存中…' : 'メモを保存'}</button></div></div>
        </article>)}
      </section>
    </div>
  </main>
}
