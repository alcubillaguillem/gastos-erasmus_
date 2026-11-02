-- Gastos Erasmus: viajes con asignación manual y viajes cerrados.
-- Cada gasto guarda a qué viaje pertenece (viaje_id). Las fechas solo sirven para
-- proponerlo al apuntar el gasto; después manda lo que elija el usuario.
-- Un viaje cerrado deja de recoger gastos automáticamente hasta que se reabre.
-- La columna viajes.excluidos deja de usarse (se conserva para no perder datos).

alter table public.gastos add column if not exists viaje_id uuid references public.viajes(id) on delete set null;
create index if not exists gastos_viaje_idx on public.gastos (viaje_id) where viaje_id is not null;

alter table public.viajes add column if not exists cerrado boolean not null default false;

-- 1. Pasar los viajes actuales al sistema nuevo: cada gasto queda en el viaje
--    en el que aparece hoy (fechas del viaje y no quitado a mano; si dos viajes
--    se solapan, el que empieza más tarde, como hace la app).
update public.gastos g
set viaje_id = (
  select v.id from public.viajes v
  where v.user_id = g.user_id
    and g.fecha between v.inicio and v.fin
    and not (g.id = any (v.excluidos))
  order by v.inicio desc
  limit 1
)
where g.viaje_id is null
  and exists (
    select 1 from public.viajes v
    where v.user_id = g.user_id
      and g.fecha between v.inicio and v.fin
      and not (g.id = any (v.excluidos))
  );

-- 2. Al apuntar un gasto (desde la app o el atajo) sin viaje, va al viaje abierto
--    que cubra su fecha. Además, un gasto solo puede ir a un viaje de su dueño.
create or replace function public.gastos_viaje()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' and new.viaje_id is null then
    select v.id into new.viaje_id from viajes v
    where v.user_id = new.user_id and not v.cerrado
      and new.fecha between v.inicio and v.fin
    order by v.inicio desc
    limit 1;
  end if;
  if new.viaje_id is not null and not exists (
    select 1 from viajes v where v.id = new.viaje_id and v.user_id = new.user_id
  ) then
    raise exception 'viaje no válido';
  end if;
  return new;
end $$;

create or replace trigger gastos_viaje
  before insert or update of viaje_id, user_id on public.gastos
  for each row execute function public.gastos_viaje();

-- 3. Al crear un viaje (o cambiar sus fechas), recoge los gastos de esos días
--    que todavía no tengan viaje. Los que ya están en otro viaje no se tocan.
create or replace function public.viajes_recoger()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  update gastos g set viaje_id = new.id
  where g.user_id = new.user_id
    and g.viaje_id is null
    and g.fecha between new.inicio and new.fin;
  return null;
end $$;

create or replace trigger viajes_recoger
  after insert or update of inicio, fin on public.viajes
  for each row when (not new.cerrado)
  execute function public.viajes_recoger();
