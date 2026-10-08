# Gastos Erasmus: guía de puesta en marcha

Son 4 pasos. Solo hay que hacerlos una vez.

## 1. Base de datos (Supabase, gratis)

1. Entra en https://supabase.com, crea una cuenta y pulsa **New project**. Elige la región **Europe (Frankfurt)** o la más cercana. Apunta la contraseña de la base de datos en algún sitio, aunque no la vas a necesitar para la app.
2. Cuando el proyecto esté listo, ve a **SQL Editor > New query**, pega todo el contenido de `supabase/schema.sql` y pulsa **Run**. Tiene que decir "Success".
3. Ve a **Authentication > Sign In / Providers > Email** y desactiva **Confirm email**. Así no tienes que confirmar tu propia cuenta por correo. Es opcional.
4. Ve a **Project Settings > API** (o **API Keys**) y copia:
   - la **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - la clave **anon / publishable** (la pública, *no* la `service_role` / `secret`)
5. Pásamelas (las dos son públicas, no pasa nada) y las pongo en `config.js`.

## 1b. Seguridad y login con Google

**Refuerzo de seguridad.** En el SQL Editor, ejecuta también `supabase/002_seguridad.sql` (New query, pegar y Run).

**Contraseñas.** En **Authentication > Sign In / Providers > Email**, pon **Minimum password length** en 8 y activa **Prevent use of leaked passwords** si aparece. Supabase guarda las contraseñas cifradas con bcrypt: ni la app ni tú las veis nunca.

**Login con Google:**
1. Entra en https://console.cloud.google.com, crea un proyecto (por ejemplo `gastos-erasmus`).
2. **APIs y servicios > Pantalla de consentimiento de OAuth** (o **Google Auth Platform**): tipo *Externo*, nombre de la app `Gastos Erasmus` y tu email. Guarda.
3. **APIs y servicios > Credenciales > Crear credenciales > ID de cliente de OAuth**:
   - Tipo: **Aplicación web**
   - **Orígenes de JavaScript autorizados:** `https://alcubillaguillem.github.io`
   - **URIs de redirección autorizados:** `https://oawjytdklkqhwtglfbhp.supabase.co/auth/v1/callback`
   - Crear. Copia el **ID de cliente** y el **Secreto del cliente**.
4. En Supabase: **Authentication > Sign In / Providers > Google**, actívalo y pega el ID y el secreto. Guarda. (El secreto no me lo pases a mí: va solo en Supabase.)
5. En Supabase: **Authentication > URL Configuration**:
   - **Site URL:** `https://alcubillaguillem.github.io/gastos-erasmus_/`
   - **Redirect URLs:** añade `https://alcubillaguillem.github.io/gastos-erasmus_/`

**Cerrar el registro.** Cuando ya hayas entrado una vez (con Google o email), ve a **Authentication > Sign In / Providers** y desactiva **Allow new users to sign up**. Así nadie más puede crearse una cuenta en tu base de datos.

**Sesión recordada.** La app guarda la sesión en cada dispositivo y la renueva sola: solo tendrás que volver a entrar si pulsas *Cerrar sesión* o borras los datos del navegador.

## 2. Publicar la web (GitHub Pages, gratis)

1. Yo subo el código a tu repositorio de GitHub.
2. En el repositorio: **Settings > Pages > Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` y **Save**.
3. Al cabo de un minuto la app estará en https://alcubillaguillem.github.io/gastos-erasmus_/.

## 3. Instalarla en el iPhone y el ordenador

- **iPhone:** abre la dirección en **Safari**, pulsa **Compartir** y luego **Añadir a pantalla de inicio**. Se abre a pantalla completa, como una app.
- **Ordenador:** abre la misma dirección en Chrome, Edge o Safari. En Chrome puedes instalarla con el icono de la barra de direcciones.
- La primera vez pulsa **Crear cuenta** con tu email y una contraseña. En el otro dispositivo, **Entrar** con los mismos datos.

## 4. Apuntar gastos desde el Centro de control

La guía paso a paso está dentro de la app: **⚙︎ Ajustes › 📲 Apuntar gastos desde el Centro de control**. Ahí tienes tus datos (dirección, clave y token) con botones para copiarlos.

El atajo hace tres preguntas: **importe**, **tipo de gasto** (desplegable) e **info adicional** (opcional), y guarda el gasto llamando a `add_gasto`. Con iOS 18 o posterior se añade como botón al Centro de control.

### 4b. Publicar el atajo «plantilla» (solo el administrador, una vez)

Para que tus amigos lo instalen en 3 toques (copiar código, Añadir atajo, Centro de control) hace falta un atajo ya montado y compartido por iCloud:

1. En tu iPhone, crea el atajo **Apunta gasto** siguiendo «¿Prefieres crearlo a mano?» en la app.
2. En la acción **Obtener contenido de URL**, deja fijos la URL y el encabezado `apikey`. En el campo `p_token` pon la variable **Texto** de una acción **Texto** que esté arriba del todo del atajo.
3. Abre los ajustes del atajo (ⓘ) › **Configurar** › **Pregunta de importación** › **Añadir pregunta**. Elige esa acción Texto y escribe como pregunta: *Pega aquí tu código*. Borra antes tu propio código de esa casilla.
4. Comparte el atajo: **Compartir › Copiar enlace de iCloud**.
5. Pega ese enlace en `config.js`, en `shortcutUrl`, y sube los cambios. Desde ese momento, en Ajustes aparece el botón **Añadir el atajo**.

## Si algo falla

- **"token no válido"**: revisa que copiaste el token entero, sin espacios.
- **Error 401 / "No API key found"**: falta el encabezado `apikey` o la clave está mal copiada.
- **Error 404**: la URL debe terminar en `/rest/v1/rpc/add_gasto_texto` o `/rest/v1/rpc/add_gasto`, y tienes que haber ejecutado `schema.sql`.
