import type { AppState, EventItem, FuelEntry, Maintenance, Settings, ShoppingItem, ShoppingList, Task, Transaction, Vehicle, VehicleDocument } from './types'
import { ensureAnonymousSession, hasSupabase, supabase } from './lib/supabase'

const KEY='dhub-state-v1'
const now=()=>new Date().toISOString()
export const uid=()=>crypto.randomUUID()
export const today=()=>new Date().toISOString().slice(0,10)

export const emptyState:AppState={tasks:[],events:[],transactions:[],vehicles:[],maintenance:[],fuel:[],shoppingLists:[],shopping:[],vehicleDocuments:[],settings:{display_name:'David',monthly_salary:0,payday:1}}
function normalize(raw:any):AppState{
 const legacyItems=(raw?.shopping||[]).map((x:any)=>({list_id:x.list_id??null,unit_price:x.unit_price??x.estimated_price??null,quantity:Number(String(x.quantity??1).replace(/[^0-9.,-]/g,'').replace(',','.'))||1,unit:x.unit||'un.',...x}))
 return {...emptyState,...raw,shoppingLists:raw?.shoppingLists||[],shopping:legacyItems,vehicleDocuments:raw?.vehicleDocuments||[],vehicles:(raw?.vehicles||[]).map((x:any)=>({...x,vehicle_type:x.vehicle_type||'carro'})),settings:{...emptyState.settings,...(raw?.settings||{})}}
}
function localLoad(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||''))}catch{return emptyState}}
function localSave(s:AppState){localStorage.setItem(KEY,JSON.stringify(s))}
function useful(s:AppState){return s.tasks.length+s.events.length+s.transactions.length+s.vehicles.length+s.maintenance.length+s.fuel.length+s.shopping.length+s.shoppingLists.length+s.vehicleDocuments.length>0||Number(s.settings.monthly_salary)>0}
const tables={tasks:'tasks',events:'events',transactions:'transactions',vehicles:'vehicles',maintenance:'vehicle_maintenance',fuel:'fuel_entries',shoppingLists:'shopping_lists',shopping:'shopping_items',vehicleDocuments:'vehicle_documents',settings:'user_settings'} as const

export async function loadState():Promise<AppState>{
 const local=localLoad();if(!hasSupabase||!supabase)return local
 try{const session=await ensureAnonymousSession();if(!session)return local
  const entries=await Promise.all(Object.entries(tables).map(async([k,t])=>{const{data,error}=await supabase!.from(t).select('*');if(error)throw error;return[k,data]as const}))
  const m=Object.fromEntries(entries)as any,sr=m.settings?.[0]
  const remote=normalize({tasks:m.tasks||[],events:m.events||[],transactions:m.transactions||[],vehicles:m.vehicles||[],maintenance:m.maintenance||[],fuel:m.fuel||[],shoppingLists:m.shoppingLists||[],shopping:m.shopping||[],vehicleDocuments:m.vehicleDocuments||[],settings:sr?{display_name:sr.display_name,monthly_salary:Number(sr.monthly_salary),payday:Number(sr.payday)}:emptyState.settings})
  return !useful(remote)&&useful(local)?local:remote
 }catch(e){console.error('Falha no Supabase, usando modo local:',e);return local}
}

export async function persistState(s:AppState){localSave(s);if(!hasSupabase||!supabase)return;const session=await ensureAnonymousSession(),userId=session?.user.id;if(!userId)return
 const sync=async(table:string,rows:Record<string,unknown>[])=>{const payload=rows.map(r=>({...r,user_id:userId}));if(payload.length){const{error}=await supabase!.from(table).upsert(payload);if(error)throw error}const{data,error}=await supabase!.from(table).select('id');if(error)throw error;const ids=new Set(rows.map(r=>String(r.id))),stale=(data||[]).map(r=>String(r.id)).filter(id=>!ids.has(id));if(stale.length){const{error:de}=await supabase!.from(table).delete().in('id',stale);if(de)throw de}}
 await Promise.all([sync('tasks',s.tasks as any),sync('events',s.events as any),sync('transactions',s.transactions as any),sync('vehicles',s.vehicles as any),sync('vehicle_maintenance',s.maintenance as any),sync('fuel_entries',s.fuel as any),sync('shopping_lists',s.shoppingLists as any),sync('shopping_items',s.shopping as any),sync('vehicle_documents',s.vehicleDocuments as any),sync('user_settings',[{id:userId,...s.settings}])])
}

export const makeTask=(d:Partial<Task>&Pick<Task,'title'>):Task=>({id:uid(),title:d.title,due_date:d.due_date??today(),due_time:d.due_time??null,priority:d.priority??'media',category:d.category??'Pessoal',completed:false,remind:d.remind??true,created_at:now()})
export const makeEvent=(d:Partial<EventItem>&Pick<EventItem,'title'|'event_date'>):EventItem=>({id:uid(),title:d.title,event_date:d.event_date,event_time:d.event_time??null,category:d.category??'Pessoal',notes:d.notes??'',created_at:now()})
export const makeTransaction=(d:Partial<Transaction>&Pick<Transaction,'type'|'amount'|'description'>):Transaction=>({id:uid(),type:d.type,amount:Number(d.amount),description:d.description,category:d.category??'Outros',transaction_date:d.transaction_date??today(),is_extra:d.is_extra??false,is_fixed:d.is_fixed??false,status:d.status??'paid',source:d.source??'manual',created_at:now()})
export const makeVehicle=(d:Pick<Vehicle,'nickname'|'model'|'year'|'mileage'>&Partial<Vehicle>):Vehicle=>({id:uid(),nickname:d.nickname,model:d.model,year:d.year,mileage:Number(d.mileage),vehicle_type:d.vehicle_type??'carro',created_at:now()})
export const makeMaintenance=(d:Omit<Maintenance,'id'|'created_at'>):Maintenance=>({id:uid(),...d,cost:Number(d.cost),created_at:now()})
export const makeFuel=(d:Omit<FuelEntry,'id'|'created_at'>):FuelEntry=>({id:uid(),...d,amount:Number(d.amount),created_at:now()})
export const makeShoppingList=(d:Pick<ShoppingList,'name'>&Partial<ShoppingList>):ShoppingList=>({id:uid(),name:d.name,reference_month:d.reference_month??null,created_at:now()})
export const makeShopping=(d:Pick<ShoppingItem,'name'|'quantity'|'unit'|'category'|'unit_price'>&Partial<ShoppingItem>):ShoppingItem=>({id:uid(),list_id:d.list_id??null,name:d.name,quantity:Number(d.quantity)||1,unit:d.unit||'un.',category:d.category||'Alimentos',unit_price:d.unit_price==null?null:Number(d.unit_price),estimated_price:d.unit_price==null?null:Number(d.quantity||1)*Number(d.unit_price),actual_price:null,purchased:false,created_at:now()})
export const makeVehicleDocument=(d:Omit<VehicleDocument,'id'|'created_at'>):VehicleDocument=>({id:uid(),...d,amount:d.amount==null?null:Number(d.amount),remind_months:Number(d.remind_months)||2,created_at:now()})
