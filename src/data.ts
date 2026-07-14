import type { AppState, EventItem, FuelEntry, Maintenance, Settings, ShoppingItem, Task, Transaction, Vehicle } from './types'
import { ensureAnonymousSession, hasSupabase, supabase } from './lib/supabase'

const KEY = 'dhub-state-v1'
const now = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()
export const today = () => new Date().toISOString().slice(0, 10)

export const emptyState: AppState = {
  tasks: [], events: [], transactions: [], vehicles: [], maintenance: [], fuel: [], shopping: [],
  settings: { display_name: 'David', monthly_salary: 0, payday: 1 },
}

function localLoad(): AppState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '')
    return { ...emptyState, ...parsed, settings: { ...emptyState.settings, ...(parsed?.settings || {}) } }
  } catch { return emptyState }
}

function localSave(state: AppState) { localStorage.setItem(KEY, JSON.stringify(state)) }

const tableMap = {
  tasks: 'tasks', events: 'events', transactions: 'transactions', vehicles: 'vehicles',
  maintenance: 'vehicle_maintenance', fuel: 'fuel_entries', shopping: 'shopping_items', settings: 'user_settings',
} as const

export async function loadState(): Promise<AppState> {
  if (!hasSupabase || !supabase) return localLoad()
  const client = supabase
  try {
    const session = await ensureAnonymousSession()
    if (!session) return localLoad()
    const entries = await Promise.all(Object.entries(tableMap).map(async ([key, table]) => {
      const { data, error } = await client.from(table).select('*')
      if (error) throw error
      return [key, data] as const
    }))
    const map = Object.fromEntries(entries) as Record<string, unknown>
    const settingsRow = Array.isArray(map.settings) ? map.settings[0] : null
    return {
      tasks: (map.tasks || []) as Task[], events: (map.events || []) as EventItem[],
      transactions: (map.transactions || []) as Transaction[], vehicles: (map.vehicles || []) as Vehicle[],
      maintenance: (map.maintenance || []) as Maintenance[], fuel: (map.fuel || []) as FuelEntry[],
      shopping: (map.shopping || []) as ShoppingItem[],
      settings: settingsRow ? {
        display_name: (settingsRow as Settings).display_name,
        monthly_salary: Number((settingsRow as Settings).monthly_salary),
        payday: Number((settingsRow as Settings).payday),
      } : emptyState.settings,
    }
  } catch (error) {
    console.error('Falha no Supabase, usando modo local:', error)
    return localLoad()
  }
}

export async function persistState(state: AppState) {
  localSave(state)
  if (!hasSupabase || !supabase) return
  const client = supabase
  const session = await ensureAnonymousSession()
  const userId = session?.user.id
  if (!userId) return

  const syncTable = async (table: string, rows: Record<string, unknown>[]) => {
    const payload = rows.map((row) => ({ ...row, user_id: userId }))
    if (payload.length) {
      const { error } = await client.from(table).upsert(payload)
      if (error) throw error
    }
    const { data: remoteRows, error: readError } = await client.from(table).select('id')
    if (readError) throw readError
    const localIds = new Set(rows.map((row) => String(row.id)))
    const staleIds = (remoteRows || []).map((row) => String(row.id)).filter((id) => !localIds.has(id))
    if (staleIds.length) {
      const { error: deleteError } = await client.from(table).delete().in('id', staleIds)
      if (deleteError) throw deleteError
    }
  }

  await Promise.all([
    syncTable('tasks', state.tasks as unknown as Record<string, unknown>[]),
    syncTable('events', state.events as unknown as Record<string, unknown>[]),
    syncTable('transactions', state.transactions as unknown as Record<string, unknown>[]),
    syncTable('vehicles', state.vehicles as unknown as Record<string, unknown>[]),
    syncTable('vehicle_maintenance', state.maintenance as unknown as Record<string, unknown>[]),
    syncTable('fuel_entries', state.fuel as unknown as Record<string, unknown>[]),
    syncTable('shopping_items', state.shopping as unknown as Record<string, unknown>[]),
    syncTable('user_settings', [{ id: userId, ...state.settings }]),
  ])
}

export function makeTask(data: Partial<Task> & Pick<Task, 'title'>): Task {
  return { id: uid(), title: data.title, due_date: data.due_date ?? today(), due_time: data.due_time ?? null,
    priority: data.priority ?? 'media', category: data.category ?? 'Pessoal', completed: false,
    remind: data.remind ?? true, created_at: now() }
}
export function makeEvent(data: Partial<EventItem> & Pick<EventItem, 'title' | 'event_date'>): EventItem {
  return { id: uid(), title: data.title, event_date: data.event_date, event_time: data.event_time ?? null,
    category: data.category ?? 'Pessoal', notes: data.notes ?? '', created_at: now() }
}
export function makeTransaction(data: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'description'>): Transaction {
  return { id: uid(), type: data.type, amount: Number(data.amount), description: data.description,
    category: data.category ?? 'Outros', transaction_date: data.transaction_date ?? today(),
    is_extra: data.is_extra ?? false, is_fixed: data.is_fixed ?? false, status: data.status ?? 'paid',
    source: data.source ?? 'manual', created_at: now() }
}
export function makeVehicle(data: Pick<Vehicle, 'nickname' | 'model' | 'year' | 'mileage'>): Vehicle {
  return { id: uid(), ...data, mileage: Number(data.mileage), created_at: now() }
}
export function makeMaintenance(data: Omit<Maintenance, 'id' | 'created_at'>): Maintenance {
  return { id: uid(), ...data, cost: Number(data.cost), created_at: now() }
}
export function makeFuel(data: Omit<FuelEntry, 'id' | 'created_at'>): FuelEntry {
  return { id: uid(), ...data, amount: Number(data.amount), created_at: now() }
}
export function makeShopping(data: Pick<ShoppingItem, 'name' | 'quantity' | 'category' | 'estimated_price'>): ShoppingItem {
  return { id: uid(), ...data, estimated_price: data.estimated_price ? Number(data.estimated_price) : null,
    actual_price: null, purchased: false, created_at: now() }
}
