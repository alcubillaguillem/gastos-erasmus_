-- Gastos Erasmus: ajustes tras el análisis de seguridad de Supabase (aplicado el 2026-10-08).
-- Fija el search_path de las funciones auxiliares y deja add_gasto / add_gasto_texto
-- accesibles solo para el Atajo de iOS (rol anon + token), no para sesiones de la app.
alter function public.detectar_categoria(text) set search_path = public, pg_catalog;
alter function public.normalizar_categoria(text) set search_path = public, pg_catalog;
revoke execute on function public.add_gasto(text, numeric, text, text) from authenticated;
revoke execute on function public.add_gasto_texto(text, text) from authenticated;
