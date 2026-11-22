-- 3 SET RETREAT: Team-Freischaltung und gemeinsame Pendenzliste.
-- Zugriff nur für freigeschaltete, angemeldete Team-Mitglieder (Row Level Security).
-- Kann mehrfach ausgeführt werden; bestehende Daten bleiben erhalten.

create table if not exists public.retreat_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);
alter table public.retreat_members enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_retreat_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.retreat_members m where m.user_id = (select auth.uid()));
$$;
revoke all on function private.is_retreat_member() from public, anon;
grant execute on function private.is_retreat_member() to authenticated;

drop policy if exists "members can read team" on public.retreat_members;
create policy "members can read team" on public.retreat_members
  for select to authenticated using ((select private.is_retreat_member()));

create table if not exists public.retreat_tasks (
  id bigint generated always as identity primary key,
  num integer,
  title text not null check (char_length(title) between 1 and 300),
  owner text not null default 'Tous' check (owner in ('Rémy','Mathieu','Mel','Tous')),
  due date,
  status text not null default 'À faire' check (status in ('À faire','En cours','Bloqué','Fait')),
  priority text not null default 'Moyenne' check (priority in ('Haute','Moyenne','Basse')),
  category text not null default 'Programme' check (category in ('Jalon','Juridique & finances','Lieux & partenaires','Programme','Inscription','Expérience participants','Marque & marketing')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  done_at timestamptz
);
create index if not exists retreat_tasks_due_idx on public.retreat_tasks (due);
create index if not exists retreat_tasks_created_by_idx on public.retreat_tasks (created_by);
create index if not exists retreat_tasks_updated_by_idx on public.retreat_tasks (updated_by);
alter table public.retreat_tasks enable row level security;

create or replace function public.retreat_tasks_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.num is null then
      select coalesce(max(t.num), 0) + 1 into new.num from public.retreat_tasks t;
    end if;
    if new.status = 'Fait' then new.done_at := now(); end if;
    new.created_at := now();
    new.updated_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    new.id := old.id;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
    if new.status = 'Fait' and old.status <> 'Fait' then new.done_at := now();
    elsif new.status <> 'Fait' then new.done_at := null;
    else new.done_at := old.done_at;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists retreat_tasks_stamp on public.retreat_tasks;
create trigger retreat_tasks_stamp before insert or update on public.retreat_tasks
  for each row execute function public.retreat_tasks_stamp();

drop policy if exists "members read tasks" on public.retreat_tasks;
drop policy if exists "members add tasks" on public.retreat_tasks;
drop policy if exists "members edit tasks" on public.retreat_tasks;
drop policy if exists "members delete tasks" on public.retreat_tasks;
create policy "members read tasks" on public.retreat_tasks for select to authenticated using ((select private.is_retreat_member()));
create policy "members add tasks" on public.retreat_tasks for insert to authenticated with check ((select private.is_retreat_member()));
create policy "members edit tasks" on public.retreat_tasks for update to authenticated using ((select private.is_retreat_member())) with check ((select private.is_retreat_member()));
create policy "members delete tasks" on public.retreat_tasks for delete to authenticated using ((select private.is_retreat_member()));

revoke all on public.retreat_members, public.retreat_tasks from anon;
revoke all on public.retreat_members from authenticated;
grant select on public.retreat_members to authenticated;
grant select, insert, update, delete on public.retreat_tasks to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'retreat_tasks') then
    alter publication supabase_realtime add table public.retreat_tasks;
  end if;
end $$;
