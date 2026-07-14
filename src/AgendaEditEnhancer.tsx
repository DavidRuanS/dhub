import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import type { EventItem } from './types'

type RowTarget = {
  target: HTMLElement
  title: string
  subtitle: string
}

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

function subtitleDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : ''
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
    // O Supabase continua sendo a fonte principal dos dados.
  }
}

function sameTargets(current: RowTarget[], next: RowTarget[]) {
  return current.length === next.length && current.every((item, index) =>
    item.target === next[index].target && item.title === next[index].title && item.subtitle === next[index].subtitle,
  )
}

export default function AgendaEditEnhancer() {
  const [targets, setTargets] = useState<RowTarget[]>([])
  const [editing, setEditing] = useState<EventItem | null>(null)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let timer = 0

    const scan = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('.app main section'))
      const agenda = sections.find(section => section.querySelector('h1')?.textContent?.trim() === 'Agenda')
      if (!agenda) {
        setTargets(current => current.length ? [] : current)
        return
      }

      const next = Array.from(agenda.querySelectorAll<HTMLElement>('.list > .row')).flatMap(row => {
        const target = row.querySelector<HTMLElement>(':scope > aside')
        if (!target) return []
        const title = row.querySelector<HTMLElement>(':scope > div > b')?.textContent?.trim() || ''
        const subtitle = row.querySelector<HTMLElement>(':scope > div > small')?.textContent?.trim() || ''
        return [{ target, title, subtitle }]
      })

      setTargets(current => sameTargets(current, next) ? current : next)
    }

    const scheduleScan = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(scan, 80)
    }

    scan()
    const observer = new MutationObserver(scheduleScan)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  async function openEditor(row: RowTarget) {
    if (!supabase) {
      setError('O Supabase não está configurado.')
      return
    }

    setResolving(true)
    setError('')

    const date = subtitleDate(row.subtitle)
    let query = supabase
      .from('events')
      .select('id,title,event_date,event_time,category,notes,created_at')
      .eq('title', row.title)

    if (date) query = query.eq('event_date', date)

    const { data, error: readError } = await query.order('created_at', { ascending: true })
    setResolving(false)

    if (readError || !data?.length) {
      setError('Não foi possível localizar este compromisso. Recarregue a página e tente novamente.')
      return
    }

    const events = data as EventItem[]
    const found = events.find(event => eventSubtitle(event) === row.subtitle) || events[0]
    const parsed = splitNotes(found.notes || '')

    setEditing(found)
    setDraft({
      title: found.title,
      event_date: found.event_date,
      event_time: found.event_time?.slice(0, 5) || '',
      all_day: !found.event_time,
      category: found.category || 'Pessoal',
      location: parsed.location,
      notes: parsed.notes,
    })
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
    {targets.map((row, index) => createPortal(
      <button
        type="button"
        className="agendaEditButton"
        aria-label={`Editar ${row.title || 'compromisso'}`}
        title="Editar compromisso"
        disabled={resolving}
        onClick={() => openEditor(row)}
      >✎</button>,
      row.target,
      `${row.title}-${row.subtitle}-${index}`,
    ))}

    {error && !editing && createPortal(
      <div className="agendaEditToast" role="alert">⚠ {error}<button type="button" onClick={() => setError('')}>×</button></div>,
      document.body,
    )}

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
