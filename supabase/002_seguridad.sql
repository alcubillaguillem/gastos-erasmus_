-- Gastos Erasmus: refuerzo de seguridad (ejecutar DESPUÉS de schema.sql).
-- Supabase > SQL Editor > New query > pegar todo > Run. Se puede ejecutar más de una vez.

-- 1. Límites en los datos: categorías válidas, importes razonables y notas cortas.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'gastos_categoria_valida') then
    alter table public.gastos add constraint gastos_categoria_valida check (categoria in
      ('comida','tabaco','alcohol','ocio','viajes','transporte','casa','compras','estudios','otros'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gastos_importe_max') then
    alter table public.gastos add constraint gastos_importe_max check (importe < 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'gastos_nota_corta') then
    alter table public.gastos add constraint gastos_nota_corta check (char_length(nota) <= 200);
  end if;
end $$;

-- 2. El Atajo (Siri / widget) no puede meter más de 30 gastos por minuto,
--    por si alguien consiguiera el token. Las notas se recortan a 200 caracteres.
create or replace function public.add_gasto(
  p_token text, p_importe numeric, p_categoria text, p_nota text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare uid uuid; g gastos; recientes int;
begin
  select user_id into uid from atajo_tokens where token = p_token;
  if uid is null then raise exception 'token no válido'; end if;
  select count(*) into recientes from gastos
    where user_id = uid and created_at > now() - interval '1 minute';
  if recientes >= 30 then raise exception 'demasiados gastos seguidos, espera un minuto'; end if;
  if p_importe is null or p_importe <= 0 or p_importe >= 100000 then
    raise exception 'importe no válido';
  end if;
  insert into gastos (user_id, importe, categoria, nota)
  values (uid, round(p_importe, 2), normalizar_categoria(p_categoria), left(nullif(trim(p_nota), ''), 200))
  returning * into g;
  return json_build_object('ok', true, 'importe', g.importe, 'categoria', g.categoria,
    'mensaje', 'Apuntado: ' || replace(g.importe::text, '.', ',') || ' € en ' || initcap(g.categoria));
end $$;

-- 3. Permisos: solo lo imprescindible es accesible sin iniciar sesión.
revoke all on function public.add_gasto(text, numeric, text, text) from public;
grant execute on function public.add_gasto(text, numeric, text, text) to anon, authenticated;
revoke all on function public.mi_token_atajo() from public, anon;
revoke all on function public.regenerar_token_atajo() from public, anon;
revoke all on table public.atajo_tokens from anon;
revoke insert, update, delete on table public.atajo_tokens from authenticated;
