-- Elo Diário — esquema de nuvem (Supabase / Postgres)
-- Rode este arquivo no Supabase → SQL Editor → New query → Run.
-- Depois de rodar, cada conta enxerga apenas as próprias páginas.

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  ink jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title_at timestamptz not null default now(),
  body_at timestamptz not null default now(),
  ink_at timestamptz,
  deleted boolean not null default false
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

-- Isolamento por conta: ligar Row Level Security e negar tudo por padrão.
alter table public.notes enable row level security;
alter table public.notes force row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- O id da página é gerado no aparelho (uuid v4), então o mesmo id pode ser
-- enviado por dois aparelhos sem colidir com páginas de outra conta.
-- A chave primária é global, mas a policy garante que ninguém escreve na conta alheia.

-- Verificação rápida (deve retornar 0 linhas antes do primeiro uso):
-- select count(*) from public.notes;
