-- Gastos Erasmus: esquema de base de datos para Supabase.
-- Pégalo entero en Supabase > SQL Editor > New query y pulsa "Run".

create table if not exists public.gastos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  importe    numeric(10,2) not null check (importe > 0),
  categoria  text not null,
  nota       text,
  fecha      date not null default (now() at time zone 'Europe/Madrid')::date,
  created_at timestamptz not null default now()
);

create index if not exists gastos_user_fecha_idx on public.gastos (user_id, fecha desc);

alter table public.gastos enable row level security;

drop policy if exists "gastos propios" on public.gastos;
create policy "gastos propios" on public.gastos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Token secreto para el Atajo de iOS (Siri / widget). Un token por usuario.
create table if not exists public.atajo_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token   text not null unique default encode(gen_random_bytes(24), 'hex')
);

alter table public.atajo_tokens enable row level security;

drop policy if exists "token propio" on public.atajo_tokens;
create policy "token propio" on public.atajo_tokens
  for select using (user_id = auth.uid());

-- Devuelve (y crea si hace falta) el token del usuario conectado. Lo usa la app web.
create or replace function public.mi_token_atajo()
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  insert into atajo_tokens (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select token into t from atajo_tokens where user_id = auth.uid();
  return t;
end $$;

-- Genera un token nuevo (invalida el anterior).
create or replace function public.regenerar_token_atajo()
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  insert into atajo_tokens (user_id, token) values (auth.uid(), encode(gen_random_bytes(24), 'hex'))
  on conflict (user_id) do update set token = excluded.token
  returning token into t;
  return t;
end $$;

-- Categorías válidas y palabras con las que se reconocen al dictar a Siri.
create or replace function public.detectar_categoria(p_texto text)
returns text
language sql immutable
as $$
  select case
    when t ~ '(tabaco|cigarr|pitillo|\mpapel(es|illo)|filtro|vaper|vape)' then 'tabaco'
    when t ~ '(alcohol|cerve|birra|vino|chupito|copa|cubata|\mron\M|vodka|ginebra|\mgin\M|whisky|botell|jager)' then 'alcohol'
    when t ~ '(fiesta|discoteca|disco|entrada|club|concierto|cine|ocio|museo)' then 'ocio'
    when t ~ '(vuelo|avion|avión|viaje|ryanair|vueling|hostel|hotel|airbnb|excursi)' then 'viajes'
    when t ~ '(\mbus\M|autobus|autobús|metro|tren|taxi|uber|bolt|bici|patinete|gasolina|transporte|billete)' then 'transporte'
    when t ~ '(super|mercadona|lidl|aldi|carrefour|compra|comida|cena|almuerzo|desayuno|restaurante|kebab|pizza|burger|cafe|café|bocadillo|menu|menú)' then 'comida'
    when t ~ '(alquiler|piso|residencia|luz|agua|internet|factura|movil|móvil)' then 'casa'
    when t ~ '(ropa|zapat|regalo|tienda|amazon|farmacia|peluquer)' then 'compras'
    when t ~ '(universidad|\muni\M|libro|apuntes|fotocopia|matricula|matrícula)' then 'estudios'
    else 'otros'
  end
  from (select lower(coalesce(p_texto, '')) as t) s
$$;

create or replace function public.normalizar_categoria(p_categoria text)
returns text
language sql immutable
as $$
  select case
    when lower(trim(p_categoria)) in
      ('comida','tabaco','alcohol','ocio','viajes','transporte','casa','compras','estudios','otros')
      then lower(trim(p_categoria))
    else public.detectar_categoria(p_categoria)
  end
$$;

-- Añadir gasto desde el Atajo con importe y categoría por separado.
create or replace function public.add_gasto(
  p_token text, p_importe numeric, p_categoria text, p_nota text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare uid uuid; g gastos;
begin
  select user_id into uid from atajo_tokens where token = p_token;
  if uid is null then raise exception 'token no válido'; end if;
  if p_importe is null or p_importe <= 0 then raise exception 'importe no válido'; end if;
  insert into gastos (user_id, importe, categoria, nota)
  values (uid, round(p_importe, 2), normalizar_categoria(p_categoria), nullif(trim(p_nota), ''))
  returning * into g;
  return json_build_object('ok', true, 'importe', g.importe, 'categoria', g.categoria,
    'mensaje', 'Apuntado: ' || replace(g.importe::text, '.', ',') || ' € en ' || initcap(g.categoria));
end $$;

-- Añadir gasto a partir de una frase dictada: "5 euros de tabaco", "12,50 cena kebab".
create or replace function public.add_gasto_texto(p_token text, p_texto text)
returns json
language plpgsql security definer set search_path = public
as $$
declare num text; imp numeric;
begin
  -- Prioriza el número que va junto a "euros" o "€"; si no hay, el primero que aparezca.
  num := coalesce(
    substring(p_texto from '(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)'),
    substring(p_texto from '(\d+(?:[.,]\d{1,2})?)'));
  if num is null then raise exception 'No he encontrado ningún importe en "%"', p_texto; end if;
  imp := replace(num, ',', '.')::numeric;
  return add_gasto(p_token, imp, detectar_categoria(p_texto), p_texto);
end $$;

-- El Atajo llama a estas funciones sin iniciar sesión (rol anon); el token protege el acceso.
revoke all on function public.add_gasto(text, numeric, text, text) from public;
revoke all on function public.add_gasto_texto(text, text) from public;
grant execute on function public.add_gasto(text, numeric, text, text) to anon, authenticated;
grant execute on function public.add_gasto_texto(text, text) to anon, authenticated;
revoke all on function public.mi_token_atajo() from public, anon;
revoke all on function public.regenerar_token_atajo() from public, anon;
grant execute on function public.mi_token_atajo() to authenticated;
grant execute on function public.regenerar_token_atajo() to authenticated;
