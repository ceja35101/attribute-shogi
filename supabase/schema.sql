-- Attribute Shogi invite-room backend for Supabase.
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.shogi_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  host_user uuid not null references auth.users(id) on delete cascade,
  guest_user uuid references auth.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  state jsonb not null,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists shogi_rooms_expires_at_idx on public.shogi_rooms(expires_at);
alter table public.shogi_rooms enable row level security;
revoke all on public.shogi_rooms from anon, authenticated;
grant select on public.shogi_rooms to authenticated;

drop policy if exists "room participants can read" on public.shogi_rooms;
create policy "room participants can read" on public.shogi_rooms for select to authenticated
using (auth.uid() = host_user or auth.uid() = guest_user);

create or replace function public.create_shogi_room(p_code text, p_state jsonb)
returns public.shogi_rooms
language plpgsql security definer set search_path = public
as $$
declare result public.shogi_rooms;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_code !~ '^[A-Z2-9]{6}$' then raise exception 'invalid room code'; end if;
  if pg_column_size(p_state) > 524288 then raise exception 'state too large'; end if;
  delete from public.shogi_rooms where expires_at < now();
  insert into public.shogi_rooms(code, host_user, state)
  values (p_code, auth.uid(), p_state)
  returning * into result;
  return result;
end;
$$;

create or replace function public.join_shogi_room(p_code text)
returns public.shogi_rooms
language plpgsql security definer set search_path = public
as $$
declare result public.shogi_rooms;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.shogi_rooms
     set guest_user = auth.uid(), status = 'playing', updated_at = now()
   where code = upper(p_code) and expires_at > now()
     and host_user <> auth.uid() and (guest_user is null or guest_user = auth.uid())
  returning * into result;
  if result.id is null then raise exception 'room unavailable'; end if;
  return result;
end;
$$;

create or replace function public.submit_shogi_state(p_room_id uuid, p_expected_revision bigint, p_state jsonb)
returns public.shogi_rooms
language plpgsql security definer set search_path = public
as $$
declare current_room public.shogi_rooms; result public.shogi_rooms; expected_actor text; next_ply bigint; old_ply bigint;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into current_room from public.shogi_rooms where id = p_room_id for update;
  if current_room.id is null or current_room.expires_at <= now() then raise exception 'room expired'; end if;
  if current_room.guest_user is null then raise exception 'waiting for opponent'; end if;
  if current_room.revision <> p_expected_revision then raise exception 'stale revision'; end if;
  expected_actor := current_room.state->>'turn';
  if (expected_actor = 'white' and auth.uid() <> current_room.host_user)
     or (expected_actor = 'black' and auth.uid() <> current_room.guest_user) then
    raise exception 'not your turn';
  end if;
  if pg_column_size(p_state) > 524288 then raise exception 'state too large'; end if;
  old_ply := coalesce((current_room.state->>'ply')::bigint, 0);
  next_ply := coalesce((p_state->>'ply')::bigint, -1);
  if next_ply <> old_ply + 1 and not (next_ply = old_ply and p_state->>'winner' is not null) then
    raise exception 'invalid move sequence';
  end if;
  if p_state->>'winner' is null and (
    (expected_actor = 'white' and p_state->>'turn' <> 'black')
    or (expected_actor = 'black' and p_state->>'turn' <> 'white')
  ) then
    raise exception 'turn did not advance';
  end if;
  if p_state->>'gameMode' <> 'online' then raise exception 'invalid game mode'; end if;
  update public.shogi_rooms set
    state = p_state,
    revision = revision + 1,
    status = case when p_state->>'winner' is null then 'playing' else 'finished' end,
    updated_at = now(),
    expires_at = now() + interval '24 hours'
  where id = p_room_id returning * into result;
  return result;
end;
$$;

revoke all on function public.create_shogi_room(text,jsonb) from public;
revoke all on function public.join_shogi_room(text) from public;
revoke all on function public.submit_shogi_state(uuid,bigint,jsonb) from public;
grant execute on function public.create_shogi_room(text,jsonb) to authenticated;
grant execute on function public.join_shogi_room(text) to authenticated;
grant execute on function public.submit_shogi_state(uuid,bigint,jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shogi_rooms'
  ) then
    alter publication supabase_realtime add table public.shogi_rooms;
  end if;
end $$;
