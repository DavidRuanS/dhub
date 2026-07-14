-- DHub - banco inicial corrigido
-- Pode executar mesmo que a tentativa anterior tenha criado algumas tabelas.
-- Nao traduza o codigo SQL no navegador.

create extension if not exists pgcrypto;

create table if not exists public.user_settings (
  id uuid primary key default auth.uid(),
  user_id uuid not null default auth.uid(),
  display_name text not null default 'David',
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  payday smallint not null default 1 check (payday between 1 and 31),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null check (char_length(title) between 1 and 180),
  due_date date,
  due_time time,
  priority text not null default 'media' check (priority in ('baixa','media','alta')),
  category text not null default 'Pessoal',
  completed boolean not null default false,
  remind boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  title text not null check (char_length(title) between 1 and 180),
  event_date date not null,
  event_time time,
  category text not null default 'Pessoal',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount >= 0),
  description text not null,
  category text not null default 'Outros',
  transaction_date date not null default current_date,
  is_extra boolean not null default false,
  is_fixed boolean not null default false,
  status text not null default 'paid' check (status in ('paid','pending')),
  source text not null default 'manual' check (source in ('manual','car','market')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  nickname text not null,
  model text not null,
  year text not null default '',
  mileage integer not null default 0 check (mileage >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_maintenance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  title text not null,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  performed_date date not null default current_date,
  performed_mileage integer check (performed_mileage is null or performed_mileage >= 0),
  next_date date,
  next_mileage integer check (next_mileage is null or next_mileage >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  liters numeric(10,3) check (liters is null or liters >= 0),
  mileage integer check (mileage is null or mileage >= 0),
  fuel_type text not null default 'Gasolina',
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  quantity text not null default '1 un.',
  category text not null default 'Alimentos',
  estimated_price numeric(12,2) check (estimated_price is null or estimated_price >= 0),
  actual_price numeric(12,2) check (actual_price is null or actual_price >= 0),
  purchased boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date, completed);
create index if not exists events_user_date_idx on public.events(user_id, event_date);
create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date);
create index if not exists maintenance_vehicle_idx on public.vehicle_maintenance(vehicle_id, performed_date);
create index if not exists fuel_vehicle_idx on public.fuel_entries(vehicle_id, entry_date);
create index if not exists shopping_user_status_idx on public.shopping_items(user_id, purchased);

alter table public.user_settings enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.transactions enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_maintenance enable row level security;
alter table public.fuel_entries enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "DHub: acessar proprios dados" on public.user_settings;
create policy "DHub: acessar proprios dados" on public.user_settings
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.tasks;
create policy "DHub: acessar proprios dados" on public.tasks
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.events;
create policy "DHub: acessar proprios dados" on public.events
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.transactions;
create policy "DHub: acessar proprios dados" on public.transactions
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.vehicles;
create policy "DHub: acessar proprios dados" on public.vehicles
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.vehicle_maintenance;
create policy "DHub: acessar proprios dados" on public.vehicle_maintenance
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.fuel_entries;
create policy "DHub: acessar proprios dados" on public.fuel_entries
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.shopping_items;
create policy "DHub: acessar proprios dados" on public.shopping_items
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.vehicle_maintenance to authenticated;
grant select, insert, update, delete on public.fuel_entries to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;

revoke all on public.user_settings from anon;
revoke all on public.tasks from anon;
revoke all on public.events from anon;
revoke all on public.transactions from anon;
revoke all on public.vehicles from anon;
revoke all on public.vehicle_maintenance from anon;
revoke all on public.fuel_entries from anon;
revoke all on public.shopping_items from anon;
