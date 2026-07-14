import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { getSession, hasSupabase, signIn, signOut, signUp, supabase } from './lib/supabase'
import './auth.css'

type StoredState = {
  tasks?: Array<{ id:string; title:string; due_date:string|null; due_time:string|null; completed:boolean; remind:boolean }>
  events?: Array<{ id:string; title:string; event_date:string; event_time:string|null }>
  transactions?: Array<{ id:string; description:string; transaction_date:string; type:string; status:string; amount:number }>
  settings?: { monthly_salary?:number }
}

function readStored(): StoredState {
  try { return JSON.parse(localStorage.getItem('dhub-state-v1') || '{}') }
  catch { return {} }
}

function runAlerts() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const state = readStored()
  const now = new Date()
  const today = now.toISOString().slice(0,10)
  const hour = now.toTimeString().slice(0,5)
  const sentKey = `dhub-alerts-${today}`
  const sent = new Set<string>(JSON.parse(localStorage.getItem(sentKey) || '[]'))
  const notify = (id:string,title:string,body:string) => {
    if (sent.has(id)) return
    new Notification(title,{ body, icon:'/icon-192.png', tag:id })
    sent.add(id)
  }
  state.tasks?.filter(x=>!x.completed&&x.remind!==false&&x.due_date===today).forEach(x=>{
    if (!x.due_time || x.due_time <= hour) notify(`task-${x.id}`,'Tarefa do DHub',x.title)
  })
  state.events?.filter(x=>x.event_date===today).forEach(x=>{
    if (!x.event_time || x.event_time <= hour) notify(`event-${x.id}`,'Compromisso de hoje',x.title)
  })
  state.transactions?.filter(x=>x.type==='expense'&&x.status==='pending'&&x.transaction_date<=today).forEach(x=>notify(`bill-${x.id}`,'Conta pendente',`${x.description} • R$ ${Number(x.amount).toFixed(2).replace('.',',')}`))
  localStorage.setItem(sentKey,JSON.stringify([...sent]))
}

function NotificationPrompt(){
  const [show,setShow]=useState(()=>'Notification' in window && Notification.permission==='default' && localStorage.getItem('dhub-hide-notify')!=='1')
  useEffect(()=>{
    runAlerts()
    const timer=window.setInterval(runAlerts,60_000)
    return()=>window.clearInterval(timer)
  },[])
  if(!show)return null
  return <div className="notifyPrompt"><i>🔔</i><div><b>Ativar avisos do DHub</b><span>Tarefas, compromissos e contas enquanto o aplicativo estiver aberto.</span></div><button onClick={async()=>{const result=await Notification.requestPermission();setShow(false);if(result==='granted')runAlerts()}}>Ativar</button><button onClick={()=>{localStorage.setItem('dhub-hide-notify','1');setShow(false)}}>×</button></div>
}

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabase || !supabase) { setLoading(false); return }
    getSession().then((current) => {
      if (current?.user?.is_anonymous) signOut().finally(() => { setSession(null); setLoading(false) })
      else { setSession(current); setLoading(false) }
    }).catch(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true)
    try {
      const next = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
      if (!next && mode === 'signup') setError('Conta criada. Confira seu e-mail para confirmar e depois entre no DHub.')
      else setSession(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar.'
      setError(message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : message)
    } finally { setLoading(false) }
  }

  if (!hasSupabase) return <><App/><NotificationPrompt/></>
  if (loading) return <div className="load"><i>D</i><b>Preparando o DHub</b><span>Sincronizando seus dados...</span></div>
  if (session) return <><App/><NotificationPrompt/></>

  return <main className="authPage"><section className="authCard">
    <div className="authLogo">D</div><h1>DHub</h1>
    <p>Entre com a mesma conta no celular e no computador para manter tudo sincronizado.</p>
    <div className="segmented authTabs"><button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Entrar</button><button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Criar conta</button></div>
    <form onSubmit={submit}>
      <label className="field"><span>E-mail</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@gmail.com" /></label>
      <label className="field"><span>Senha</span><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" /></label>
      {error && <div className="authMessage">{error}</div>}
      <button className="authSubmit" type="submit">{mode === 'login' ? 'Entrar no DHub' : 'Criar minha conta'}</button>
    </form>
    <small>Use exatamente o mesmo e-mail e senha nos dois aparelhos.</small>
  </section></main>
}
