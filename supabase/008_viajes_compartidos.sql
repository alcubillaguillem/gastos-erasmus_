-- Gastos Erasmus: viajes compartidos (gastos a medias entre amigos).
-- Un viaje compartido tiene participantes (con cuenta o solo con nombre) y movimientos:
-- gastos pagados por uno y repartidos entre varios, y transferencias para saldar deudas.
-- Lo que le toca pagar a cada participante con cuenta se apunta solo en sus gastos
-- personales (gastos.movimiento_id), así Inicio y el presupuesto reflejan solo su parte.

alter table public.viajes add column if not exists compartido boolean not null default false;
alter table public.viajes add column if not exists invitacion text unique;

create table if not exists public.viaje_miembros (
  id         uuid primary key default gen_random_uuid(),
  viaje_id   uuid not null references public.viajes(id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 30),
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (viaje_id, user_id)
);
create unique index if not exists viaje_miembros_nombre_idx on public.viaje_miembros (viaje_id, lower(trim(nombre)));
create index if not exists viaje_miembros_user_idx on public.viaje_miembros (user_id) where user_id is not null;

create table if not exists public.movimientos (
  id         uuid primary key default gen_random_uuid(),
  viaje_id   uuid not null references public.viajes(id) on delete cascade,
  tipo       text not null check (tipo in ('gasto', 'transferencia')),
  titulo     text not null check (char_length(trim(titulo)) between 1 and 60),
  categoria  text check (char_length(categoria) <= 40),
  importe    numeric(10,2) not null check (importe > 0 and importe < 100000),
  pagador    uuid not null references public.viaje_miembros(id) on delete restrict,
  modo       text not null default 'iguales' check (modo in ('iguales', 'importes', 'partes')),
  fecha      date not null default ((now() at time zone 'Europe/Madrid'))::date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists movimientos_viaje_idx on public.movimientos (viaje_id);

create table if not exists public.movimiento_partes (
  movimiento_id uuid not null references public.movimientos(id) on delete cascade,
  miembro_id    uuid not null references public.viaje_miembros(id) on delete restrict,
  valor         numeric(12,2) not null check (valor >= 0),
  importe       numeric(10,2) not null check (importe >= 0),
  primary key (movimiento_id, miembro_id)
);
create index if not exists movimiento_partes_miembro_idx on public.movimiento_partes (miembro_id);

-- Copia personal de la parte de cada uno.
alter table public.gastos add column if not exists movimiento_id uuid references public.movimientos(id) on delete cascade;
create unique index if not exists gastos_movimiento_user_idx on public.gastos (movimiento_id, user_id) where movimiento_id is not null;

-- ¿El usuario actual participa en el viaje (o es su dueño)?
create or replace function public.es_miembro(p_viaje uuid)
returns boolean
language sql stable security definer set search_path = public, pg_catalog
as $$
  select exists (select 1 from viajes where id = p_viaje and user_id = auth.uid())
      or exists (select 1 from viaje_miembros where viaje_id = p_viaje and user_id = auth.uid());
$$;
revoke all on function public.es_miembro(uuid) from public, anon;
grant execute on function public.es_miembro(uuid) to authenticated;

-- Los participantes ven el viaje compartido; solo el dueño lo edita (política «viajes propios»).
create policy "viajes compartidos visibles" on public.viajes
  for select using (compartido and public.es_miembro(id));

alter table public.viaje_miembros enable row level security;
alter table public.movimientos enable row level security;
alter table public.movimiento_partes enable row level security;
create policy "miembros visibles" on public.viaje_miembros
  for select using (public.es_miembro(viaje_id));
create policy "movimientos visibles" on public.movimientos
  for select using (public.es_miembro(viaje_id));
create policy "partes visibles" on public.movimiento_partes
  for select using (exists (select 1 from movimientos m where m.id = movimiento_id and public.es_miembro(m.viaje_id)));
revoke all on table public.viaje_miembros, public.movimientos, public.movimiento_partes from anon;
-- Las escrituras van por las funciones de abajo, que comprueban todo.
revoke insert, update, delete on table public.viaje_miembros, public.movimientos, public.movimiento_partes from authenticated;

-- Al apuntar un gasto personal no se mete solo en un viaje compartido, y un gasto puede ir
-- a un viaje propio o a uno compartido en el que participa su dueño.
create or replace function public.gastos_viaje()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'INSERT' and new.viaje_id is null and new.movimiento_id is null then
    select v.id into new.viaje_id from viajes v
    where v.user_id = new.user_id and not v.cerrado and not v.compartido
      and new.fecha between v.inicio and v.fin
    order by v.inicio desc
    limit 1;
  end if;
  if new.viaje_id is not null and not exists (
    select 1 from viajes v where v.id = new.viaje_id and (v.user_id = new.user_id
      or exists (select 1 from viaje_miembros mm where mm.viaje_id = v.id and mm.user_id = new.user_id))
  ) then
    raise exception 'viaje no válido';
  end if;
  return new;
end $$;

create or replace function public.viajes_recoger()
returns trigger
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if new.compartido then return null; end if;
  update gastos g set viaje_id = new.id
  where g.user_id = new.user_id
    and g.viaje_id is null
    and g.fecha between new.inicio and new.fin;
  return null;
end $$;

-- Rehace la copia personal de un movimiento para cada participante con cuenta.
create or replace function public.sincronizar_movimiento(p_mov uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare mv movimientos; pag viaje_miembros; r record;
begin
  delete from gastos where movimiento_id = p_mov;
  select * into mv from movimientos where id = p_mov;
  if not found or mv.tipo <> 'gasto' then return; end if;
  select * into pag from viaje_miembros where id = mv.pagador;
  for r in
    select m.user_id, p.importe from movimiento_partes p
    join viaje_miembros m on m.id = p.miembro_id
    where p.movimiento_id = p_mov and m.user_id is not null and p.importe > 0
  loop
    perform categorias_iniciales(r.user_id);
    insert into gastos (user_id, importe, categoria, nota, fecha, viaje_id, movimiento_id, created_at)
    values (r.user_id, r.importe, resolver_categoria(r.user_id, coalesce(mv.categoria, 'otros')),
            left(mv.titulo || case when pag.user_id is distinct from r.user_id then ' · pagó ' || pag.nombre else '' end, 200),
            mv.fecha, mv.viaje_id, mv.id, mv.created_at);
  end loop;
end $$;
revoke all on function public.sincronizar_movimiento(uuid) from public, anon, authenticated;

-- Convierte un viaje propio en compartido. Devuelve el código de invitación.
create or replace function public.compartir_viaje(p_viaje uuid, p_mi_nombre text)
returns text
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v viajes;
begin
  select * into v from viajes where id = p_viaje and user_id = auth.uid();
  if not found then raise exception 'viaje no válido'; end if;
  if v.invitacion is null then
    update viajes set compartido = true, invitacion = encode(extensions.gen_random_bytes(8), 'hex')
    where id = p_viaje returning * into v;
  elsif not v.compartido then
    update viajes set compartido = true where id = p_viaje returning * into v;
  end if;
  if not exists (select 1 from viaje_miembros where viaje_id = p_viaje and user_id = auth.uid()) then
    insert into viaje_miembros (viaje_id, nombre, user_id)
    values (p_viaje, coalesce(nullif(trim(p_mi_nombre), ''), 'Yo'), auth.uid());
  end if;
  return v.invitacion;
end $$;
revoke all on function public.compartir_viaje(uuid, text) from public, anon;
grant execute on function public.compartir_viaje(uuid, text) to authenticated;

create or replace function public.nuevo_miembro(p_viaje uuid, p_nombre text)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare nuevo uuid;
begin
  if not es_miembro(p_viaje) or not exists (select 1 from viajes where id = p_viaje and compartido) then
    raise exception 'viaje no válido';
  end if;
  if (select count(*) from viaje_miembros where viaje_id = p_viaje) >= 50 then
    raise exception 'demasiados participantes';
  end if;
  insert into viaje_miembros (viaje_id, nombre) values (p_viaje, trim(p_nombre)) returning id into nuevo;
  return nuevo;
end $$;
revoke all on function public.nuevo_miembro(uuid, text) from public, anon;
grant execute on function public.nuevo_miembro(uuid, text) to authenticated;

create or replace function public.renombrar_miembro(p_miembro uuid, p_nombre text)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare vid uuid;
begin
  select viaje_id into vid from viaje_miembros where id = p_miembro;
  if vid is null or not es_miembro(vid) then raise exception 'participante no válido'; end if;
  update viaje_miembros set nombre = trim(p_nombre) where id = p_miembro;
  perform sincronizar_movimiento(id) from movimientos where viaje_id = vid and pagador = p_miembro;
end $$;
revoke all on function public.renombrar_miembro(uuid, text) from public, anon;
grant execute on function public.renombrar_miembro(uuid, text) to authenticated;

-- Solo se puede quitar a quien no aparece en ningún movimiento. A alguien con cuenta,
-- solo lo quita el dueño del viaje (o esa misma persona, para salirse).
create or replace function public.quitar_miembro(p_miembro uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare mb viaje_miembros; dueno uuid;
begin
  select * into mb from viaje_miembros where id = p_miembro;
  if not found or not es_miembro(mb.viaje_id) then raise exception 'participante no válido'; end if;
  select user_id into dueno from viajes where id = mb.viaje_id;
  if mb.user_id = dueno then raise exception 'el dueño del viaje no se puede quitar'; end if;
  if mb.user_id is not null and auth.uid() not in (dueno, mb.user_id) then
    raise exception 'solo el dueño del viaje puede quitar a alguien con cuenta';
  end if;
  if exists (select 1 from movimientos where pagador = p_miembro)
     or exists (select 1 from movimiento_partes where miembro_id = p_miembro) then
    raise exception 'tiene gastos en el viaje';
  end if;
  delete from viaje_miembros where id = p_miembro;
end $$;
revoke all on function public.quitar_miembro(uuid) from public, anon;
grant execute on function public.quitar_miembro(uuid) to authenticated;

-- Lo que ve quien abre un enlace de invitación antes de unirse.
create or replace function public.info_invitacion(p_codigo text)
returns json
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare v viajes;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into v from viajes where invitacion = p_codigo and compartido;
  if not found then return null; end if;
  return json_build_object(
    'viaje', v.id, 'nombre', v.nombre, 'inicio', v.inicio, 'fin', v.fin,
    'ya_miembro', es_miembro(v.id),
    'libres', (select coalesce(json_agg(json_build_object('id', id, 'nombre', nombre) order by created_at), '[]'::json)
               from viaje_miembros where viaje_id = v.id and user_id is null));
end $$;
revoke all on function public.info_invitacion(text) from public, anon;
grant execute on function public.info_invitacion(text) to authenticated;

-- Unirse: como un participante que ya estaba (solo con nombre) o como uno nuevo.
create or replace function public.unirse_viaje(p_codigo text, p_miembro uuid default null, p_nombre text default null)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare v viajes; mid uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  select * into v from viajes where invitacion = p_codigo and compartido;
  if not found then raise exception 'invitación no válida'; end if;
  if es_miembro(v.id) then return v.id; end if;
  if p_miembro is not null then
    update viaje_miembros set user_id = auth.uid()
    where id = p_miembro and viaje_id = v.id and user_id is null returning id into mid;
    if mid is null then raise exception 'ese participante ya tiene cuenta'; end if;
  else
    if (select count(*) from viaje_miembros where viaje_id = v.id) >= 50 then
      raise exception 'demasiados participantes';
    end if;
    insert into viaje_miembros (viaje_id, nombre, user_id)
    values (v.id, coalesce(nullif(trim(p_nombre), ''), 'Invitado'), auth.uid()) returning id into mid;
  end if;
  perform sincronizar_movimiento(m.id) from movimientos m
  where m.viaje_id = v.id
    and exists (select 1 from movimiento_partes p where p.movimiento_id = m.id and p.miembro_id = mid);
  return v.id;
end $$;
revoke all on function public.unirse_viaje(text, uuid, text) from public, anon;
grant execute on function public.unirse_viaje(text, uuid, text) to authenticated;

-- Crea o edita un movimiento. p_partes: [{"miembro": uuid, "valor": n}].
--   iguales: a partes iguales entre los de la lista (valor no cuenta)
--   partes:  en proporción a valor (p. ej. 2 y 1)
--   importes: valor es lo que paga cada uno; tiene que sumar el total
-- Los céntimos que sobran al dividir van a los primeros de la lista.
create or replace function public.guardar_movimiento(
  p_id uuid, p_viaje uuid, p_tipo text, p_titulo text, p_categoria text, p_fecha date,
  p_importe numeric, p_pagador uuid, p_modo text, p_partes jsonb)
returns uuid
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare
  v viajes; mid uuid; total_c bigint; suma numeric := 0; asignado bigint := 0; n int;
  ids uuid[]; vals numeric[]; cents bigint[]; restos numeric[]; i int; orden int[];
begin
  select * into v from viajes where id = p_viaje and compartido;
  if not found or not es_miembro(p_viaje) then raise exception 'viaje no válido'; end if;
  if v.cerrado then raise exception 'el viaje está terminado'; end if;
  if p_importe is null or p_importe <= 0 or p_importe >= 100000 then raise exception 'importe no válido'; end if;
  if p_modo not in ('iguales', 'importes', 'partes') then raise exception 'reparto no válido'; end if;
  if not exists (select 1 from viaje_miembros where id = p_pagador and viaje_id = p_viaje) then
    raise exception 'quien paga no está en el viaje';
  end if;

  select array_agg((e->>'miembro')::uuid order by ord),
         array_agg(case when p_modo = 'iguales' then 1 else coalesce((e->>'valor')::numeric, 0) end order by ord)
    into ids, vals
  from jsonb_array_elements(coalesce(p_partes, '[]'::jsonb)) with ordinality as t(e, ord);
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then raise exception 'elige entre quién se reparte'; end if;
  if (select count(distinct x) from unnest(ids) x) <> n
     or (select count(*) from viaje_miembros where viaje_id = p_viaje and id = any (ids)) <> n then
    raise exception 'participantes no válidos';
  end if;
  if exists (select 1 from unnest(vals) x where x < 0) then raise exception 'reparto no válido'; end if;
  select sum(x) into suma from unnest(vals) x;
  total_c := round(p_importe * 100);

  cents := array_fill(0::bigint, array[n]);
  restos := array_fill(0::numeric, array[n]);
  if p_modo = 'importes' then
    if abs(suma - p_importe) > 0.005 then raise exception 'los importes no suman el total'; end if;
    for i in 1..n loop cents[i] := round(vals[i] * 100); asignado := asignado + cents[i]; end loop;
    cents[1] := cents[1] + (total_c - asignado);  -- ajuste de redondeo
  else
    if suma <= 0 then raise exception 'reparto no válido'; end if;
    for i in 1..n loop
      cents[i] := floor(total_c * vals[i] / suma);
      restos[i] := total_c * vals[i] / suma - cents[i];
      asignado := asignado + cents[i];
    end loop;
    select array_agg(k order by restos[k] desc, k) into orden from generate_series(1, n) k;
    for i in 1..(total_c - asignado) loop cents[orden[i]] := cents[orden[i]] + 1; end loop;
  end if;

  if p_id is null then
    insert into movimientos (viaje_id, tipo, titulo, categoria, importe, pagador, modo, fecha)
    values (p_viaje, p_tipo, trim(p_titulo), p_categoria, round(p_importe, 2), p_pagador, p_modo,
            coalesce(p_fecha, ((now() at time zone 'Europe/Madrid'))::date))
    returning id into mid;
  else
    update movimientos set tipo = p_tipo, titulo = trim(p_titulo), categoria = p_categoria,
      importe = round(p_importe, 2), pagador = p_pagador, modo = p_modo, fecha = coalesce(p_fecha, fecha)
    where id = p_id and viaje_id = p_viaje returning id into mid;
    if mid is null then raise exception 'movimiento no válido'; end if;
    delete from movimiento_partes where movimiento_id = mid;
  end if;
  insert into movimiento_partes (movimiento_id, miembro_id, valor, importe)
  select mid, ids[k], vals[k], cents[k] / 100.0 from generate_series(1, n) k;
  perform sincronizar_movimiento(mid);
  return mid;
end $$;
revoke all on function public.guardar_movimiento(uuid, uuid, text, text, text, date, numeric, uuid, text, jsonb) from public, anon;
grant execute on function public.guardar_movimiento(uuid, uuid, text, text, text, date, numeric, uuid, text, jsonb) to authenticated;

create or replace function public.borrar_movimiento(p_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare vid uuid;
begin
  select viaje_id into vid from movimientos where id = p_id;
  if vid is null or not es_miembro(vid) then raise exception 'movimiento no válido'; end if;
  delete from movimientos where id = p_id;  -- las partes y las copias personales se borran en cascada
end $$;
revoke all on function public.borrar_movimiento(uuid) from public, anon;
grant execute on function public.borrar_movimiento(uuid) to authenticated;
