/* Viajes compartidos: participantes, gastos a medias, saldos e invitaciones por enlace.
 * Se carga antes que app.js y usa sus funciones y su estado (state, sb, $, fmt, toast…)
 * solo cuando se llama, nunca al cargar.
 *
 * Datos (Supabase, migración 008):
 *   viaje_miembros: participantes (user_id si tienen cuenta)
 *   movimientos: gasto (lo paga uno y se reparte) o transferencia (uno le paga a otro)
 *   movimiento_partes: lo que le toca a cada uno
 * La parte de cada participante con cuenta se copia sola en sus gastos personales. */

const comp = {
  miembros: new Map(),  // viaje_id → participantes
  movs: new Map(),      // viaje_id → movimientos con sus partes
  tab: "gastos",        // pestaña del detalle: gastos | saldos | personas
  edit: null,           // { v, mv, desdeGasto } en la hoja de movimiento
  tipo: "gasto",
  modo: "iguales",
  invitacion: null,     // datos de la invitación abierta
};

const ICONO_FLECHA = "M5 12h14M13 6l6 6-6 6";
const ICONO_PERSONAS = "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6";
const ICONO_ENLACE = "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1";

const cent = (x) => Math.round(Number(x) * 100);
const deCent = (c) => c / 100;

async function rpc(nombre, args) {
  const { data, error } = await sb.rpc(nombre, args);
  if (error) throw error;
  return data;
}

// Mensaje legible de un error de Supabase (las funciones lanzan textos en español).
function textoError(e, porDefecto) {
  if (sinRed(e)) return "Sin conexión";
  const m = String(e?.message || "");
  return /^[a-záéíóúñ ]{3,80}$/i.test(m) ? m.charAt(0).toUpperCase() + m.slice(1) : porDefecto;
}

const miembrosDe = (v) => comp.miembros.get(v.id) || [];
const movsDe = (v) => comp.movs.get(v.id) || [];
const yoEn = (v) => miembrosDe(v).find((m) => m.user_id && m.user_id === state.user?.id) || null;
const esDueno = (v) => v.user_id === state.user?.id;
const nombreMiembro = (v, id) => miembrosDe(v).find((m) => m.id === id)?.nombre || "?";

async function cargarCompartido(v) {
  const [m, mv] = await Promise.all([
    sb.from("viaje_miembros").select("*").eq("viaje_id", v.id).order("created_at"),
    sb.from("movimientos").select("*, movimiento_partes(*)").eq("viaje_id", v.id)
      .order("fecha", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (m.error) throw m.error;
  if (mv.error) throw mv.error;
  comp.miembros.set(v.id, m.data);
  comp.movs.set(v.id, mv.data);
}

// Lo que ha pagado cada uno menos lo que le toca, en céntimos. Positivo: le deben.
function saldos(v) {
  const s = new Map(miembrosDe(v).map((m) => [m.id, 0]));
  for (const mv of movsDe(v)) {
    s.set(mv.pagador, (s.get(mv.pagador) || 0) + cent(mv.importe));
    for (const p of mv.movimiento_partes || []) s.set(p.miembro_id, (s.get(p.miembro_id) || 0) - cent(p.importe));
  }
  return s;
}

// El menor número de pagos para quedar en paz: el que más debe paga al que más le deben.
function comoSaldar(s) {
  const deben = [...s].filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c })).sort((a, b) => b.c - a.c);
  const cobran = [...s].filter(([, c]) => c > 0).map(([id, c]) => ({ id, c })).sort((a, b) => b.c - a.c);
  const pagos = [];
  let i = 0, j = 0;
  while (i < deben.length && j < cobran.length) {
    const x = Math.min(deben[i].c, cobran[j].c);
    if (x > 0) pagos.push({ de: deben[i].id, a: cobran[j].id, c: x });
    deben[i].c -= x; cobran[j].c -= x;
    if (!deben[i].c) i++;
    if (!cobran[j].c) j++;
  }
  return pagos;
}

// Mismo reparto que guardar_movimiento en Supabase, para enseñarlo antes de guardar.
function repartir(totalC, modo, filas) {
  const n = filas.length;
  if (!n) return [];
  if (modo === "importes") return filas.map((f) => cent(f.valor || 0));
  const pesos = filas.map((f) => (modo === "iguales" ? 1 : Math.max(0, Number(f.valor) || 0)));
  const suma = pesos.reduce((a, b) => a + b, 0);
  if (suma <= 0) return filas.map(() => 0);
  const exactos = pesos.map((p) => (totalC * p) / suma);
  const cents = exactos.map(Math.floor);
  let resto = totalC - cents.reduce((a, b) => a + b, 0);
  const orden = exactos.map((x, k) => [x - Math.floor(x), k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < resto; k++) cents[orden[k][1]]++;
  return cents;
}

function catPorNombre(nombre) {
  const t = String(nombre || "").trim().toLowerCase();
  const c = state.categorias.find((x) => x.nombre.trim().toLowerCase() === t || x.clave === t)
    || state.categorias.find((x) => x.clave === "otros") || state.categorias[0];
  return c ? catInfo(c.clave) : { nombre: "Otros", color: "#a1a1aa", icono: "" };
}

/* ---------- Detalle de un viaje compartido ---------- */

function renderCompartido(v, detalle, s) {
  if (!comp.miembros.has(v.id)) {
    detalle.innerHTML = `<div class="trip-actions"><button type="button" class="btn pill trip-back">${icono("M15 6l-6 6 6 6")}Viajes</button></div>
      <div class="empty">Cargando…</div>`;
    detalle.querySelector(".trip-back").addEventListener("click", () => { state.viajeSel = null; renderViajes(); });
    cargarCompartido(v).then(() => renderViajes()).catch((e) => {
      console.error(e);
      detalle.querySelector(".empty").textContent = sinRed(e) ? "Sin conexión. Los viajes compartidos necesitan internet." : "No se ha podido cargar el viaje";
    });
    return;
  }
  const yo = yoEn(v);
  const sal = saldos(v);
  const totalGrupo = movsDe(v).filter((m) => m.tipo === "gasto").reduce((a, m) => a + cent(m.importe), 0);
  const miParte = yo ? movsDe(v).filter((m) => m.tipo === "gasto")
    .reduce((a, m) => a + cent((m.movimiento_partes || []).find((p) => p.miembro_id === yo.id)?.importe || 0), 0) : 0;
  const miSaldo = yo ? sal.get(yo.id) || 0 : 0;
  const n = miembrosDe(v).length;
  const estado = v.cerrado ? " · cerrado" : s.estado === "en-curso" ? ` · día ${s.vividos} de ${s.dias}` : "";

  detalle.innerHTML = `
    <div class="trip-actions">
      <button type="button" class="btn pill small-pill trip-back">${icono("M15 6l-6 6 6 6")}Viajes</button>
      <button type="button" class="btn pill small-pill" id="trip-invite">${icono(ICONO_ENLACE)}Invitar</button>
      ${esDueno(v) ? `<button type="button" class="btn pill small-pill" id="trip-edit">Editar</button>` : ""}
    </div>
    <div class="trip-head">
      <div><div class="small muted">${esc(rangoTexto(v.inicio, v.fin))}${estado} · ${n} ${n === 1 ? "persona" : "personas"}</div><h2></h2></div>
      <div class="huge">${fmtGrande(deCent(totalGrupo))}</div>
    </div>
    <div class="comp-resumen">
      <div><span class="small muted">Tu parte</span><strong>${esc(fmt(deCent(miParte)))}</strong></div>
      <div><span class="small muted">${miSaldo > 0 ? "Te deben" : miSaldo < 0 ? "Debes" : "Saldo"}</span>
        <strong class="${miSaldo > 0 ? "pos" : miSaldo < 0 ? "neg" : ""}">${miSaldo ? esc(fmt(deCent(Math.abs(miSaldo)))) : "En paz"}</strong></div>
    </div>
    <div class="seg comp-tabs" role="tablist">
      <button type="button" role="tab" data-tab="gastos">Gastos</button>
      <button type="button" role="tab" data-tab="saldos">Saldos</button>
      <button type="button" role="tab" data-tab="personas">Personas</button>
    </div>
    <div class="comp-body"></div>
    ${esDueno(v) ? `<button type="button" class="btn wide trip-close" id="trip-close"></button>` : ""}`;
  detalle.querySelector("h2").textContent = v.nombre;
  detalle.querySelector(".trip-back").addEventListener("click", () => { state.viajeSel = null; renderViajes(); });
  detalle.querySelector("#trip-invite").addEventListener("click", () => invitar(v));
  detalle.querySelector("#trip-edit")?.addEventListener("click", () => abrirViaje(v));
  const cerrar = detalle.querySelector("#trip-close");
  if (cerrar) {
    cerrar.innerHTML = v.cerrado ? `${icono("M4 12a8 8 0 1 0 3-6.2M4 4v4h4")}Reabrir viaje` : `${icono(ICONO_CHECK)}Terminar viaje`;
    cerrar.classList.toggle("reopen", v.cerrado);
    cerrar.addEventListener("click", () => cambiarCerrado(v, !v.cerrado));
  }
  for (const b of detalle.querySelectorAll(".comp-tabs button")) {
    b.setAttribute("aria-selected", String(b.dataset.tab === comp.tab));
    b.addEventListener("click", () => { comp.tab = b.dataset.tab; renderViajes(); });
  }
  const cuerpo = detalle.querySelector(".comp-body");
  if (comp.tab === "saldos") pintarSaldos(v, cuerpo, sal);
  else if (comp.tab === "personas") pintarPersonas(v, cuerpo);
  else pintarMovimientos(v, cuerpo);
}

function pintarMovimientos(v, cont) {
  if (!v.cerrado) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn primary wide";
    add.innerHTML = `${icono("M12 5v14M5 12h14")}Añadir gasto`;
    add.addEventListener("click", () => abrirMov(v));
    cont.appendChild(add);
  }
  const lista = document.createElement("div");
  lista.className = "list";
  cont.appendChild(lista);
  const movs = movsDe(v);
  if (!movs.length) {
    lista.innerHTML = `<div class="empty">Aún no hay gastos. Añade el primero: quién pagó y entre quién se reparte.</div>`;
    return;
  }
  const hoy = hoyISO();
  const ayer = isoDate(new Date(Date.now() - 86400000));
  let dia = null;
  for (const mv of movs) {
    if (mv.fecha !== dia) {
      dia = mv.fecha;
      const delDia = movs.filter((x) => x.fecha === dia && x.tipo === "gasto").reduce((a, x) => a + cent(x.importe), 0);
      const head = document.createElement("div");
      head.className = "day";
      head.innerHTML = `<span></span><span>${delDia ? esc(fmt(deCent(delDia))) : ""}</span>`;
      head.firstChild.textContent = dia === hoy ? "Hoy" : dia === ayer ? "Ayer"
        : parseISO(dia).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
      lista.appendChild(head);
    }
    lista.appendChild(itemMov(v, mv));
  }
}

function itemMov(v, mv) {
  const yo = yoEn(v);
  const el = document.createElement("div");
  el.className = "item mov" + (mv.tipo === "transferencia" ? " transfer" : "");
  const c = mv.tipo === "gasto" ? catPorNombre(mv.categoria) : { color: "var(--muted)", icono: ICONO_FLECHA };
  el.innerHTML = `
    <span class="cat-ic" style="color:${c.color}">${icono(c.icono)}</span>
    <div class="info"><div class="note"></div><div class="meta"></div></div>
    <span class="amt">${esc(fmt(Number(mv.importe)).replace(/\s?€$/, ""))}</span>
    <button type="button" class="more" aria-label="Opciones">${icono(ICONO_MAS)}</button>`;
  const meta = el.querySelector(".meta");
  if (mv.tipo === "transferencia") {
    const a = mv.movimiento_partes?.[0]?.miembro_id;
    el.querySelector(".note").textContent = mv.titulo;
    meta.textContent = `${nombreMiembro(v, mv.pagador)} → ${nombreMiembro(v, a)}`;
  } else {
    el.querySelector(".note").textContent = mv.titulo;
    const pagoYo = yo && mv.pagador === yo.id;
    const mia = yo && (mv.movimiento_partes || []).find((p) => p.miembro_id === yo.id);
    meta.textContent = `${pagoYo ? "Pagaste tú" : `Pagó ${nombreMiembro(v, mv.pagador)}`} · `;
    const s = document.createElement("span");
    s.className = "trip";
    s.textContent = mia && Number(mia.importe) > 0 ? `tu parte ${fmt(Number(mia.importe))}` : "no participas";
    meta.append(s);
  }
  el.addEventListener("click", (e) => { if (!e.target.closest(".more")) abrirMov(v, mv); });
  el.querySelector(".more").addEventListener("click", () => menuMov(v, mv, el));
  mantenerPulsado(el, () => menuMov(v, mv, el));
  return el;
}

function menuMov(v, mv, el) {
  abrirMenu(el, (menu, colocar) => {
    menu.append(
      filaMenu("Editar", ICONO_EDITAR, () => { cerrarMenu(); abrirMov(v, mv); }),
      filaMenu("Eliminar", ICONO_PAPELERA, () => { cerrarMenu(); borrarMov(v, mv); }, { peligro: true }),
    );
    colocar();
  });
}

function pintarSaldos(v, cont, sal) {
  const yo = yoEn(v);
  const max = Math.max(1, ...[...sal.values()].map(Math.abs));
  const filas = document.createElement("div");
  filas.className = "saldos";
  for (const m of miembrosDe(v)) {
    const c = sal.get(m.id) || 0;
    const fila = document.createElement("div");
    fila.className = "saldo-row";
    fila.innerHTML = `<div class="row-top"><span class="s-name"></span><span class="${c > 0 ? "pos" : c < 0 ? "neg" : "muted"}">${c ? (c > 0 ? "+" : "−") + esc(fmt(deCent(Math.abs(c)))) : "0,00 €"}</span></div>
      <div class="saldo-bar"><div class="${c >= 0 ? "pos" : "neg"}" style="width:${(Math.abs(c) / max) * 50}%"></div></div>`;
    fila.querySelector(".s-name").textContent = m.nombre + (yo && m.id === yo.id ? " (tú)" : "");
    filas.appendChild(fila);
  }
  cont.appendChild(filas);

  const pagos = comoSaldar(sal);
  const box = document.createElement("div");
  box.className = "saldar";
  box.innerHTML = `<div class="label">Cómo quedar en paz</div>`;
  if (!pagos.length) box.insertAdjacentHTML("beforeend", `<div class="empty">Todo saldado. Nadie le debe nada a nadie.</div>`);
  for (const p of pagos) {
    const fila = document.createElement("div");
    fila.className = "pago-row";
    fila.innerHTML = `<div><div class="pago-txt"></div><div class="small muted">${esc(fmt(deCent(p.c)))}</div></div>
      <button type="button" class="btn pill small-pill">Saldar</button>`;
    const de = nombreMiembro(v, p.de), a = nombreMiembro(v, p.a);
    fila.querySelector(".pago-txt").textContent = yo && p.de === yo.id ? `Tú pagas a ${a}` : yo && p.a === yo.id ? `${de} te paga` : `${de} paga a ${a}`;
    const btn = fila.querySelector("button");
    if (v.cerrado) btn.remove();
    else btn.addEventListener("click", () => saldar(v, p, btn));
    box.appendChild(fila);
  }
  cont.appendChild(box);
}

async function saldar(v, p, btn) {
  const de = nombreMiembro(v, p.de), a = nombreMiembro(v, p.a);
  if (!(await confirmar({ titulo: "Saldar deuda", texto: `Se apunta que ${de} le ha pagado ${fmt(deCent(p.c))} a ${a}.`, aceptar: "Apuntar pago" }))) return;
  btn.disabled = true;
  try {
    await rpc("guardar_movimiento", {
      p_id: null, p_viaje: v.id, p_tipo: "transferencia", p_titulo: "Reembolso", p_categoria: null,
      p_fecha: hoyISO(), p_importe: deCent(p.c), p_pagador: p.de, p_modo: "importes",
      p_partes: [{ miembro: p.a, valor: deCent(p.c) }],
    });
    toast("Pago apuntado");
    await refrescarCompartido(v);
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido apuntar el pago"));
    btn.disabled = false;
  }
}

function pintarPersonas(v, cont) {
  const yo = yoEn(v);
  const lista = document.createElement("div");
  lista.className = "personas";
  for (const m of miembrosDe(v)) {
    const fila = document.createElement("div");
    fila.className = "persona-row";
    const etiqueta = yo && m.id === yo.id ? "Tú" : m.user_id === v.user_id ? "Creó el viaje" : m.user_id ? "Con cuenta" : "Sin cuenta todavía";
    fila.innerHTML = `<span class="avatar small-avatar"></span><div class="info"><div class="note"></div><div class="small muted">${etiqueta}</div></div>
      <button type="button" class="more" aria-label="Opciones">${icono(ICONO_MAS)}</button>`;
    const av = fila.querySelector(".avatar");
    av.textContent = m.nombre.trim().charAt(0).toUpperCase();
    av.style.background = colorPersona(m.nombre);
    fila.querySelector(".note").textContent = m.nombre;
    fila.querySelector(".more").addEventListener("click", () => menuPersona(v, m, fila));
    mantenerPulsado(fila, () => menuPersona(v, m, fila));
    lista.appendChild(fila);
  }
  cont.appendChild(lista);
  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn wide";
  add.innerHTML = `${icono("M12 5v14M5 12h14")}Añadir persona`;
  add.addEventListener("click", () => nuevaPersona(v));
  const inv = document.createElement("button");
  inv.type = "button";
  inv.className = "btn primary wide";
  inv.innerHTML = `${icono(ICONO_ENLACE)}Invitar con un enlace`;
  inv.addEventListener("click", () => invitar(v));
  const p = document.createElement("p");
  p.className = "small muted";
  p.textContent = "Quien abra el enlace verá el viaje en su app y podrá apuntar gastos. Si ya está en la lista, al unirse elige su nombre. Puedes añadir a alguien sin cuenta solo con su nombre.";
  cont.append(inv, add, p);
}

function menuPersona(v, m, el) {
  abrirMenu(el, (menu, colocar) => {
    menu.append(filaMenu("Cambiar nombre", ICONO_EDITAR, () => { cerrarMenu(); renombrarPersona(v, m); }));
    const yo = yoEn(v);
    const puedeQuitar = m.user_id !== v.user_id && (!m.user_id || esDueno(v) || (yo && yo.id === m.id));
    if (puedeQuitar) {
      menu.append(filaMenu(yo && yo.id === m.id ? "Salir del viaje" : "Quitar del viaje", ICONO_PAPELERA,
        () => { cerrarMenu(); quitarPersona(v, m); }, { peligro: true }));
    }
    colocar();
  });
}

async function nuevaPersona(v) {
  const nombre = (await preguntar({ titulo: "Añadir persona", texto: "Podrá unirse después con el enlace y elegir este nombre.", placeholder: "Nombre", aceptar: "Añadir" })) || "";
  if (!nombre) return;
  try {
    await rpc("nuevo_miembro", { p_viaje: v.id, p_nombre: nombre.slice(0, 30) });
    await cargarCompartido(v);
    renderViajes();
  } catch (e) {
    console.error(e);
    toast(e?.code === "23505" ? "Ya hay alguien con ese nombre" : textoError(e, "No se ha podido añadir"));
  }
}

async function renombrarPersona(v, m) {
  const nombre = (await preguntar({ titulo: "Cambiar nombre", valor: m.nombre, placeholder: "Nombre", aceptar: "Guardar" })) || "";
  if (!nombre || nombre === m.nombre) return;
  try {
    await rpc("renombrar_miembro", { p_miembro: m.id, p_nombre: nombre.slice(0, 30) });
    await refrescarCompartido(v);
  } catch (e) {
    console.error(e);
    toast(e?.code === "23505" ? "Ya hay alguien con ese nombre" : textoError(e, "No se ha podido cambiar"));
  }
}

async function quitarPersona(v, m) {
  const yo = yoEn(v);
  const salir = yo && yo.id === m.id;
  if (!(await confirmar(salir
    ? { titulo: "Salir del viaje", texto: `Dejarás de ver el viaje a ${v.nombre}.`, aceptar: "Salir", peligro: true }
    : { titulo: `Quitar a ${m.nombre}`, texto: "Dejará de estar en el viaje.", aceptar: "Quitar", peligro: true }))) return;
  try {
    await rpc("quitar_miembro", { p_miembro: m.id });
    if (salir) {
      state.viajeSel = null;
      await Promise.all([cargar(), cargarViajes()]);
    } else {
      await cargarCompartido(v);
      renderViajes();
    }
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido quitar"));
  }
}

async function refrescarCompartido(v) {
  await cargarCompartido(v);
  await Promise.all([cargar(), cargarViajes()]);
}

/* ---------- Compartir un viaje e invitar ---------- */

// Color fijo para cada nombre, de la misma paleta que las categorías.
function colorPersona(nombre) {
  let h = 0;
  for (const ch of String(nombre).trim().toLowerCase()) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

function miNombre() {
  const u = state.user || {};
  const n = (u.user_metadata?.full_name || u.user_metadata?.name || "").trim().split(/\s+/)[0];
  const t = n || (u.email || "").split("@")[0] || "Yo";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function compartirViaje(v) {
  const nombre = await preguntar({ titulo: "Compartir viaje", texto: "¿Con qué nombre te verán los demás?", valor: miNombre(), placeholder: "Tu nombre", aceptar: "Compartir" });
  if (nombre === null) return;
  try {
    await rpc("compartir_viaje", { p_viaje: v.id, p_mi_nombre: nombre.trim().slice(0, 30) || miNombre() });
    comp.tab = "personas";
    comp.miembros.delete(v.id);
    await cargarViajes();
    toast("Viaje compartido. Añade a tus amigos o invítalos con el enlace");
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido compartir el viaje"));
  }
}

function enlaceInvitacion(v) {
  return `${location.origin}${location.pathname}?unirse=${encodeURIComponent(v.invitacion)}`;
}

async function invitar(v) {
  if (!v.invitacion) return;
  const url = enlaceInvitacion(v);
  const texto = `Únete al viaje «${v.nombre}» para apuntar los gastos a medias:`;
  if (navigator.share) {
    try { await navigator.share({ title: v.nombre, text: texto, url }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const ok = await copiarTexto(`${texto} ${url}`);
  toast(ok ? "Enlace copiado. Pégalo en WhatsApp" : url);
}

// Al abrir la app con ?unirse=código se guarda el código hasta haber entrado en la cuenta.
function guardarInvitacionDeUrl() {
  const params = new URLSearchParams(location.search);
  const codigo = params.get("unirse");
  if (!codigo) return;
  safeStorage(() => localStorage.setItem("gastos-erasmus:unirse", codigo), null);
  params.delete("unirse");
  const q = params.toString();
  history.replaceState(null, "", location.pathname + (q ? `?${q}` : "") + location.hash);
}

async function procesarInvitacion() {
  if (!remote || !state.user) return;
  const codigo = safeStorage(() => localStorage.getItem("gastos-erasmus:unirse"), null);
  if (!codigo) return;
  safeStorage(() => localStorage.removeItem("gastos-erasmus:unirse"), null);
  try {
    const info = await rpc("info_invitacion", { p_codigo: codigo });
    if (!info) { toast("Esta invitación ya no es válida"); return; }
    if (info.ya_miembro) { abrirViajeCompartido(info.viaje); return; }
    comp.invitacion = { ...info, codigo };
    pintarHojaUnirse();
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido abrir la invitación"));
  }
}

function pintarHojaUnirse() {
  const info = comp.invitacion;
  $("#join-trip").textContent = info.nombre;
  $("#join-dates").textContent = rangoTexto(info.inicio, info.fin);
  const cont = $("#join-who");
  cont.innerHTML = "";
  for (const m of info.libres) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn wide join-opt";
    b.textContent = `Soy ${m.nombre}`;
    b.addEventListener("click", () => unirse(m.id, null, b));
    cont.appendChild(b);
  }
  $("#join-other-label").textContent = info.libres.length ? "¿No estás en la lista? Únete con tu nombre:" : "Tu nombre en el viaje:";
  $("#join-name").value = miNombre();
  $("#join-sheet").showModal();
}

async function unirse(miembro, nombre, btn) {
  const info = comp.invitacion;
  if (!info) return;
  btn.disabled = true;
  try {
    const vid = await rpc("unirse_viaje", { p_codigo: info.codigo, p_miembro: miembro, p_nombre: nombre });
    $("#join-sheet").close();
    comp.invitacion = null;
    toast(`Te has unido a ${info.nombre}`);
    await cargar();
    abrirViajeCompartido(vid);
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido unir al viaje"));
  } finally {
    btn.disabled = false;
  }
}

async function abrirViajeCompartido(id) {
  await cargarViajes();
  comp.tab = "gastos";
  comp.miembros.delete(id);
  state.viajeSel = id;
  cambiarVista("viajes");
}

/* ---------- Hoja para añadir o editar un movimiento ---------- */

function abrirMov(v, mv = null, { desdeGasto = null } = {}) {
  if (v.cerrado && !mv) { toast("El viaje está terminado. Reábrelo para añadir gastos"); return; }
  comp.edit = { v, mv, desdeGasto };
  comp.tipo = mv?.tipo || "gasto";
  comp.modo = mv?.modo || "iguales";
  const miembros = miembrosDe(v);
  const yo = yoEn(v);
  $("#mov-title").textContent = mv ? (mv.tipo === "transferencia" ? "Editar pago" : "Editar gasto") : "Nuevo gasto compartido";
  $("#mov-amount").value = mv ? String(mv.importe).replace(".", ",") : desdeGasto ? String(desdeGasto.importe).replace(".", ",") : "";
  $("#mov-concept").value = mv ? mv.titulo : desdeGasto ? (desdeGasto.nota || catInfo(desdeGasto.categoria).nombre) : "";
  $("#mov-date").value = mv ? mv.fecha : desdeGasto ? desdeGasto.fecha : hoyISO();
  const opciones = miembros.map((m) => `<option value="${m.id}"></option>`).join("");
  for (const sel of [$("#mov-payer"), $("#mov-to")]) {
    sel.innerHTML = opciones;
    [...sel.options].forEach((o, i) => { o.textContent = miembros[i].nombre + (yo && miembros[i].id === yo.id ? " (tú)" : ""); });
  }
  $("#mov-payer").value = mv ? mv.pagador : (yo || miembros[0])?.id;
  const otro = miembros.find((m) => m.id !== $("#mov-payer").value);
  $("#mov-to").value = mv?.tipo === "transferencia" ? mv.movimiento_partes?.[0]?.miembro_id : otro?.id || miembros[0]?.id;
  $("#mov-cat").innerHTML = state.categorias.map((c) => `<option value="${esc(c.nombre)}"></option>`).join("");
  [...$("#mov-cat").options].forEach((o, i) => { o.textContent = state.categorias[i].nombre; });
  const catActual = mv ? catPorNombre(mv.categoria).nombre : desdeGasto ? catInfo(desdeGasto.categoria).nombre : catInfo(state.categoria).nombre;
  $("#mov-cat").value = catActual;
  if (!$("#mov-cat").value && state.categorias.length) $("#mov-cat").selectedIndex = 0;
  fichas($("#mov-payer"));
  fichas($("#mov-to"));
  fichas($("#mov-cat"), (nombre) => { const c = catPorNombre(nombre); return icono(c.icono, ` style="color:${c.color}"`); });
  pintarBotonFecha("mov-date");

  // Reparto: en un gasto nuevo, entre todos a partes iguales.
  const partes = new Map((mv?.tipo === "gasto" ? mv.movimiento_partes : []).map((p) => [p.miembro_id, p]));
  const split = $("#mov-split");
  split.innerHTML = "";
  for (const m of miembros) {
    const p = partes.get(m.id);
    const fila = document.createElement("label");
    fila.className = "split-row";
    fila.dataset.id = m.id;
    fila.innerHTML = `<input type="checkbox"><span class="split-name"></span>
      <input class="split-val" type="text" inputmode="decimal" aria-label="Valor">
      <span class="split-amt"></span>`;
    fila.querySelector(".split-name").textContent = m.nombre + (yo && m.id === yo.id ? " (tú)" : "");
    fila.querySelector("input[type=checkbox]").checked = mv?.tipo === "gasto" ? Boolean(p) : true;
    fila.querySelector(".split-val").value = p ? String(Number(p.valor)).replace(".", ",") : comp.modo === "partes" ? "1" : "";
    split.appendChild(fila);
  }
  $("#mov-delete").classList.toggle("hidden", !mv);
  pintarTipoMov();
  $("#mov-sheet").showModal();
  if (!mv) $("#mov-amount").focus();
}

function pintarTipoMov() {
  const transfer = comp.tipo === "transferencia";
  for (const b of $$("#mov-tipo button")) b.setAttribute("aria-selected", String(b.dataset.tipo === comp.tipo));
  for (const b of $$("#mov-modo button")) b.setAttribute("aria-selected", String(b.dataset.modo === comp.modo));
  $("#mov-split-box").classList.toggle("hidden", transfer);
  $("#mov-cat-field").classList.toggle("hidden", transfer);
  $("#mov-to-field").classList.toggle("hidden", !transfer);
  $("#mov-payer-label").textContent = transfer ? "De" : "Pagó";
  $("#mov-concept").placeholder = transfer ? "Ej. Bizum" : "Ej. Cena";
  $("#mov-submit").textContent = comp.edit?.mv ? "Guardar" : transfer ? "Apuntar pago" : "Añadir gasto";
  pintarReparto();
}

function filasReparto() {
  return [...$$("#mov-split .split-row")]
    .filter((f) => f.querySelector("input[type=checkbox]").checked)
    .map((f) => ({ miembro: f.dataset.id, valor: comp.modo === "iguales" ? 1 : parseAmount(f.querySelector(".split-val").value) || 0, fila: f }));
}

function pintarReparto() {
  const total = parseAmount($("#mov-amount").value) || 0;
  const totalC = cent(total);
  for (const f of $$("#mov-split .split-row")) {
    const activo = f.querySelector("input[type=checkbox]").checked;
    f.classList.toggle("off", !activo);
    const val = f.querySelector(".split-val");
    val.classList.toggle("hidden", comp.modo === "iguales" || !activo);
    val.placeholder = comp.modo === "partes" ? "1" : "0,00";
    f.querySelector(".split-amt").textContent = "";
  }
  const filas = filasReparto();
  const cents = repartir(totalC, comp.modo, filas);
  filas.forEach((f, k) => { f.fila.querySelector(".split-amt").textContent = fmt(deCent(cents[k])); });
  const hint = $("#mov-split-hint");
  hint.classList.remove("neg");
  if (!filas.length) { hint.textContent = "Elige al menos una persona."; hint.classList.add("neg"); }
  else if (comp.modo === "importes") {
    const falta = totalC - cents.reduce((a, b) => a + b, 0);
    hint.textContent = falta === 0 ? "Los importes cuadran con el total." : falta > 0 ? `Faltan ${fmt(deCent(falta))} por repartir.` : `Te pasas en ${fmt(deCent(-falta))}.`;
    if (falta) hint.classList.add("neg");
  } else if (comp.modo === "partes") hint.textContent = "Reparto proporcional: por ejemplo, 2 paga el doble que 1.";
  else hint.textContent = filas.length ? `${fmt(deCent(Math.floor(totalC / filas.length)))} cada uno, más o menos un céntimo.` : "";
}

async function guardarMov(ev) {
  ev.preventDefault();
  const { v, mv, desdeGasto } = comp.edit || {};
  if (!v) return;
  const importe = parseAmount($("#mov-amount").value);
  if (!importe) { toast("Escribe un importe válido"); $("#mov-amount").focus(); return; }
  const transfer = comp.tipo === "transferencia";
  const titulo = $("#mov-concept").value.trim() || (transfer ? "Reembolso" : $("#mov-cat").value || "Gasto");
  const pagador = $("#mov-payer").value;
  let partes, modo;
  if (transfer) {
    const a = $("#mov-to").value;
    if (a === pagador) { toast("Elige a dos personas distintas"); return; }
    modo = "importes";
    partes = [{ miembro: a, valor: importe }];
  } else {
    modo = comp.modo;
    const filas = filasReparto();
    if (!filas.length) { toast("Elige entre quién se reparte"); return; }
    if (modo === "importes" && repartir(cent(importe), modo, filas).reduce((a, b) => a + b, 0) !== cent(importe)) {
      toast("Los importes no suman el total"); return;
    }
    if (modo === "partes" && !filas.some((f) => f.valor > 0)) { toast("Pon al menos una parte"); return; }
    partes = filas.map((f) => ({ miembro: f.miembro, valor: f.valor }));
  }
  const btn = $("#mov-submit");
  btn.disabled = true;
  try {
    await rpc("guardar_movimiento", {
      p_id: mv?.id || null, p_viaje: v.id, p_tipo: comp.tipo, p_titulo: titulo.slice(0, 60),
      p_categoria: transfer ? null : $("#mov-cat").value, p_fecha: $("#mov-date").value || hoyISO(),
      p_importe: importe, p_pagador: pagador, p_modo: modo, p_partes: partes,
    });
    // Un gasto personal que se pasa al viaje compartido deja de existir por separado.
    if (desdeGasto) {
      try { await state.store.remove(desdeGasto.id); } catch (e) { console.error(e); }
    }
    $("#mov-sheet").close();
    toast(mv ? "Guardado" : transfer ? "Pago apuntado" : "Gasto añadido al viaje");
    await refrescarCompartido(v);
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido guardar"));
  } finally {
    btn.disabled = false;
  }
}

async function borrarMov(v, mv) {
  if (!(await confirmar({ titulo: "Borrar gasto", texto: `«${mv.titulo}» (${fmt(Number(mv.importe))}) se quita para todos los del viaje.`, aceptar: "Borrar", peligro: true }))) return;
  try {
    await rpc("borrar_movimiento", { p_id: mv.id });
    if ($("#mov-sheet").open) $("#mov-sheet").close();
    toast("Borrado");
    await refrescarCompartido(v);
  } catch (e) {
    console.error(e);
    toast(textoError(e, "No se ha podido borrar"));
  }
}

function prepararHojaMov() {
  $("#mov-form").addEventListener("submit", guardarMov);
  $("#mov-delete").addEventListener("click", () => { const { v, mv } = comp.edit || {}; if (mv) borrarMov(v, mv); });
  for (const b of $$("#mov-tipo button")) b.addEventListener("click", () => { comp.tipo = b.dataset.tipo; pintarTipoMov(); });
  for (const b of $$("#mov-modo button")) {
    b.addEventListener("click", () => {
      comp.modo = b.dataset.modo;
      for (const f of $$("#mov-split .split-row")) {
        const val = f.querySelector(".split-val");
        if (comp.modo === "partes" && !val.value) val.value = "1";
        if (comp.modo === "importes") val.value = "";
      }
      if (comp.modo === "importes") {
        const filas = filasReparto();
        const cents = repartir(cent(parseAmount($("#mov-amount").value) || 0), "iguales", filas);
        filas.forEach((f, k) => { f.fila.querySelector(".split-val").value = cents[k] ? String(deCent(cents[k])).replace(".", ",") : ""; });
      }
      pintarTipoMov();
    });
  }
  $("#mov-amount").addEventListener("input", pintarReparto);
  $("#mov-split").addEventListener("input", pintarReparto);
  $("#mov-split").addEventListener("change", pintarReparto);
  $("#join-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const nombre = $("#join-name").value.trim();
    if (!nombre) { toast("Escribe tu nombre"); return; }
    unirse(null, nombre.slice(0, 30), $("#join-new"));
  });
}
