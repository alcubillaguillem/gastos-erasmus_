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

## 4. Atajos de Siri y widget

Abre la app web, ve a **⚙︎ Ajustes** y copia la **URL**, la **Clave anon** y el **Token**. El token es tu llave personal: no lo compartas.

### Atajo A: "Apunta gasto" (para Siri, todo de una vez)

Dices: *"Oye Siri, apunta gasto"*, Siri pregunta *"¿Qué has gastado?"* y respondes *"5 euros de tabaco"*.

En la app **Atajos**, pulsa **+** y añade estas acciones en orden:

1. **Pedir entrada**: tipo *Texto*, pregunta `¿Qué has gastado?`
2. **Obtener contenido de URL**:
   - URL: `TU_URL/rest/v1/rpc/add_gasto_texto` (por ejemplo `https://abcdxyz.supabase.co/rest/v1/rpc/add_gasto_texto`)
   - Pulsa la flecha para ver más opciones. **Método:** `POST`
   - **Encabezados:** `apikey` = *tu clave anon*, y `Content-Type` = `application/json`
   - **Cuerpo de solicitud:** *JSON*, con dos campos de texto:
     - `p_token` = *tu token*
     - `p_texto` = variable **Entrada proporcionada**
3. **Obtener valor del diccionario**: clave `mensaje`
4. **Mostrar notificación**: *Valor del diccionario*

Renombra el atajo a **Apunta gasto**. Ese nombre es lo que le dices a Siri.

La categoría se adivina por las palabras: *tabaco, cigarros* → Tabaco; *cerveza, birra, copa, chupito* → Alcohol; *cena, kebab, súper, Mercadona* → Comida; *bus, metro, taxi* → Transporte; *vuelo, Ryanair, hostel* → Viajes; *fiesta, discoteca, concierto* → Ocio, etc. Si no reconoce nada lo pone en *Otros*, y lo puedes corregir en la app.

### Atajo B: "Gasto rápido" (para el widget, con botones)

1. **Pedir entrada**: tipo *Número*, pregunta `¿Cuánto?`
2. **Elegir de la lista**: escribe la lista `Comida, Tabaco, Alcohol, Ocio, Viajes, Transporte, Casa, Compras, Estudios, Otros`
3. **Obtener contenido de URL**: igual que en el atajo A, pero:
   - URL: `TU_URL/rest/v1/rpc/add_gasto`
   - Cuerpo JSON: `p_token` = *tu token* (texto), `p_importe` = **Entrada proporcionada** (tipo *Número*), `p_categoria` = **Elemento elegido** (texto)
4. **Obtener valor del diccionario**: `mensaje`
5. **Mostrar notificación**: *Valor del diccionario*

### Ponerlo a mano

- **Widget en la pantalla de inicio:** mantén pulsado un hueco de la pantalla, pulsa **Editar > Añadir widget > Atajos** y elige el tamaño pequeño con *Gasto rápido*.
- **Pantalla bloqueada:** mantén pulsada la pantalla bloqueada, **Personalizar > Pantalla bloqueada > widgets > Atajos**.
- **Botón de Acción** (iPhone 15 Pro o posterior): **Ajustes > Botón de Acción > Atajo > Gasto rápido**.
- **Recordatorio diario:** en Atajos, **Automatización > + > Hora del día** (por ejemplo, 22:00) > **Ejecutar inmediatamente** > acción **Ejecutar atajo: Gasto rápido**, o simplemente **Mostrar notificación** "¿Has apuntado los gastos de hoy?".

## Si algo falla

- **"token no válido"**: revisa que copiaste el token entero, sin espacios.
- **Error 401 / "No API key found"**: falta el encabezado `apikey` o la clave está mal copiada.
- **Error 404**: la URL debe terminar en `/rest/v1/rpc/add_gasto_texto` o `/rest/v1/rpc/add_gasto`, y tienes que haber ejecutado `schema.sql`.
