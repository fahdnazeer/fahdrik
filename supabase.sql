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

-- Peach publishes the Samboer snapshot with the same token as the calendar ICS feed.
create or replace function public.fahdrik_push_samboer(tok text, payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if tok is null or tok <> 'b2da988d219d94865acd8f3dc26a9ef0' then
    raise exception 'unauthorized';
  end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid payload';
  end if;
  insert into public.fahdrik (id, data, updated_at, updated_by)
  values ('fahdrik.samboer', payload, now(), 'peach')
  on conflict (id) do update
    set data = excluded.data,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.fahdrik_push_samboer(text, jsonb) from public;
grant execute on function public.fahdrik_push_samboer(text, jsonb) to anon, authenticated;
