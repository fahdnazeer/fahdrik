-- Run this once in the Supabase SQL editor (sql.new).

create table if not exists public.fahdrik (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table public.fahdrik enable row level security;

drop policy if exists "fahdrik read" on public.fahdrik;
drop policy if exists "fahdrik insert" on public.fahdrik;
drop policy if exists "fahdrik update" on public.fahdrik;
drop policy if exists "fahdrik delete" on public.fahdrik;

create policy "fahdrik read" on public.fahdrik for select using (auth.uid() is not null);
create policy "fahdrik insert" on public.fahdrik for insert with check (auth.uid() is not null);
create policy "fahdrik update" on public.fahdrik for update using (auth.uid() is not null);
create policy "fahdrik delete" on public.fahdrik for delete using (auth.uid() is not null);

do $$ begin
  alter publication supabase_realtime add table public.fahdrik;
exception when duplicate_object then null;
end $$;
