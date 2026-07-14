import { FormEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { getSession, hasSupabase, signIn, signOut, signUp, supabase } from './lib/supabase'

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabase || !supabase) {
      setLoading(false)
      return
    }
    getSession().then((current) => {
      // Sessões anônimas antigas não sincronizam entre aparelhos.
      if (current?.user?.is_anonymous) {
        signOut().finally(() => { setSession(null); setLoading(false) })
      } else {
        setSession(current)
        setLoading(false)
      }
    }).catch(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const next = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
      if (!next && mode === 'signup') {
        setError('Conta criada. Confira seu e-mail para confirmar e depois entre no DHub.')
      } else {
        setSession(next)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar.'
      setError(message.includes('Invalid login') ? 'E-mail ou senha incorretos.' : message)
    } finally {
      setLoading(false)
    }
  }

  if (!hasSupabase) return <App />
  if (loading) return <div className="load"><i>D</i><b>Preparando o DHub</b><span>Sincronizando seus dados...</span></div>
  if (session) return <App />

  return <main className="authPage">
    <section className="authCard">
      <div className="authLogo">D</div>
      <h1>DHub</h1>
      <p>Entre com a mesma conta no celular e no computador para manter tudo sincronizado.</p>
      <div className="segmented authTabs">
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Entrar</button>
        <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Criar conta</button>
      </div>
      <form onSubmit={submit}>
        <label className="field"><span>E-mail</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seuemail@gmail.com" /></label>
        <label className="field"><span>Senha</span><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" /></label>
        {error && <div className="authMessage">{error}</div>}
        <button className="authSubmit" type="submit">{mode === 'login' ? 'Entrar no DHub' : 'Criar minha conta'}</button>
      </form>
      <small>Use exatamente o mesmo e-mail e senha nos dois aparelhos.</small>
    </section>
  </main>
}
