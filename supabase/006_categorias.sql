-- Gastos Erasmus: categorías personalizables por usuario.
-- Cada usuario tiene su lista (nombre, color, icono y orden). gastos.categoria guarda
-- la "clave" de la categoría, que no cambia aunque se renombre.
-- Las 10 categorías de siempre se crean para cada cuenta, con las mismas claves,
-- así que los gastos que ya existen no cambian.

create table if not exists public.categorias (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave      text not null check (clave ~ '^[a-z0-9-]{1,40}$'),
  nombre     text not null check (char_length(trim(nombre)) between 1 and 24),
  color      text not null default '#a1a1aa' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icono      text not null default 'otros' check (char_length(icono) between 1 and 30),
  orden      int  not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, clave)
);

-- El atajo elige por nombre, así que dos categorías no pueden llamarse igual.
create unique index if not exists categorias_user_nombre_idx on public.categorias (user_id, lower(trim(nombre)));

alter table public.categorias enable row level security;
create policy "categorias propias" on public.categorias
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.categorias from anon;

-- Las 10 categorías de siempre, para quien todavía no tenga ninguna.
create or replace function public.categorias_iniciales(p_uid uuid)
returns void
language sql security definer set search_path = public, pg_catalog
as $$
  insert into categorias (user_id, clave, nombre, color, icono, orden)
  select p_uid, c.clave, c.nombre, c.color, c.clave, c.orden
  from (values
    ('comida', 'Comida', '#7dd3fc', 0), ('tabaco', 'Tabaco', '#fdba74', 1),
    ('alcohol', 'Alcohol', '#f9a8d4', 2), ('ocio', 'Ocio', '#c4b5fd', 3),
    ('viajes', 'Viajes', '#c5f04a', 4), ('transporte', 'Transporte', '#d4d4d8', 5),
    ('casa', 'Casa', '#fde68a', 6), ('compras', 'Compras', '#86efac', 7),
    ('estudios', 'Estudios', '#93c5fd', 8), ('otros', 'Otros', '#a1a1aa', 9)
  ) as c(clave, nombre, color, orden)
  where p_uid is not null
    and not exists (select 1 from categorias where user_id = p_uid)
$$;
revoke all on function public.categorias_iniciales(uuid) from public, anon, authenticated;

-- La app la llama al entrar si el usuario aún no tiene categorías.
create or replace function public.crear_categorias_iniciales()
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  perform categorias_iniciales(auth.uid());
end $$;
revoke all on function public.crear_categorias_iniciales() from public, anon;
grant execute on function public.crear_categorias_iniciales() to authenticated;

-- Cuentas que ya existen.
select public.categorias_iniciales(id) from auth.users;

-- gastos.categoria ya no está limitada a las 10 de siempre.
alter table public.gastos drop constraint if exists gastos_categoria_valida;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_categoria_formato') then
    alter table public.gastos add constraint gastos_categoria_formato check (char_length(categoria) between 1 and 40);
  end if;
end $$;

-- Lista de categorías para el atajo, en el orden del usuario: {"categorias": ["Comida", ...]}
create or replace function public.mis_categorias(p_token text)
returns json
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare uid uuid;
begin
  select user_id into uid from atajo_tokens where token = p_token;
  if uid is null then raise exception 'token no válido'; end if;
  perform categorias_iniciales(uid);
  return json_build_object('categorias',
    (select json_agg(nombre order by orden, created_at) from categorias where user_id = uid));
end $$;
revoke all on function public.mis_categorias(text) from public;
grant execute on function public.mis_categorias(text) to anon, authenticated;

-- Traduce lo que manda el atajo (nombre o clave; también los nombres del atajo antiguo)
-- a la clave de una categoría del usuario. Si no encaja ninguna, va a «Otros» o a la primera.
create or replace function public.resolver_categoria(p_uid uuid, p_categoria text)
returns text
language plpgsql stable security definer set search_path = public, pg_catalog
as $$
declare t text := lower(trim(coalesce(p_categoria, ''))); c text;
begin
  select clave into c from categorias
    where user_id = p_uid and (lower(trim(nombre)) = t or clave = t) limit 1;
  if c is null then
    select clave into c from categorias where user_id = p_uid and clave = normalizar_categoria(p_categoria);
  end if;
  if c is null then
    select clave into c from categorias where user_id = p_uid
      order by (clave = 'otros') desc, orden, created_at limit 1;
  end if;
  return coalesce(c, 'otros');
end $$;
revoke all on function public.resolver_categoria(uuid, text) from public, anon, authenticated;

-- Igual que antes, pero con las categorías del usuario y su nombre en el mensaje.
create or replace function public.add_gasto(
  p_token text, p_importe numeric, p_categoria text, p_nota text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare uid uuid; g gastos; recientes int; nombre_cat text;
begin
  select user_id into uid from atajo_tokens where token = p_token;
  if uid is null then raise exception 'token no válido'; end if;
  select count(*) into recientes from gastos
    where user_id = uid and created_at > now() - interval '1 minute';
  if recientes >= 30 then raise exception 'demasiados gastos seguidos, espera un minuto'; end if;
  if p_importe is null or p_importe <= 0 or p_importe >= 100000 then
    raise exception 'importe no válido';
  end if;
  perform categorias_iniciales(uid);
  insert into gastos (user_id, importe, categoria, nota)
  values (uid, round(p_importe, 2), resolver_categoria(uid, p_categoria), left(nullif(trim(p_nota), ''), 200))
  returning * into g;
  select nombre into nombre_cat from categorias where user_id = uid and clave = g.categoria;
  return json_build_object('ok', true, 'importe', g.importe, 'categoria', g.categoria,
    'mensaje', 'Apuntado: ' || replace(g.importe::text, '.', ',') || ' € en ' || coalesce(nombre_cat, initcap(g.categoria)));
end $$;
