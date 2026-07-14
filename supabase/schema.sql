-- DHub - banco inicial
-- Execute todo este arquivo em Supabase > SQL Editor > New query > Run.
-- Depois habilite Anonymous Sign-Ins em Authentication > Providers > Anonymous.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

do $$
declare t text;
begin
  foreach t in array array['user_settings','tasks','events','transactions','vehicles','vehicle_maintenance','fuel_entries','shopping_items']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array['user_settings','tasks','events','transactions','vehicles','vehicle_maintenance','fuel_entries','shopping_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "DHub: acessar próprios dados" on public.%I', t);
    execute format('create policy "DHub: acessar próprios dados" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
