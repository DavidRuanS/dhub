import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import type { EventItem } from './types'

type EventTarget = { event: EventItem; target: HTMLElement }
type EventDraft = {
  title: string
  event_date: string
  event_time: string
  all_day: boolean
  category: string
  location: string
  notes: string
}

const LOCAL_STATE_KEY = 'dhub-state-v1'

function formattedDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
}

function eventSubtitle(event: EventItem) {
  return `${formattedDate(event.event_date)} · ${event.event_time || 'Dia todo'} · ${event.category}${event.notes ? ` · ${event.notes}` : ''}`
}

function splitNotes(value: string) {
  const parts = value.split(' | ')
  const first = parts[0] || ''
  if (!first.startsWith('Local: ')) return { location: '', notes: value }
  return { location: first.slice(7), notes: parts.slice(1).join(' | ') }
}

function updateLocalEvent(id: string, patch: Partial<EventItem>) {
  try {
    const state = JSON.parse(localStorage.getItem(LOCAL_STATE_KEY) || '{}')
    if (!Array.isArray(state.events)) return
    state.events = state.events.map((event: EventItem) => event.id === id ? { ...event, ...patch } : event)
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state))
  } catch {
    // Supabase remains the source of truth when local cache is unavailable.
  }
}

export default function AgendaEditEnhancer() {
  const [targets, setTargets] = useState<EventTarget[]>([])
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer = 0

    const refresh = async () => {
      if (!supabase || cancelled) return
      const sections = Array.from(document.querySelectorAll<HTMLElement>('.app main section'))
      const agenda = sections.find(section => section.querySelector('h1')?.textContent?.trim() === 'Agenda')
      if (!agenda) {
        setTargets([])
        return
      }

      const rows = Array.from(agenda.querySelectorAll<HTMLElement>('.list > .row'))
      if (!rows.length) {
        setTargets([])
        return
      }

      const { data, error: readError } = await supabase
        .from('events')
        .select('id,title,event_date,event_time,category,notes,created_at')
        .order('event_date', { ascending: true })
        .order('created_at', { ascending: true })

      if (cancelled || readError || !data) return
      const events = data as EventItem[]
      const used = new Set<string>()
      const nextTargets: EventTarget[] = []

      for (const row of rows) {
        const title = row.querySelector<HTMLElement>(':scope > div > b')?.textContent?.trim() || ''
        const subtitle = row.querySelector<HTMLElement>(':scope > div > small')?.textContent?.trim() || ''
        const event = events.find(item => !used.has(item.id) && item.title === title && eventSubtitle(item) === subtitle)
          || events.find(item => !used.has(item.id) && item.title === title && subtitle.startsWith(formattedDate(item.event_date)))
        const target = row.querySelector<HTMLElement>(':scope > aside')
        if (!event || !target) continue
        used.add(event.id)
        nextTargets.push({ event, target })
      }

      setTargets(nextTargets)
    }

    const scheduleRefresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, 120)
    }

    scheduleRefresh()
    const observer = new MutationObserver(scheduleRefresh)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  function openEditor(event: EventItem) {
    const parsed = splitNotes(event.notes || '')
    setEditing(event)
    setDraft({
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time?.slice(0, 5) || '',
      all_day: !event.event_time,
      category: event.category || 'Pessoal',
      location: parsed.location,
      notes: parsed.notes,
    })
    setError('')
  }

  function closeEditor() {
    if (saving) return
    setEditing(null)
    setDraft(null)
    setError('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !editing || !draft) return
    if (!draft.title.trim() || !draft.event_date) {
      setError('Preencha o compromisso e a data.')
      return
    }
    if (!draft.all_day && !draft.event_time) {
      setError('Informe o horário ou marque Dia todo.')
      return
    }

    const notes = [draft.location.trim() ? `Local: ${draft.location.trim()}` : '', draft.notes.trim()]
      .filter(Boolean)
      .join(' | ')
    const patch = {
      title: draft.title.trim(),
      event_date: draft.event_date,
      event_time: draft.all_day ? null : draft.event_time,
      category: draft.category.trim() || 'Pessoal',
      notes,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)
    setError('')
    const { error: updateError } = await supabase.from('events').update(patch).eq('id', editing.id)
    if (updateError) {
      setError(updateError.message || 'Não foi possível atualizar o compromisso.')
      setSaving(false)
      return
    }

    updateLocalEvent(editing.id, patch)
    window.location.reload()
  }

  return <>
    {targets.map(({ event, target }) => createPortal(
      <button
        type="button"
        className="agendaEditButton"
        aria-label={`Editar ${event.title}`}
        title="Editar compromisso"
        onClick={() => openEditor(event)}
      >✎</button>,
      target,
      event.id,
    ))}

    {editing && draft && createPortal(
      <div className="agendaEditShade" onMouseDown={event => event.target === event.currentTarget && closeEditor()}>
        <form className="agendaEditModal" onSubmit={save}>
          <header>
            <div><h2>Editar compromisso</h2><p>Altere os dados e salve.</p></div>
            <button type="button" onClick={closeEditor}>×</button>
          </header>

          <label><span>Compromisso</span><input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label><span>Data</span><input type="date" value={draft.event_date} onChange={event => setDraft({ ...draft, event_date: event.target.value })} /></label>
          <label className="agendaAllDay"><input type="checkbox" checked={draft.all_day} onChange={event => setDraft({ ...draft, all_day: event.target.checked })} /> Dia todo</label>
          {!draft.all_day && <label><span>Horário</span><input type="time" value={draft.event_time} onChange={event => setDraft({ ...draft, event_time: event.target.value })} /></label>}
          <label><span>Categoria</span><input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></label>
          <label><span>Local</span><input value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label>
          <label><span>Observações</span><textarea value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>

          {error && <div className="agendaEditError">⚠ {error}</div>}
          <footer>
            <button type="button" onClick={closeEditor}>Cancelar</button>
            <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
          </footer>
        </form>
      </div>,
      document.body,
    )}
  </>
}
