# Gastos Erasmus

App web instalable (PWA) para controlar los gastos del Erasmus por categorías, en el iPhone y en el ordenador, con sincronización mediante Supabase y un atajo de iOS en el Centro de control para apuntar gastos en segundos.

- `index.html`, `styles.css`, `app.js`: la app. Sin dependencias de compilación; se sirve tal cual (GitHub Pages).
- `config.js`: URL y clave pública de Supabase. Vacío = modo local (solo este navegador).
- `supabase/schema.sql`: tablas, seguridad por usuario (RLS) y las funciones `add_gasto` / `add_gasto_texto` que usan los atajos de iOS.
- `GUIA.md`: puesta en marcha paso a paso y cómo crear los atajos.

Probar en local: `python3 -m http.server` en esta carpeta y abrir http://localhost:8000.
