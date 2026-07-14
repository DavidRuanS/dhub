-- DHub: carteira financeira sincronizada
-- Execute uma vez no SQL Editor do Supabase.

alter table public.user_settings
add column if not exists wallet_balance numeric(12,2) not null default 0
check (wallet_balance >= 0);
