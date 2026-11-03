-- Gastos Erasmus: avisos de la propia app (Web Push) al apuntar un gasto desde el atajo.
-- Cada dispositivo que activa los avisos guarda aquí su suscripción. Cuando add_gasto
-- guarda un gasto, pide a la función «avisar» (Edge Function) que mande el aviso.
-- Las claves VAPID se guardan en Vault (vapid_publica, vapid_privada), fuera de este archivo.

create extension if not exists pg_net;

create table if not exists public.push_subs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) between 1 and 200),
  auth       text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;
create policy "push_subs propias" on public.push_subs
  for select using (user_id = (select auth.uid()));
revoke all on table public.push_subs from anon;

-- Un mismo móvil puede cambiar de cuenta: la suscripción pasa a quien la guarda.
create or replace function public.guardar_aviso(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if (select count(*) from push_subs where user_id = auth.uid()) >= 10 then
    delete from push_subs where id = (select id from push_subs where user_id = auth.uid() order by created_at limit 1);
  end if;
  insert into push_subs (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end $$;
revoke all on function public.guardar_aviso(text, text, text) from public, anon;
grant execute on function public.guardar_aviso(text, text, text) to authenticated;

create or replace function public.quitar_aviso(p_endpoint text)
returns void
language sql security definer set search_path = public, pg_catalog
as $$
  delete from push_subs where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.quitar_aviso(text) from public, anon;
grant execute on function public.quitar_aviso(text) to authenticated;

-- Cada gasto se avisa una sola vez.
create table if not exists public.avisos_enviados (
  gasto_id   uuid primary key references public.gastos(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.avisos_enviados enable row level security;
revoke all on table public.avisos_enviados from anon, authenticated;

-- Lo que necesita la función «avisar». Solo la puede llamar ella (service_role),
-- solo para gastos de hace menos de 2 minutos y solo una vez por gasto.
create or replace function public.aviso_datos(p_gasto uuid)
returns json
language plpgsql security definer set search_path = public, pg_catalog
as $$
declare g gastos; nombre_cat text;
begin
  select * into g from gastos where id = p_gasto and created_at > now() - interval '2 minutes';
  if not found then return null; end if;
  insert into avisos_enviados (gasto_id) values (p_gasto) on conflict do nothing;
  if not found then return null; end if;
  select nombre into nombre_cat from categorias where user_id = g.user_id and clave = g.categoria;
  return json_build_object(
    'titulo', 'Gasto apuntado',
    'cuerpo', replace(g.importe::text, '.', ',') || ' € en ' || coalesce(nombre_cat, initcap(g.categoria))
              || coalesce(' · ' || g.nota, ''),
    'subs', (select json_agg(json_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth))
             from push_subs where user_id = g.user_id),
    'publica', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_publica'),
    'privada', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_privada'));
end $$;
revoke all on function public.aviso_datos(uuid) from public, anon, authenticated;
grant execute on function public.aviso_datos(uuid) to service_role;

-- add_gasto: igual que en 006, pero si el usuario tiene avisos activados pide el aviso
-- y devuelve «notificar» vacío para que el atajo no muestre el suyo.
create or replace function public.add_gasto(
  p_token text, p_importe numeric, p_categoria text, p_nota text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare uid uuid; g gastos; recientes int; nombre_cat text; mensaje text; avisado boolean := false;
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
  mensaje := 'Apuntado: ' || replace(g.importe::text, '.', ',') || ' € en ' || coalesce(nombre_cat, initcap(g.categoria));
  if exists (select 1 from push_subs where user_id = uid) then
    begin
      perform net.http_post(
        url := 'https://oawjytdklkqhwtglfbhp.supabase.co/functions/v1/avisar',
        body := jsonb_build_object('gasto', g.id),
        headers := jsonb_build_object('Content-Type', 'application/json'));
      avisado := true;
    exception when others then
      avisado := false;  -- si falla el aviso, el gasto se guarda igual y el atajo muestra el suyo
    end;
  end if;
  return json_build_object('ok', true, 'importe', g.importe, 'categoria', g.categoria,
    'mensaje', mensaje, 'notificar', case when avisado then null else mensaje end);
end $$;
