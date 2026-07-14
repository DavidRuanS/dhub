import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numberValue = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0

export default function WalletEnhancer() {
  const [financeTarget, setFinanceTarget] = useState<HTMLElement | null>(null)
  const [homeTarget, setHomeTarget] = useState<HTMLElement | null>(null)
  const [balance, setBalance] = useState(0)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const organize = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('.app main section'))
      const finance = sections.find(section => section.querySelector('h1')?.textContent?.trim() === 'Finanças') || null
      const home = sections.find(section => section.querySelector('h1')?.textContent?.trim().startsWith('Olá,')) || null

      const ensureHost = (section: HTMLElement | null, className: string) => {
        if (!section) return null
        let host = section.querySelector<HTMLElement>(`.${className}`)
        if (!host) {
          host = document.createElement('div')
          host.className = className
          const header = section.firstElementChild
          header?.insertAdjacentElement('afterend', host)
        }
        return host
      }

      setFinanceTarget(ensureHost(finance, 'walletFinanceHost'))
      setHomeTarget(ensureHost(home, 'walletHomeHost'))

      document.querySelectorAll<HTMLElement>('.calendar').forEach(calendar => {
        const count = calendar.querySelector<HTMLElement>('header div span')
        const days = calendar.querySelector<HTMLElement>('.days')
        if (count && days && !count.classList.contains('calendarCountBottom')) {
          count.classList.add('calendarCountBottom')
          days.insertAdjacentElement('afterend', count)
        }
      })
    }

    organize()
    const observer = new MutationObserver(organize)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) return
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) return
      const { data, error } = await supabase.from('user_settings').select('wallet_balance').eq('user_id', userId).maybeSingle()
      if (!active) return
      if (error) {
        setMessage('Execute o SQL da Carteira no Supabase para ativar a sincronização.')
        return
      }
      const value = Number(data?.wallet_balance || 0)
      setBalance(value)
      if (!editing) setDraft(String(value).replace('.', ','))
    }

    load()
    const interval = window.setInterval(load, 2500)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [editing])

  async function save(event: FormEvent) {
    event.preventDefault()
    const value = numberValue(draft)
    setLoading(true)
    setMessage('')
    try {
      if (!supabase) throw new Error('Supabase não configurado.')
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Entre novamente na sua conta.')
      const { error } = await supabase.from('user_settings').update({ wallet_balance: value, updated_at: new Date().toISOString() }).eq('user_id', userId)
      if (error) throw error
      setBalance(value)
      setEditing(false)
      setMessage('Saldo atualizado e sincronizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o saldo.')
    } finally {
      setLoading(false)
    }
  }

  const card = (compact = false) => (
    <article className={`walletCard ${compact ? 'walletDashboard' : ''}`} aria-label="Carteira financeira">
      <div className="walletIcon">◉</div>
      <div className="walletContent">
        <span>{compact ? 'Saldo disponível hoje' : 'Carteira · saldo disponível hoje'}</span>
        <b>{brl(balance)}</b>
        <small>{compact ? 'Valor real disponível no banco e em dinheiro.' : 'Receitas recebidas somam e despesas pagas descontam automaticamente.'}</small>
        {message && <em>{message}</em>}
      </div>
      {!compact && (!editing ? <button type="button" onClick={() => { setDraft(String(balance).replace('.', ',')); setEditing(true) }}>Ajustar</button> :
        <form className="walletForm" onSubmit={save}>
          <input autoFocus inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} placeholder="0,00" aria-label="Saldo atual da carteira" />
          <button type="submit" disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
        </form>)}
    </article>
  )

  return <>{homeTarget && createPortal(card(true), homeTarget)}{financeTarget && createPortal(card(false), financeTarget)}</>
}
