// Edge Function «avisar»: manda el aviso «Gasto apuntado» a los dispositivos del usuario.
// La llama add_gasto (pg_net) con {"gasto": "<uuid>"} y la cabecera x-aviso (llave de Vault).
// No necesita sesión: aviso_datos solo responde con la llave correcta, para un gasto de hace
// menos de 2 minutos y una sola vez. Los datos solo los lee esta función (service_role).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const APP = "https://alcubillaguillem.github.io/gastos-erasmus_/";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método no permitido", { status: 405 });
  const { gasto } = await req.json().catch(() => ({}));
  if (typeof gasto !== "string" || !/^[0-9a-f-]{36}$/i.test(gasto)) {
    return new Response("gasto no válido", { status: 400 });
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const secreto = req.headers.get("x-aviso") ?? "";
  const { data, error } = await sb.rpc("aviso_datos", { p_gasto: gasto, p_secreto: secreto });
  if (error) return new Response(error.message, { status: 500 });
  if (!data || !data.subs?.length) return Response.json({ enviados: 0 });

  webpush.setVapidDetails(APP, data.publica, data.privada);
  const carga = JSON.stringify({ titulo: data.titulo, cuerpo: data.cuerpo });
  let enviados = 0;
  await Promise.all(data.subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        carga,
        { TTL: 3600, urgency: "high" },
      );
      enviados++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // 404/410: el dispositivo ya no acepta avisos (app borrada o permiso quitado).
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", s.endpoint);
      else console.error("aviso fallido", code, String(e));
    }
  }));
  return Response.json({ enviados });
});
