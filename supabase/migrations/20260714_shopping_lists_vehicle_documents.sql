-- DHub: listas de compras, calculadora e documentos anuais de veículos
create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  reference_month text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shopping_items add column if not exists list_id uuid references public.shopping_lists(id) on delete cascade;
alter table public.shopping_items add column if not exists unit_price numeric(12,2) check (unit_price is null or unit_price >= 0);
alter table public.shopping_items add column if not exists unit text not null default 'un.';

-- Converte a quantidade textual antiga em número, preservando o valor quando possível.
alter table public.shopping_items add column if not exists quantity_number numeric(10,2) not null default 1 check (quantity_number > 0);
update public.shopping_items
set quantity_number = coalesce(nullif(regexp_replace(quantity, '[^0-9,.]', '', 'g'), '')::numeric, 1)
where quantity_number = 1;

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  document_type text not null,
  amount numeric(12,2) check (amount is null or amount >= 0),
  due_date date not null,
  paid boolean not null default false,
  remind_months smallint not null default 2 check (remind_months between 1 and 12),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles add column if not exists vehicle_type text not null default 'carro' check (vehicle_type in ('carro','moto','outro'));

create index if not exists shopping_lists_user_idx on public.shopping_lists(user_id, created_at);
create index if not exists shopping_items_list_idx on public.shopping_items(list_id, purchased);
create index if not exists vehicle_documents_due_idx on public.vehicle_documents(user_id, due_date, paid);

alter table public.shopping_lists enable row level security;
alter table public.vehicle_documents enable row level security;

drop policy if exists "DHub: acessar proprios dados" on public.shopping_lists;
create policy "DHub: acessar proprios dados" on public.shopping_lists for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "DHub: acessar proprios dados" on public.vehicle_documents;
create policy "DHub: acessar proprios dados" on public.vehicle_documents for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.shopping_lists to authenticated;
grant select, insert, update, delete on public.vehicle_documents to authenticated;
revoke all on public.shopping_lists from anon;
revoke all on public.vehicle_documents from anon;
