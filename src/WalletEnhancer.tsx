import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numberValue = (value: string) => Number(value.replace(/\./g, '').replace(',', '.')) || 0

export default function WalletEnhancer() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [balance, setBalance] = useState(0)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const findFinance = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>('.app main section'))
      const finance = sections.find(section => section.querySelector('h1')?.textContent?.trim() === 'Finanças')
      if (!finance) return setTarget(null)
      let host = finance.querySelector<HTMLElement>('.walletPortalHost')
      if (!host) {
        host = document.createElement('div')
        host.className = 'walletPortalHost'
        const header = finance.firstElementChild
        header?.insertAdjacentElement('afterend', host)
      }
      setTarget(host)
    }
    findFinance()
    const observer = new MutationObserver(findFinance)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!target || !supabase) return
    let active = true
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) return
      const { data, error } = await supabase.from('user_settings').select('wallet_balance').eq('user_id', userId).maybeSingle()
      if (!active) return
      if (error) return setMessage('Execute o SQL da Carteira no Supabase para ativar a sincronização.')
      const value = Number(data?.wallet_balance || 0)
      setBalance(value)
      setDraft(String(value).replace('.', ','))
    }
    load()
    return () => { active = false }
  }, [target])

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

  if (!target) return null
  return createPortal(
    <article className="walletCard" aria-label="Carteira financeira">
      <div className="walletIcon">◉</div>
      <div className="walletContent">
        <span>Carteira · saldo disponível hoje</span>
        <b>{brl(balance)}</b>
        <small>Quanto você tem agora no banco e em dinheiro.</small>
        {message && <em>{message}</em>}
      </div>
      {!editing ? <button type="button" onClick={() => { setDraft(String(balance).replace('.', ',')); setEditing(true) }}>Ajustar</button> :
        <form className="walletForm" onSubmit={save}>
          <input autoFocus inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} placeholder="0,00" aria-label="Saldo atual da carteira" />
          <button type="submit" disabled={loading}>{loading ? 'Salvando…' : 'Salvar'}</button>
          <button type="button" onClick={() => setEditing(false)}>Cancelar</button>
        </form>}
    </article>, target)
}
