import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  emptyState,
  loadState,
  makeEvent,
  makeFuel,
  makeMaintenance,
  makeShopping,
  makeTask,
  makeTransaction,
  makeVehicle,
  persistState,
  today,
} from './data'
import { hasSupabase } from './lib/supabase'
import type { AppState, Tab } from './types'

type ModalKind = 'task' | 'event' | 'transaction' | 'vehicle' | 'fuel' | 'maintenance' | 'shopping' | 'settings' | null

type Draft = Record<string, string>

const nav: [Tab, string, string][] = [
  ['home', 'Início', '⌂'],
  ['tasks', 'Tarefas', '✓'],
  ['finance', 'Finanças', 'R$'],
  ['car', 'Carro', '🚗'],
  ['market', 'Mercado', '🛒'],
]

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const formatDate = (value: string | null) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data'
const toNumber = (value: string | undefined) => Number(String(value || '0').replace(',', '.')) || 0

export default function App() {
  const [state, setState] = useState<AppState>(emptyState)
  const [tab, setTab] = useState<Tab>('home')
  const [ready, setReady] = useState(false)
  const [menu, setMenu] = useState(false)
  const [modal, setModal] = useState<ModalKind>(null)
  const [draft, setDraft] = useState<Draft>({})

  useEffect(() => {
    loadState().then((loaded) => {
      setState(loaded)
      setReady(true)
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => persistState(state), 300)
    return () => window.clearTimeout(timer)
  }, [state, ready])

  const update = (fn: (current: AppState) => AppState) => setState((current) => fn(current))
  const currentMonth = today().slice(0, 7)
  const monthTransactions = state.transactions.filter((item) => item.transaction_date.startsWith(currentMonth))
  const income = monthTransactions.filter((item) => item.type === 'income' && item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0) + Number(state.settings.monthly_salary || 0)
  const spent = monthTransactions.filter((item) => item.type === 'expense' && item.status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0)
  const pending = monthTransactions.filter((item) => item.type === 'expense' && item.status === 'pending').reduce((sum, item) => sum + Number(item.amount), 0)
  const balance = income - spent - pending
  const dueToday = state.tasks.filter((item) => !item.completed && item.due_date === today())
  const upcomingEvents = state.events.filter((item) => item.event_date >= today()).sort((a, b) => a.event_date.localeCompare(b.event_date))
  const openShopping = state.shopping.filter((item) => !item.purchased)
  const vehicle = state.vehicles[0]

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>()
    monthTransactions.filter((item) => item.type === 'expense').forEach((item) => map.set(item.category, (map.get(item.category) || 0) + Number(item.amount)))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [monthTransactions])

  if (!ready) return <div className="load"><i>D</i><b>Preparando o DHub</b><span>Carregando sua rotina...</span></div>

  function openModal(kind: ModalKind, initial: Draft = {}) {
    setDraft(initial)
    setModal(kind)
  }

  function closeModal() {
    setModal(null)
    setDraft({})
  }

  function setField(name: string, value: string) {
    setDraft((current) => ({ ...current, [name]: value }))
  }

  function remove(kind: 'tasks' | 'events' | 'transactions' | 'maintenance' | 'fuel' | 'shopping', id: string) {
    update((current) => ({ ...current, [kind]: current[kind].filter((item) => item.id !== id) } as AppState))
  }

  function toggleTask(id: string) {
    update((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, completed: !item.completed } : item) }))
  }

  function saveModal(event: FormEvent) {
    event.preventDefault()
    if (!modal) return

    if (modal === 'task' && draft.title) {
      update((current) => ({ ...current, tasks: [...current.tasks, makeTask({
        title: draft.title,
        due_date: draft.date || today(),
        due_time: draft.time || null,
        category: draft.category || 'Pessoal',
        priority: (draft.priority as 'baixa' | 'media' | 'alta') || 'media',
      })] }))
    }

    if (modal === 'event' && draft.title) {
      update((current) => ({ ...current, events: [...current.events, makeEvent({
        title: draft.title,
        event_date: draft.date || today(),
        event_time: draft.time || null,
        category: draft.category || 'Pessoal',
        notes: draft.notes || '',
      })] }))
    }

    if (modal === 'transaction' && draft.description) {
      update((current) => ({ ...current, transactions: [...current.transactions, makeTransaction({
        type: draft.type === 'income' ? 'income' : 'expense',
        description: draft.description,
        amount: toNumber(draft.amount),
        category: draft.category || 'Outros',
        transaction_date: draft.date || today(),
        status: draft.status === 'pending' ? 'pending' : 'paid',
        is_extra: draft.extra === 'yes',
        is_fixed: draft.fixed === 'yes',
      })] }))
    }

    if (modal === 'vehicle' && draft.nickname) {
      update((current) => ({ ...current, vehicles: [makeVehicle({
        nickname: draft.nickname,
        model: draft.model || 'Veículo',
        year: draft.year || '',
        mileage: toNumber(draft.mileage),
      })] }))
    }

    if (modal === 'fuel' && vehicle) {
      const amount = toNumber(draft.amount)
      const register = draft.finance !== 'no'
      update((current) => ({
        ...current,
        fuel: [...current.fuel, makeFuel({
          vehicle_id: vehicle.id,
          amount,
          liters: draft.liters ? toNumber(draft.liters) : null,
          mileage: draft.mileage ? toNumber(draft.mileage) : vehicle.mileage,
          fuel_type: draft.fuelType || 'Gasolina',
          entry_date: draft.date || today(),
        })],
        transactions: register ? [...current.transactions, makeTransaction({
          type: 'expense',
          description: 'Abastecimento',
          amount,
          category: 'Carro - Combustível',
          source: 'car',
          transaction_date: draft.date || today(),
        })] : current.transactions,
      }))
    }

    if (modal === 'maintenance' && vehicle && draft.title) {
      const cost = toNumber(draft.amount)
      const register = draft.finance !== 'no'
      update((current) => ({
        ...current,
        maintenance: [...current.maintenance, makeMaintenance({
          vehicle_id: vehicle.id,
          title: draft.title,
          cost,
          performed_date: draft.date || today(),
          performed_mileage: draft.mileage ? toNumber(draft.mileage) : vehicle.mileage,
          next_date: draft.nextDate || null,
          next_mileage: draft.nextMileage ? toNumber(draft.nextMileage) : null,
          notes: draft.notes || '',
        })],
        transactions: register && cost > 0 ? [...current.transactions, makeTransaction({
          type: 'expense',
          description: draft.title,
          amount: cost,
          category: 'Carro - Manutenção',
          source: 'car',
          transaction_date: draft.date || today(),
        })] : current.transactions,
      }))
    }

    if (modal === 'shopping' && draft.name) {
      update((current) => ({ ...current, shopping: [...current.shopping, makeShopping({
        name: draft.name,
        quantity: draft.quantity || '1 un.',
        category: draft.category || 'Alimentos',
        estimated_price: draft.amount ? toNumber(draft.amount) : null,
      })] }))
    }

    if (modal === 'settings') {
      update((current) => ({ ...current, settings: {
        ...current.settings,
        display_name: draft.name || current.settings.display_name,
        monthly_salary: toNumber(draft.salary),
        payday: Math.min(31, Math.max(1, toNumber(draft.payday) || 1)),
      } }))
    }

    closeModal()
  }

  function quickAction(kind: ModalKind) {
    if (kind === 'fuel' || kind === 'maintenance') {
      if (!vehicle) return openModal('vehicle', { nickname: 'Minha Spin', model: 'Chevrolet Spin', year: '2014', mileage: '270000' })
    }
    const defaults: Record<string, Draft> = {
      task: { date: today(), priority: 'media', category: 'Pessoal' },
      event: { date: today(), category: 'Pessoal' },
      transaction: { type: 'expense', date: today(), status: 'paid', category: 'Outros', extra: 'no', fixed: 'no' },
      fuel: { date: today(), fuelType: 'Gasolina', mileage: String(vehicle?.mileage || ''), finance: 'yes' },
      maintenance: { date: today(), mileage: String(vehicle?.mileage || ''), finance: 'yes' },
      shopping: { quantity: '1 un.', category: 'Alimentos' },
    }
    openModal(kind, defaults[String(kind)] || {})
  }

  function finishShopping() {
    const purchased = state.shopping.filter((item) => item.purchased)
    if (!purchased.length) return
    const total = purchased.reduce((sum, item) => sum + Number(item.actual_price || item.estimated_price || 0), 0)
    const register = window.confirm(`Compra finalizada em ${brl(total)}. Registrar nas Finanças?`)
    update((current) => ({
      ...current,
      shopping: current.shopping.filter((item) => !item.purchased),
      transactions: register ? [...current.transactions, makeTransaction({ type: 'expense', description: 'Compra de mercado', amount: total, category: 'Alimentação', source: 'market' })] : current.transactions,
    }))
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return window.alert('Este navegador não oferece notificações.')
    const result = await Notification.requestPermission()
    window.alert(result === 'granted' ? 'Notificações ativadas.' : 'Permissão não concedida.')
  }

  return (
    <div className="app">
      <header>
        <button className="iconButton" onClick={() => setMenu(true)} aria-label="Abrir menu">☰</button>
        <div className="brand"><b>DHub</b><small><i className={hasSupabase ? 'online' : ''} />{hasSupabase ? 'Sincronizado' : 'Modo local'}</small></div>
        <button className="avatar" onClick={() => openModal('settings', { name: state.settings.display_name, salary: String(state.settings.monthly_salary), payday: String(state.settings.payday) })}>{state.settings.display_name[0]?.toUpperCase()}</button>
      </header>

      {menu && <div className="shade" onClick={() => setMenu(false)}>
        <aside onClick={(event) => event.stopPropagation()}>
          <div className="menuHead"><span>D</span><div><b>DHub</b><small>Sua vida organizada</small></div></div>
          {[...nav, ['agenda', 'Agenda', '▦'] as [Tab, string, string]].map(([id, label, icon]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => { setTab(id); setMenu(false) }}><b>{icon}</b>{label}<span>›</span></button>)}
          <button onClick={() => { setMenu(false); openModal('settings', { name: state.settings.display_name, salary: String(state.settings.monthly_salary), payday: String(state.settings.payday) }) }}><b>⚙</b>Configurações<span>›</span></button>
        </aside>
      </div>}

      <main>
        {tab === 'home' && <section>
          <div className="hero">
            <div><span>{new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'},</span><h1>{state.settings.display_name} 👋</h1><p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
            <button onClick={() => openModal('settings', { name: state.settings.display_name, salary: String(state.settings.monthly_salary), payday: String(state.settings.payday) })}>⚙</button>
          </div>

          <article className="balanceCard">
            <div><span>Saldo previsto do mês</span><b className={balance < 0 ? 'negative' : ''}>{brl(balance)}</b><small>{brl(income)} em entradas</small></div>
            <div className="balanceMeta"><span><i className="expenseDot" />{brl(spent)} gastos</span><span><i className="pendingDot" />{brl(pending)} pendentes</span></div>
          </article>

          <div className="quickActions">
            <button onClick={() => quickAction('task')}><i>✓</i><span>Tarefa</span></button>
            <button onClick={() => quickAction('transaction')}><i>R$</i><span>Movimentação</span></button>
            <button onClick={() => quickAction('event')}><i>▦</i><span>Agenda</span></button>
            <button onClick={() => quickAction('shopping')}><i>🛒</i><span>Mercado</span></button>
          </div>

          <div className="sectionTitle"><div><h2>Visão geral</h2><p>O que precisa da sua atenção</p></div></div>
          <div className="overviewGrid">
            <button onClick={() => setTab('tasks')}><div className="overviewIcon mint">✓</div><div><b>{dueToday.length}</b><span>Tarefas hoje</span><small>{state.tasks.filter((item) => !item.completed).length} pendentes no total</small></div></button>
            <button onClick={() => setTab('agenda')}><div className="overviewIcon blue">▦</div><div><b>{upcomingEvents.length}</b><span>Próximos eventos</span><small>{upcomingEvents[0] ? `${formatDate(upcomingEvents[0].event_date)} • ${upcomingEvents[0].title}` : 'Agenda livre'}</small></div></button>
            <button onClick={() => setTab('market')}><div className="overviewIcon orange">🛒</div><div><b>{openShopping.length}</b><span>Itens no mercado</span><small>{brl(openShopping.reduce((sum, item) => sum + Number(item.estimated_price || 0), 0))} estimados</small></div></button>
            <button onClick={() => setTab('car')}><div className="overviewIcon dark">🚗</div><div><b>{vehicle ? vehicle.mileage.toLocaleString('pt-BR') : '0'}</b><span>{vehicle ? 'km registrados' : 'Nenhum veículo'}</span><small>{state.maintenance.length} manutenções salvas</small></div></button>
          </div>

          <div className="sectionTitle"><div><h2>Seu dia</h2><p>Prioridades de hoje</p></div><button onClick={() => setTab('tasks')}>Ver tudo</button></div>
          <div className="timeline">
            {dueToday.slice(0, 4).map((item) => <article key={item.id}><button className="check" onClick={() => toggleTask(item.id)}>○</button><div><b>{item.title}</b><span>{item.due_time || 'Durante o dia'} • {item.category}</span></div><em className={`priority ${item.priority}`}>{item.priority}</em></article>)}
            {!dueToday.length && <div className="emptyState"><i>✓</i><b>Dia organizado</b><span>Nenhuma tarefa marcada para hoje.</span></div>}
          </div>
        </section>}

        {tab === 'tasks' && <section>
          <PageHeader title="Tarefas" subtitle="Organize prioridades e prazos" action={() => quickAction('task')} />
          <div className="filterPills"><button className="active">Pendentes {state.tasks.filter((item) => !item.completed).length}</button><button>Hoje {dueToday.length}</button><button>Concluídas {state.tasks.filter((item) => item.completed).length}</button></div>
          <div className="list modernList">
            {state.tasks.filter((item) => !item.completed).sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))).map((item) => <article key={item.id}><button className="check" onClick={() => toggleTask(item.id)}>○</button><div><b>{item.title}</b><small>{formatDate(item.due_date)}{item.due_time ? ` às ${item.due_time}` : ''} • {item.category}</small></div><em className={`priority ${item.priority}`}>{item.priority}</em><button className="remove" onClick={() => remove('tasks', item.id)}>×</button></article>)}
            {!state.tasks.some((item) => !item.completed) && <Empty icon="✓" title="Tudo concluído" text="Adicione uma nova tarefa para começar." />}
          </div>
          <button className="wideAction" onClick={enableNotifications}>🔔 Ativar notificações do navegador</button>
        </section>}

        {tab === 'agenda' && <section>
          <PageHeader title="Agenda" subtitle="Compromissos e datas importantes" action={() => quickAction('event')} />
          <div className="monthStrip"><span>{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span><b>{upcomingEvents.length} próximos</b></div>
          <div className="list modernList agendaList">
            {state.events.slice().sort((a, b) => a.event_date.localeCompare(b.event_date)).map((item) => <article key={item.id}><time><b>{new Date(`${item.event_date}T12:00:00`).getDate()}</b><span>{new Date(`${item.event_date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' })}</span></time><div><b>{item.title}</b><small>{item.event_time || 'Dia todo'} • {item.category}</small></div><button className="remove" onClick={() => remove('events', item.id)}>×</button></article>)}
            {!state.events.length && <Empty icon="▦" title="Agenda livre" text="Adicione seu primeiro compromisso." />}
          </div>
        </section>}

        {tab === 'finance' && <section>
          <PageHeader title="Finanças" subtitle="Controle simples e completo do mês" action={() => quickAction('transaction')} />
          <div className="financeHero"><span>Saldo após contas pendentes</span><b className={balance < 0 ? 'negative' : ''}>{brl(balance)}</b><small>Atualizado automaticamente</small></div>
          <div className="financeCards"><article><i>↑</i><div><span>Entradas</span><b>{brl(income)}</b></div></article><article><i>↓</i><div><span>Saídas</span><b>{brl(spent)}</b></div></article><article><i>!</i><div><span>Pendentes</span><b>{brl(pending)}</b></div></article></div>
          {expenseByCategory.length > 0 && <><div className="sectionTitle"><div><h2>Maiores gastos</h2><p>Por categoria neste mês</p></div></div><div className="categoryBars">{expenseByCategory.map(([category, value]) => <div key={category}><header><span>{category}</span><b>{brl(value)}</b></header><i><span style={{ width: `${Math.min(100, spent ? (value / spent) * 100 : 0)}%` }} /></i></div>)}</div></>}
          <div className="sectionTitle"><div><h2>Movimentações</h2><p>Entradas, gastos e contas</p></div></div>
          <div className="list modernList financeList">
            {state.transactions.slice().reverse().map((item) => <article key={item.id}><i className={item.type}>{item.type === 'income' ? '↑' : '↓'}</i><div><b>{item.description}</b><small>{item.category} • {formatDate(item.transaction_date)}{item.status === 'pending' ? ' • Pendente' : ''}</small></div><strong className={item.type}>{item.type === 'expense' ? '-' : '+'}{brl(Number(item.amount))}</strong><button className="remove" onClick={() => remove('transactions', item.id)}>×</button></article>)}
            {!state.transactions.length && <Empty icon="R$" title="Sem movimentações" text="Cadastre salário, renda extra ou um gasto." />}
          </div>
        </section>}

        {tab === 'car' && <section>
          <PageHeader title="Meu carro" subtitle="Custos, abastecimentos e manutenção" action={() => quickAction(vehicle ? 'maintenance' : 'vehicle')} />
          {!vehicle ? <div className="welcomeCard"><i>🚙</i><h2>Cadastre seu veículo</h2><p>Acompanhe quilometragem, combustível, documentos e manutenções.</p><button onClick={() => quickAction('vehicle')}>Cadastrar veículo</button></div> : <>
            <article className="vehicleCard"><div><small>{vehicle.year}</small><h2>{vehicle.nickname}</h2><p>{vehicle.model}</p></div><div><span>Quilometragem</span><b>{vehicle.mileage.toLocaleString('pt-BR')} km</b></div></article>
            <div className="carActions"><button onClick={() => quickAction('fuel')}><i>⛽</i><span>Abastecer</span></button><button onClick={() => quickAction('maintenance')}><i>🔧</i><span>Manutenção</span></button><button onClick={() => quickAction('vehicle')}><i>✎</i><span>Atualizar carro</span></button></div>
            <div className="carStats"><article><span>Combustível no mês</span><b>{brl(state.fuel.filter((item) => item.entry_date.startsWith(currentMonth)).reduce((sum, item) => sum + Number(item.amount), 0))}</b></article><article><span>Manutenções</span><b>{state.maintenance.length}</b></article></div>
            <div className="sectionTitle"><div><h2>Histórico do veículo</h2><p>Últimos registros</p></div></div>
            <div className="list modernList">
              {[...state.maintenance.map((item) => ({ ...item, kind: 'maintenance' as const, date: item.performed_date })), ...state.fuel.map((item) => ({ ...item, kind: 'fuel' as const, date: item.entry_date }))].sort((a, b) => b.date.localeCompare(a.date)).map((item) => item.kind === 'maintenance' ? <article key={item.id}><i className="historyIcon">🔧</i><div><b>{item.title}</b><small>{formatDate(item.performed_date)} • {brl(Number(item.cost))}</small></div><button className="remove" onClick={() => remove('maintenance', item.id)}>×</button></article> : <article key={item.id}><i className="historyIcon">⛽</i><div><b>Abastecimento</b><small>{formatDate(item.entry_date)} • {item.fuel_type}</small></div><strong>{brl(Number(item.amount))}</strong><button className="remove" onClick={() => remove('fuel', item.id)}>×</button></article>)}
              {!state.maintenance.length && !state.fuel.length && <Empty icon="🚗" title="Sem histórico" text="Registre um abastecimento ou manutenção." />}
            </div>
          </>}
        </section>}

        {tab === 'market' && <section>
          <PageHeader title="Mercado" subtitle="Lista rápida com controle de valores" action={() => quickAction('shopping')} />
          <article className="marketSummary"><div><span>Lista atual</span><b>{openShopping.length} itens</b><small>Estimativa de {brl(openShopping.reduce((sum, item) => sum + Number(item.estimated_price || 0), 0))}</small></div><button disabled={!state.shopping.some((item) => item.purchased)} onClick={finishShopping}>Finalizar compra</button></article>
          <div className="list modernList marketList">
            {state.shopping.map((item) => <article className={item.purchased ? 'done' : ''} key={item.id}><button className="check" onClick={() => update((current) => ({ ...current, shopping: current.shopping.map((shopping) => shopping.id === item.id ? { ...shopping, purchased: !shopping.purchased } : shopping) }))}>{item.purchased ? '✓' : '○'}</button><div><b>{item.name}</b><small>{item.quantity} • {item.category}</small></div><strong>{item.estimated_price ? brl(Number(item.estimated_price)) : '—'}</strong><button className="remove" onClick={() => remove('shopping', item.id)}>×</button></article>)}
            {!state.shopping.length && <Empty icon="🛒" title="Lista vazia" text="Adicione produtos para sua próxima compra." />}
          </div>
        </section>}
      </main>

      <button className="fab" onClick={() => quickAction(tab === 'tasks' ? 'task' : tab === 'finance' ? 'transaction' : tab === 'car' ? (vehicle ? 'fuel' : 'vehicle') : tab === 'market' ? 'shopping' : tab === 'agenda' ? 'event' : 'task')}>＋</button>
      <nav>{nav.map(([id, label, icon]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><b>{icon}</b><small>{label}</small></button>)}</nav>

      {modal && <div className="modalShade" onClick={closeModal}><form className="modal" onSubmit={saveModal} onClick={(event) => event.stopPropagation()}>
        <div className="modalHead"><div><h2>{modalTitle(modal)}</h2><p>{modalSubtitle(modal)}</p></div><button type="button" onClick={closeModal}>×</button></div>
        <ModalFields kind={modal} draft={draft} setField={setField} />
        <div className="modalActions"><button type="button" onClick={closeModal}>Cancelar</button><button type="submit">Salvar</button></div>
      </form></div>}
    </div>
  )
}

function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action: () => void }) {
  return <div className="pageHeader"><div><h1>{title}</h1><p>{subtitle}</p></div><button onClick={action}>＋</button></div>
}

function Empty({ icon, title, text }: { icon: string; title: string; text: string }) {
  return <div className="emptyState"><i>{icon}</i><b>{title}</b><span>{text}</span></div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function ModalFields({ kind, draft, setField }: { kind: Exclude<ModalKind, null>; draft: Draft; setField: (name: string, value: string) => void }) {
  if (kind === 'task') return <><Field label="Tarefa"><input required value={draft.title || ''} onChange={(e) => setField('title', e.target.value)} placeholder="Ex.: Preparar aula de Excel" autoFocus /></Field><div className="fieldGrid"><Field label="Data"><input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} /></Field><Field label="Horário"><input type="time" value={draft.time || ''} onChange={(e) => setField('time', e.target.value)} /></Field></div><div className="fieldGrid"><Field label="Categoria"><input value={draft.category || ''} onChange={(e) => setField('category', e.target.value)} /></Field><Field label="Prioridade"><select value={draft.priority || 'media'} onChange={(e) => setField('priority', e.target.value)}><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option></select></Field></div></>
  if (kind === 'event') return <><Field label="Compromisso"><input required value={draft.title || ''} onChange={(e) => setField('title', e.target.value)} placeholder="Ex.: Consulta médica" autoFocus /></Field><div className="fieldGrid"><Field label="Data"><input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} /></Field><Field label="Horário"><input type="time" value={draft.time || ''} onChange={(e) => setField('time', e.target.value)} /></Field></div><Field label="Categoria"><input value={draft.category || ''} onChange={(e) => setField('category', e.target.value)} /></Field><Field label="Observações"><textarea value={draft.notes || ''} onChange={(e) => setField('notes', e.target.value)} /></Field></>
  if (kind === 'transaction') return <><div className="segmented"><button type="button" className={draft.type !== 'income' ? 'active' : ''} onClick={() => setField('type', 'expense')}>Saída</button><button type="button" className={draft.type === 'income' ? 'active' : ''} onClick={() => setField('type', 'income')}>Entrada</button></div><Field label="Descrição"><input required value={draft.description || ''} onChange={(e) => setField('description', e.target.value)} placeholder="Ex.: Internet, salário, renda extra" autoFocus /></Field><div className="fieldGrid"><Field label="Valor"><input inputMode="decimal" value={draft.amount || ''} onChange={(e) => setField('amount', e.target.value)} placeholder="0,00" /></Field><Field label="Data"><input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} /></Field></div><Field label="Categoria"><input value={draft.category || ''} onChange={(e) => setField('category', e.target.value)} /></Field><div className="fieldGrid"><Field label="Situação"><select value={draft.status || 'paid'} onChange={(e) => setField('status', e.target.value)}><option value="paid">Pago/recebido</option><option value="pending">Pendente</option></select></Field><Field label="Tipo"><select value={draft.extra || 'no'} onChange={(e) => setField('extra', e.target.value)}><option value="no">Normal</option><option value="yes">Extra</option></select></Field></div></>
  if (kind === 'vehicle') return <><Field label="Apelido do veículo"><input required value={draft.nickname || ''} onChange={(e) => setField('nickname', e.target.value)} placeholder="Minha Spin" autoFocus /></Field><Field label="Modelo"><input value={draft.model || ''} onChange={(e) => setField('model', e.target.value)} placeholder="Chevrolet Spin" /></Field><div className="fieldGrid"><Field label="Ano"><input value={draft.year || ''} onChange={(e) => setField('year', e.target.value)} /></Field><Field label="Quilometragem"><input inputMode="numeric" value={draft.mileage || ''} onChange={(e) => setField('mileage', e.target.value)} /></Field></div></>
  if (kind === 'fuel') return <><Field label="Valor abastecido"><input inputMode="decimal" value={draft.amount || ''} onChange={(e) => setField('amount', e.target.value)} placeholder="0,00" autoFocus /></Field><div className="fieldGrid"><Field label="Combustível"><select value={draft.fuelType || 'Gasolina'} onChange={(e) => setField('fuelType', e.target.value)}><option>Gasolina</option><option>Etanol</option><option>Diesel</option><option>GNV</option></select></Field><Field label="Litros"><input inputMode="decimal" value={draft.liters || ''} onChange={(e) => setField('liters', e.target.value)} /></Field></div><div className="fieldGrid"><Field label="Quilometragem"><input inputMode="numeric" value={draft.mileage || ''} onChange={(e) => setField('mileage', e.target.value)} /></Field><Field label="Data"><input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} /></Field></div><Field label="Enviar para Finanças?"><select value={draft.finance || 'yes'} onChange={(e) => setField('finance', e.target.value)}><option value="yes">Sim, eu paguei</option><option value="no">Não, outra pessoa pagou</option></select></Field></>
  if (kind === 'maintenance') return <><Field label="Manutenção"><input required value={draft.title || ''} onChange={(e) => setField('title', e.target.value)} placeholder="Troca de óleo" autoFocus /></Field><div className="fieldGrid"><Field label="Valor"><input inputMode="decimal" value={draft.amount || ''} onChange={(e) => setField('amount', e.target.value)} /></Field><Field label="Data"><input type="date" value={draft.date || ''} onChange={(e) => setField('date', e.target.value)} /></Field></div><div className="fieldGrid"><Field label="Km atual"><input inputMode="numeric" value={draft.mileage || ''} onChange={(e) => setField('mileage', e.target.value)} /></Field><Field label="Próxima em km"><input inputMode="numeric" value={draft.nextMileage || ''} onChange={(e) => setField('nextMileage', e.target.value)} /></Field></div><Field label="Próxima data"><input type="date" value={draft.nextDate || ''} onChange={(e) => setField('nextDate', e.target.value)} /></Field><Field label="Enviar para Finanças?"><select value={draft.finance || 'yes'} onChange={(e) => setField('finance', e.target.value)}><option value="yes">Sim, eu paguei</option><option value="no">Não, outra pessoa pagou</option></select></Field></>
  if (kind === 'shopping') return <><Field label="Produto"><input required value={draft.name || ''} onChange={(e) => setField('name', e.target.value)} placeholder="Ex.: Arroz" autoFocus /></Field><div className="fieldGrid"><Field label="Quantidade"><input value={draft.quantity || ''} onChange={(e) => setField('quantity', e.target.value)} /></Field><Field label="Preço estimado"><input inputMode="decimal" value={draft.amount || ''} onChange={(e) => setField('amount', e.target.value)} /></Field></div><Field label="Categoria"><select value={draft.category || 'Alimentos'} onChange={(e) => setField('category', e.target.value)}><option>Alimentos</option><option>Bebidas</option><option>Limpeza</option><option>Higiene</option><option>Farmácia</option><option>Casa</option><option>Outros</option></select></Field></>
  return <><Field label="Seu nome"><input value={draft.name || ''} onChange={(e) => setField('name', e.target.value)} autoFocus /></Field><div className="fieldGrid"><Field label="Salário mensal"><input inputMode="decimal" value={draft.salary || ''} onChange={(e) => setField('salary', e.target.value)} /></Field><Field label="Dia do pagamento"><input inputMode="numeric" min="1" max="31" value={draft.payday || ''} onChange={(e) => setField('payday', e.target.value)} /></Field></div></>
}

function modalTitle(kind: Exclude<ModalKind, null>) {
  return ({ task: 'Nova tarefa', event: 'Novo compromisso', transaction: 'Nova movimentação', vehicle: 'Meu veículo', fuel: 'Novo abastecimento', maintenance: 'Nova manutenção', shopping: 'Adicionar ao mercado', settings: 'Configurações' } as Record<string, string>)[kind]
}

function modalSubtitle(kind: Exclude<ModalKind, null>) {
  return ({ task: 'Adicione uma prioridade à sua rotina.', event: 'Reserve uma data importante.', transaction: 'Registre entradas, saídas ou contas.', vehicle: 'Dados básicos do seu carro.', fuel: 'Controle combustível e custo mensal.', maintenance: 'Acompanhe serviços e próximas revisões.', shopping: 'Monte sua lista de compras.', settings: 'Personalize sua experiência.' } as Record<string, string>)[kind]
}
