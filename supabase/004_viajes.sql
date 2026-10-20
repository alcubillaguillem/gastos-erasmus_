-- Gastos Erasmus: viajes (aplicado el 2026-10-20).
-- Un viaje tiene nombre y fechas. Los gastos de esas fechas cuentan para el viaje,
-- salvo los que se quiten a mano (lista "excluidos"). La tabla gastos no cambia.
create table if not exists public.viajes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 60),
  inicio     date not null,
  fin        date not null,
  excluidos  uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  constraint viajes_fechas check (fin >= inicio and fin - inicio <= 366)
);

create index if not exists viajes_user_inicio_idx on public.viajes (user_id, inicio desc);

alter table public.viajes enable row level security;

drop policy if exists "viajes propios" on public.viajes;
create policy "viajes propios" on public.viajes
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.viajes from anon;
