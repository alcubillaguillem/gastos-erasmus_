"use strict";

// Si algo falla, que se vea en pantalla en vez de que el botón «no haga nada».
window.addEventListener("error", (e) => {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = `Error: ${e.message}. Cierra la app del todo y vuelve a abrirla.`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 6000);
});

// Iconos de línea (24×24) y color de cada categoría en las barras y la leyenda.
const CATEGORIAS = [
  { id: "comida", nombre: "Comida", color: "#7dd3fc", icono: "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9" },
  { id: "tabaco", nombre: "Tabaco", color: "#fdba74", icono: "M3 14h14v4H3zM20 14v4M17 10c0-2 3-2 3-4.5" },
  { id: "alcohol", nombre: "Alcohol", color: "#f9a8d4", icono: "M8 3h8l-1 8a3 3 0 0 1-6 0zM12 14v7M9 21h6" },
  { id: "ocio", nombre: "Ocio", color: "#c4b5fd", icono: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" },
  { id: "viajes", nombre: "Viajes", color: "#c5f04a", icono: "M22 2 11 13M22 2l-7 20-4-9-9-4z" },
  { id: "transporte", nombre: "Transporte", color: "#d4d4d8", icono: "M7 3h10a2 2 0 0 1 2 2v13H5V5a2 2 0 0 1 2-2zM5 11h14M8 18v3M16 18v3" },
  { id: "casa", nombre: "Casa", color: "#fde68a", icono: "M4 11 12 4l8 7v9h-5v-6H9v6H4z" },
  { id: "compras", nombre: "Compras", color: "#86efac", icono: "M6 8h12l-1 13H7zM9 8V6a3 3 0 0 1 6 0v2" },
  { id: "estudios", nombre: "Estudios", color: "#93c5fd", icono: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8" },
  { id: "otros", nombre: "Otros", color: "#a1a1aa", icono: "M6 12h.01M12 12h.01M18 12h.01" },
];
const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const catInfo = (id) => CAT[id] || CAT.otros;
const icono = (d, extra = "") => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
const ICONO_X = "M6 6l12 12M18 6 6 18";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const fmt = (n) => euro.format(Number(n) || 0);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sum = (arr) => arr.reduce((s, g) => s + Number(g.importe), 0);

// "486,20 €" con los céntimos en gris, como en el diseño.
function fmtGrande(n) {
  const t = fmt(n);
  const i = t.lastIndexOf(",");
  return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<span>${esc(t.slice(i))}</span>`;
}

function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const hoyISO = () => isoDate(new Date());
function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Días entre dos fechas ISO, contando las dos (9 y 12 → 4).
function diasEntre(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000) + 1;
}
function rangoTexto(inicio, fin) {
  const a = parseISO(inicio), b = parseISO(fin);
  const mes = (d) => d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  if (inicio === fin) return `${a.getDate()} ${mes(a)}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}–${b.getDate()} ${mes(b)}`;
  return `${a.getDate()} ${mes(a)} – ${b.getDate()} ${mes(b)}`;
}
function parseAmount(str) {
  const clean = String(str).trim().replace(/\s|€/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}
function monthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return [isoDate(start), isoDate(end)];
}
function safeStorage(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}
function porCategoria(gastos) {
  const m = {};
  for (const g of gastos) m[g.categoria] = (m[g.categoria] || 0) + Number(g.importe);
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
const esEscritorio = () => window.matchMedia("(min-width: 900px)").matches;

/* ---------- Almacenes de datos ---------- */

class LocalStore {
  constructor() { this.key = "gastos-erasmus:gastos"; this.keyViajes = "gastos-erasmus:viajes"; }
  all() { return safeStorage(() => JSON.parse(localStorage.getItem(this.key)) || [], []); }
  save(list) { safeStorage(() => localStorage.setItem(this.key, JSON.stringify(list))); }
  async listMonth(from, to) {
    return this.all().filter((g) => g.fecha >= from && g.fecha <= to);
  }
  async listAll() { return this.all(); }
  async add(g) {
    const item = { ...g, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const list = this.all(); list.push(item); this.save(list);
    return item;
  }
  async remove(id) { this.save(this.all().filter((g) => g.id !== id)); }
  async getBudget() { return safeStorage(() => Number(localStorage.getItem("gastos-erasmus:presupuesto")) || 0, 0); }
  async setBudget(v) { safeStorage(() => localStorage.setItem("gastos-erasmus:presupuesto", String(v))); }

  viajesAll() { return safeStorage(() => JSON.parse(localStorage.getItem(this.keyViajes)) || [], []); }
  viajesSave(list) { safeStorage(() => localStorage.setItem(this.keyViajes, JSON.stringify(list))); }
  async listViajes() { return this.viajesAll().sort((a, b) => b.inicio.localeCompare(a.inicio)); }
  async addViaje(v) {
    const item = { excluidos: [], ...v, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this.viajesSave([...this.viajesAll(), item]);
    return item;
  }
  async updateViaje(id, patch) {
    const list = this.viajesAll().map((v) => (v.id === id ? { ...v, ...patch } : v));
    this.viajesSave(list);
    return list.find((v) => v.id === id);
  }
  async removeViaje(id) { this.viajesSave(this.viajesAll().filter((v) => v.id !== id)); }
}

class SupabaseStore {
  constructor(client) { this.sb = client; }
  async listMonth(from, to) {
    const { data, error } = await this.sb.from("gastos").select("*")
      .gte("fecha", from).lte("fecha", to)
      .order("fecha", { ascending: false }).order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
  async listAll() {
    const { data, error } = await this.sb.from("gastos").select("*").order("fecha", { ascending: true });
    if (error) throw error;
    return data;
  }
  async add(g) {
    const { data, error } = await this.sb.from("gastos").insert(g).select().single();
    if (error) throw error;
    return data;
  }
  async remove(id) {
    const { error } = await this.sb.from("gastos").delete().eq("id", id);
    if (error) throw error;
  }
  async getBudget() {
    const { data } = await this.sb.auth.getUser();
    return Number(data?.user?.user_metadata?.presupuesto) || 0;
  }
  async setBudget(v) {
    const { error } = await this.sb.auth.updateUser({ data: { presupuesto: v } });
    if (error) throw error;
  }
  async listViajes() {
    const { data, error } = await this.sb.from("viajes").select("*").order("inicio", { ascending: false });
    if (error) throw error;
    return data;
  }
  async addViaje(v) {
    const { data, error } = await this.sb.from("viajes").insert(v).select().single();
    if (error) throw error;
    return data;
  }
  async updateViaje(id, patch) {
    const { data, error } = await this.sb.from("viajes").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async removeViaje(id) {
    const { error } = await this.sb.from("viajes").delete().eq("id", id);
    if (error) throw error;
  }
}

/* ---------- Estado ---------- */

const cfg = window.APP_CONFIG || {};
const remote = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
// La sesión se guarda en este dispositivo y se renueva sola: no hace falta volver a entrar
// hasta que pulses "Cerrar sesión". Las contraseñas nunca pasan por esta app: Supabase las
// guarda cifradas con bcrypt.
const sb = remote
  ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "gastos-erasmus-sesion",
      },
    })
  : null;

const VISTAS = ["inicio", "viajes", "graficos", "ajustes"];
const vistaGuardada = safeStorage(() => localStorage.getItem("gastos-erasmus:vista"), null);

const state = {
  store: remote ? new SupabaseStore(sb) : new LocalStore(),
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  categoria: safeStorage(() => localStorage.getItem("gastos-erasmus:ultima-cat"), null) || "comida",
  gastos: [],        // gastos del mes seleccionado
  rango: [],         // gastos de los últimos 6 meses (para los gráficos)
  viajes: [],        // viajes, del más reciente al más antiguo
  gastosViaje: [],   // gastos entre la ida del primer viaje y la vuelta del último
  viajeSel: null,    // id del viaje abierto en la pestaña Viajes
  viajeEdit: null,   // viaje que se está editando en la hoja
  vista: VISTAS.includes(vistaGuardada) ? vistaGuardada : "inicio",
  presupuesto: 0,
  user: null,
};

/* ---------- Viajes: qué gastos cuentan ---------- */

// Un gasto es de un viaje si su fecha cae entre la ida y la vuelta y no se ha quitado a mano.
function viajeDe(g) {
  return state.viajes.find((v) => g.fecha >= v.inicio && g.fecha <= v.fin && !(v.excluidos || []).includes(g.id)) || null;
}
function enFechas(v, g) { return g.fecha >= v.inicio && g.fecha <= v.fin; }
function gastosDe(v) {
  return state.gastosViaje.filter((g) => enFechas(v, g) && !(v.excluidos || []).includes(g.id) && viajeDe(g)?.id === v.id);
}
function viajeEnCurso() {
  const hoy = hoyISO();
  return state.viajes.find((v) => v.inicio <= hoy && hoy <= v.fin) || null;
}
// Días que cuentan para la media: los ya vividos si el viaje está en curso.
function diasViaje(v) {
  const hoy = hoyISO();
  const dias = diasEntre(v.inicio, v.fin);
  if (hoy < v.inicio) return { dias, vividos: 0, estado: "futuro" };
  if (hoy > v.fin) return { dias, vividos: dias, estado: "pasado" };
  return { dias, vividos: diasEntre(v.inicio, hoy), estado: "en-curso" };
}
function statsViaje(v) {
  const gastos = gastosDe(v);
  const total = sum(gastos);
  const d = diasViaje(v);
  const base = d.vividos || d.dias;
  return { gastos, total, ...d, porDia: base ? total / base : 0 };
}

/* ---------- UI ---------- */

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function renderCategoryPicker() {
  const grid = $("#cat-grid");
  grid.innerHTML = "";
  for (const c of CATEGORIAS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", String(c.id === state.categoria));
    b.innerHTML = `${icono(c.icono, ` style="color:${c.color}"`)}<span>${c.nombre}</span>`;
    b.addEventListener("click", () => {
      state.categoria = c.id;
      safeStorage(() => localStorage.setItem("gastos-erasmus:ultima-cat", c.id));
      grid.querySelectorAll(".cat").forEach((el) => el.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
    });
    grid.appendChild(b);
  }
}

function pintarStack(el, filas, total) {
  el.innerHTML = filas.map(([id, v]) =>
    `<span style="flex:${(v / total) * 100};background:${catInfo(id).color}"></span>`).join("");
}

// Cifras del mes seleccionado: las usan Inicio y Gráficos.
function calcMes() {
  const { year, month } = state;
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === year && hoy.getMonth() === month;
  const esFuturo = new Date(year, month, 1) > hoy;
  const diasMes = new Date(year, month + 1, 0).getDate();
  const diasTranscurridos = esMesActual ? hoy.getDate() : esFuturo ? 0 : diasMes;
  const total = sum(state.gastos);
  const mediaDia = diasTranscurridos ? total / diasTranscurridos : 0;
  const ant = new Date(year, month - 1, 1);
  const [af, at] = monthRange(ant.getFullYear(), ant.getMonth());
  const totalAnterior = sum(state.rango.filter((g) => g.fecha >= af && g.fecha <= at));
  const nombreAnterior = ant.toLocaleDateString("es-ES", { month: "long" });
  return { esMesActual, esFuturo, diasMes, diasTranscurridos, total, mediaDia, prevision: mediaDia * diasMes, totalAnterior, nombreAnterior };
}

function itemGasto(g, { conViaje = true, accion = null } = {}) {
  const c = catInfo(g.categoria);
  const v = conViaje ? viajeDe(g) : null;
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <span class="cat-ic" style="color:${c.color}">${icono(c.icono)}</span>
    <div class="info"><div class="note"></div><div class="meta"></div></div>
    <span class="amt">−${esc(fmt(g.importe).replace(/\s?€$/, ""))}</span>`;
  el.querySelector(".note").textContent = g.nota || c.nombre;
  const meta = el.querySelector(".meta");
  meta.textContent = g.nota ? c.nombre : "";
  if (v) {
    if (g.nota) meta.append(" · ");
    const s = document.createElement("span");
    s.className = "trip";
    s.textContent = v.nombre;
    meta.append(s);
  }
  if (accion) el.appendChild(accion);
  else {
    const del = document.createElement("button");
    del.className = "del";
    del.setAttribute("aria-label", "Borrar gasto");
    del.innerHTML = icono(ICONO_X);
    del.addEventListener("click", () => borrar(g));
    el.appendChild(del);
  }
  return el;
}

function render() {
  const label = new Date(state.year, state.month, 1)
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" }).replace(" de ", " ");
  $$(".month-label").forEach((h) => { h.textContent = label.charAt(0).toUpperCase() + label.slice(1); });

  const m = calcMes();
  $("#month-total").innerHTML = fmtGrande(m.total);

  // Presupuesto
  const box = $("#budget-box");
  const left = $("#budget-left");
  if (state.presupuesto > 0) {
    box.classList.remove("hidden");
    const pct = (m.total / state.presupuesto) * 100;
    const fill = $("#budget-fill");
    fill.style.width = `${Math.min(pct, 100)}%`;
    fill.classList.toggle("warn", pct >= 80 && pct < 100);
    fill.classList.toggle("over", pct >= 100);
    const resto = state.presupuesto - m.total;
    $("#budget-text").textContent = `${Math.round(pct)} % del presupuesto de ${fmt(state.presupuesto)}`;
    left.innerHTML = resto >= 0
      ? `Quedan <strong>${esc(fmt(resto))}</strong> de ${esc(fmt(state.presupuesto))}`
      : `Te has pasado <strong class="over">${esc(fmt(-resto))}</strong>`;
  } else {
    box.classList.add("hidden");
    left.textContent = "";
  }

  $("#mode-badge").textContent = remote ? "" : "Modo local: los gastos se guardan solo en este dispositivo.";

  // Reparto por categoría
  const filas = porCategoria(state.gastos);
  pintarStack($("#cat-stack"), filas, m.total);
  $("#cat-legend").innerHTML = filas.map(([id, v]) => {
    const c = catInfo(id);
    return `<div class="legend-row"><span class="dot" style="background:${c.color}"></span><span class="name">${c.nombre}</span><span>${esc(fmt(v))}</span></div>`;
  }).join("");

  // Datos rápidos
  const hoy = hoyISO();
  $("#i-hoy").textContent = m.esMesActual ? fmt(sum(state.gastos.filter((g) => g.fecha === hoy))) : "—";
  $("#i-media").textContent = m.diasTranscurridos ? fmt(m.mediaDia) : "—";
  $("#i-media-sub").textContent = m.diasTranscurridos ? `${m.diasTranscurridos} de ${m.diasMes} días` : "";
  const prevSub = $("#i-prev-sub");
  prevSub.classList.remove("warn");
  if (m.esMesActual) {
    $("#i-prev").textContent = fmt(m.prevision);
    if (state.presupuesto > 0 && m.prevision > state.presupuesto) {
      prevSub.textContent = `${fmt(m.prevision - state.presupuesto)} por encima`;
      prevSub.classList.add("warn");
    } else prevSub.textContent = state.presupuesto > 0 ? "dentro del presupuesto" : "a este ritmo";
  } else {
    $("#i-prev").textContent = m.esFuturo ? "—" : fmt(m.total);
    prevSub.textContent = m.esFuturo ? "" : "mes cerrado";
  }
  if (m.totalAnterior > 0) {
    const pct = Math.round(((m.total - m.totalAnterior) / m.totalAnterior) * 100);
    $("#i-vs").textContent = `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)} %`;
    $("#i-vs-sub").textContent = `${fmt(m.totalAnterior)} en ${m.nombreAnterior}`;
  } else {
    $("#i-vs").textContent = "—";
    $("#i-vs-sub").textContent = "";
  }

  // Viaje en curso
  const vc = viajeEnCurso();
  const tn = $("#trip-now");
  tn.classList.toggle("hidden", !vc);
  if (vc) {
    const s = statsViaje(vc);
    tn.innerHTML = `
      <span class="live">Viaje en curso · día ${s.vividos} de ${s.dias}</span>
      <span class="trip-row"><span><span class="trip-name">${esc(vc.nombre)}</span><br>
      <span class="small muted">${esc(rangoTexto(vc.inicio, vc.fin))} · ${esc(fmt(s.porDia))}/día</span></span>
      <span class="trip-total">${esc(fmt(s.total))}</span></span>`;
    tn.onclick = () => { state.viajeSel = vc.id; cambiarVista("viajes"); };
  }

  // Movimientos agrupados por día
  const list = $("#list");
  list.innerHTML = state.gastos.length ? "" : `<div class="empty">Aún no hay gastos este mes</div>`;
  const porDia = new Map();
  for (const g of state.gastos) {
    if (!porDia.has(g.fecha)) porDia.set(g.fecha, []);
    porDia.get(g.fecha).push(g);
  }
  const ayer = isoDate(new Date(Date.now() - 86400000));
  for (const dia of [...porDia.keys()].sort().reverse()) {
    const items = porDia.get(dia).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const head = document.createElement("div");
    head.className = "day";
    const nombre = dia === hoy ? "Hoy" : dia === ayer ? "Ayer"
      : parseISO(dia).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
    head.innerHTML = `<span></span><span>${esc(fmt(sum(items)))}</span>`;
    head.firstChild.textContent = nombre;
    list.appendChild(head);
    for (const g of items) list.appendChild(itemGasto(g));
  }
}

const MESES_GRAFICO = 6;

function rangoActual() {
  const [from] = monthRange(state.year, state.month - (MESES_GRAFICO - 1));
  const [, to] = monthRange(state.year, state.month);
  return [from, to];
}

function aplicarRango() {
  const [from, to] = monthRange(state.year, state.month);
  state.gastos = state.rango.filter((g) => g.fecha >= from && g.fecha <= to);
}

function pintar() {
  render();
  if (state.vista === "graficos") renderDashboard();
  if (state.vista === "viajes") renderViajes();
}

async function cargar() {
  const [from, to] = rangoActual();
  try {
    state.rango = await state.store.listMonth(from, to);
  } catch (e) {
    console.error(e);
    toast("No se han podido cargar los gastos");
  }
  aplicarRango();
  pintar();
}

async function cargarViajes() {
  try {
    state.viajes = await state.store.listViajes();
    if (state.viajes.length) {
      const from = state.viajes.reduce((m, v) => (v.inicio < m ? v.inicio : m), state.viajes[0].inicio);
      const to = state.viajes.reduce((m, v) => (v.fin > m ? v.fin : m), state.viajes[0].fin);
      state.gastosViaje = await state.store.listMonth(from, to);
    } else {
      state.gastosViaje = [];
    }
  } catch (e) {
    console.error(e);
    toast("No se han podido cargar los viajes");
  }
  pintar();
}

/* ---------- Dashboard de gráficos ---------- */

function renderDashboard() {
  const { year, month } = state;
  const nombreMes = (y, m, opts) => new Date(y, m, 1).toLocaleDateString("es-ES", opts);
  const m = calcMes();

  // Totales de los últimos meses
  const meses = [];
  for (let i = MESES_GRAFICO - 1; i >= 0; i--) {
    const d = new Date(year, month - i, 1);
    const [from, to] = monthRange(d.getFullYear(), d.getMonth());
    meses.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: nombreMes(d.getFullYear(), d.getMonth(), { month: "short" }).replace(".", ""),
      fullLabel: nombreMes(d.getFullYear(), d.getMonth(), { month: "long", year: "numeric" }),
      value: sum(state.rango.filter((g) => g.fecha >= from && g.fecha <= to)),
      selected: i === 0,
    });
  }
  const anteriores = meses.slice(0, -1).filter((x) => x.value > 0);
  const media = anteriores.length ? anteriores.reduce((s, x) => s + x.value, 0) / anteriores.length : 0;

  // KPIs
  $("#k-total").textContent = fmt(m.total);
  if (m.totalAnterior > 0) {
    const pct = Math.round(((m.total - m.totalAnterior) / m.totalAnterior) * 100);
    $("#k-vs").textContent = `${pct > 0 ? "+" : ""}${pct} % vs ${m.nombreAnterior}`;
  } else {
    $("#k-vs").textContent = "";
  }
  $("#k-media").textContent = m.diasTranscurridos ? fmt(m.mediaDia) : "—";
  $("#k-dias").textContent = m.diasTranscurridos ? `${m.diasTranscurridos} de ${m.diasMes} días` : "";
  if (m.esMesActual) {
    $("#k-prev").textContent = fmt(m.prevision);
    $("#k-prev-sub").textContent = state.presupuesto > 0
      ? (m.prevision > state.presupuesto ? `${fmt(m.prevision - state.presupuesto)} por encima del presupuesto` : "dentro del presupuesto")
      : "a este ritmo";
  } else {
    $("#k-prev").textContent = m.esFuturo ? "—" : fmt(m.total);
    $("#k-prev-sub").textContent = m.esFuturo ? "" : "mes cerrado";
  }
  const filas = porCategoria(state.gastos);
  if (filas.length) {
    $("#k-top").textContent = catInfo(filas[0][0]).nombre;
    $("#k-top-sub").textContent = `${fmt(filas[0][1])} · ${Math.round((filas[0][1] / m.total) * 100)} %`;
  } else {
    $("#k-top").textContent = "—";
    $("#k-top-sub").textContent = "";
  }

  // Gráficos
  Charts.monthBars($("#chart-meses"), meses, {
    average: media,
    onSelect: (key) => {
      const [y, mo] = key.split("-").map(Number);
      if (y === state.year && mo === state.month) return;
      Charts.hideTip();
      state.year = y;
      state.month = mo;
      cargar();
    },
  });

  const dias = Array.from({ length: m.diasMes }, (_, i) => ({ day: i + 1, value: 0 }));
  for (const g of state.gastos) {
    const d = Number(g.fecha.slice(8, 10));
    if (dias[d - 1]) dias[d - 1].value += Number(g.importe);
  }
  $("#acum-sub").textContent = state.presupuesto > 0
    ? `Cómo vas respecto al presupuesto de ${fmt(state.presupuesto)}.`
    : "Ponle un presupuesto en Ajustes para ver la línea de referencia.";
  Charts.cumulative($("#chart-acum"), dias, {
    budget: state.presupuesto,
    lastDay: m.diasTranscurridos,
    monthLabel: nombreMes(year, month, { month: "long" }),
  });

  Charts.categoryBars($("#chart-cats"), filas.map(([id, v]) => ({ label: catInfo(id).nombre, value: v })));
}

/* ---------- Pestaña Viajes ---------- */

function renderViajes() {
  const lista = $("#trips-list");
  const detalle = $("#trip-detail");
  const stats = new Map(state.viajes.map((v) => [v.id, statsViaje(v)]));
  const totalViajes = [...stats.values()].reduce((s, x) => s + x.total, 0);
  const n = state.viajes.length;
  $("#trips-summary").textContent = n
    ? `${n} ${n === 1 ? "viaje" : "viajes"} · ${fmt(totalViajes)} en total`
    : "";

  if (state.viajeSel && !state.viajes.some((v) => v.id === state.viajeSel)) state.viajeSel = null;
  // En el ordenador siempre hay un viaje abierto: el que está en curso o el más reciente.
  if (!state.viajeSel && esEscritorio() && n) state.viajeSel = (viajeEnCurso() || state.viajes[0]).id;

  lista.innerHTML = n ? "" : `<div class="card empty">Aún no tienes viajes. Crea uno con «Nuevo viaje» y sus gastos se sumarán solos.</div>`;
  const vc = viajeEnCurso();
  for (const v of state.viajes) {
    const s = stats.get(v.id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "trip-card" + (vc?.id === v.id ? " current" : "");
    b.setAttribute("aria-current", String(state.viajeSel === v.id));
    const estado = s.estado === "en-curso" ? `<span class="live">En curso · día ${s.vividos} de ${s.dias}</span>`
      : s.estado === "futuro" ? `<span class="small muted">Próximamente</span>` : "";
    b.innerHTML = `${estado}
      <span class="top-line"><span class="t-name"></span><span class="t-total">${esc(fmt(s.total))}</span></span>
      <span class="small muted">${esc(rangoTexto(v.inicio, v.fin))} · ${esc(fmt(s.porDia))}/día</span>
      <span class="stack"></span>`;
    b.querySelector(".t-name").textContent = v.nombre;
    pintarStack(b.querySelector(".stack"), porCategoria(s.gastos), s.total || 1);
    b.addEventListener("click", () => { state.viajeSel = v.id; renderViajes(); if (!esEscritorio()) window.scrollTo(0, 0); });
    lista.appendChild(b);
  }

  const v = state.viajes.find((x) => x.id === state.viajeSel);
  $(".trips-layout").classList.toggle("detail-open", Boolean(v));
  detalle.classList.toggle("hidden", !v);
  if (!v) return;
  const s = stats.get(v.id);

  const estado = s.estado === "en-curso" ? ` · día ${s.vividos} de ${s.dias}` : s.estado === "futuro" ? " · próximamente" : ` · ${s.dias} ${s.dias === 1 ? "día" : "días"}`;
  detalle.innerHTML = `
    <div class="trip-actions">
      <button type="button" class="btn pill trip-back">${icono("M15 6l-6 6 6 6")}Viajes</button>
      <button type="button" class="btn pill" id="trip-edit">Editar viaje</button>
    </div>
    <div class="trip-head">
      <div><div class="small muted">${esc(rangoTexto(v.inicio, v.fin))}${estado}</div><h2></h2></div>
      <div class="huge">${fmtGrande(s.total)}</div>
    </div>
    <div class="small muted">${esc(fmt(s.porDia))} por día · ${s.gastos.length} ${s.gastos.length === 1 ? "gasto" : "gastos"}</div>
    <div class="sub-grid">
      <div class="cat-rows"><div class="label">Por categoría</div></div>
      <div class="cat-rows"><div class="label">Por día</div><div class="day-bars"></div><div class="day-labels"></div></div>
    </div>
    <div class="trip-gastos"><div class="label">Gastos del viaje</div></div>`;
  detalle.querySelector("h2").textContent = v.nombre;
  detalle.querySelector(".trip-back").addEventListener("click", () => { state.viajeSel = null; renderViajes(); });
  detalle.querySelector("#trip-edit").addEventListener("click", () => abrirViaje(v));

  const cats = detalle.querySelector(".cat-rows");
  const filas = porCategoria(s.gastos);
  if (!filas.length) cats.insertAdjacentHTML("beforeend", `<div class="empty">Sin gastos todavía</div>`);
  for (const [id, imp] of filas) {
    const c = catInfo(id);
    cats.insertAdjacentHTML("beforeend", `<div class="cat-row"><div class="row-top"><span>${c.nombre}</span><span>${esc(fmt(imp))}</span></div>
      <div class="bar"><div class="fill" style="width:${(imp / s.total) * 100}%;background:${c.color}"></div></div></div>`);
  }

  // Barras por día (máximo 31 para que se lean)
  const nd = Math.min(s.dias, 31);
  const porDia = Array.from({ length: nd }, (_, i) => {
    const d = parseISO(v.inicio); d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    return { d, value: sum(s.gastos.filter((g) => g.fecha === iso)) };
  });
  const max = Math.max(...porDia.map((x) => x.value), 1);
  detalle.querySelector(".day-bars").innerHTML = porDia.map((x) =>
    `<span class="${x.value ? "" : "zero"}" style="height:${Math.max((x.value / max) * 100, 4)}%" title="${esc(fmt(x.value))}"></span>`).join("");
  const cada = nd <= 7 ? 1 : nd <= 16 ? 2 : 5;
  detalle.querySelector(".day-labels").innerHTML = porDia.map((x, i) => {
    const txt = nd <= 7 ? x.d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(",", "") : String(x.d.getDate());
    return `<span>${i % cada === 0 ? esc(txt) : ""}</span>`;
  }).join("");

  // Gastos del viaje, con opción de quitarlos (no se borran, solo dejan de contar para el viaje)
  const cont = detalle.querySelector(".trip-gastos");
  const ordenados = [...s.gastos].sort((a, b) => (b.fecha + b.created_at).localeCompare(a.fecha + a.created_at));
  if (!ordenados.length) cont.insertAdjacentHTML("beforeend", `<div class="empty">Los gastos que apuntes entre la ida y la vuelta aparecerán aquí.</div>`);
  for (const g of ordenados) {
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.className = "link-btn-sm";
    quitar.textContent = "Quitar";
    quitar.setAttribute("aria-label", "Quitar del viaje");
    quitar.addEventListener("click", () => cambiarExcluido(v, g.id, true));
    cont.appendChild(itemGasto(g, { conViaje: false, accion: quitar }));
  }
  const fuera = state.gastosViaje.filter((g) => enFechas(v, g) && (v.excluidos || []).includes(g.id));
  if (fuera.length) {
    cont.insertAdjacentHTML("beforeend", `<div class="label" style="margin-top:16px">Quitados del viaje</div>`);
    for (const g of fuera) {
      const volver = document.createElement("button");
      volver.type = "button";
      volver.className = "link-btn-sm";
      volver.textContent = "Volver a sumar";
      volver.addEventListener("click", () => cambiarExcluido(v, g.id, false));
      cont.appendChild(itemGasto(g, { conViaje: false, accion: volver }));
    }
  }
}

async function cambiarExcluido(v, gastoId, quitar) {
  const excluidos = quitar ? [...new Set([...(v.excluidos || []), gastoId])] : (v.excluidos || []).filter((x) => x !== gastoId);
  try {
    const nuevo = await state.store.updateViaje(v.id, { excluidos });
    state.viajes = state.viajes.map((x) => (x.id === v.id ? nuevo : x));
    pintar();
    toast(quitar ? "Quitado del viaje" : "Vuelve a contar en el viaje");
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar");
  }
}

function abrirViaje(v = null) {
  state.viajeEdit = v;
  $("#trip-title").textContent = v ? "Editar viaje" : "Nuevo viaje";
  $("#trip-name").value = v ? v.nombre : "";
  $("#trip-start").value = v ? v.inicio : hoyISO();
  $("#trip-end").value = v ? v.fin : hoyISO();
  $("#trip-delete").classList.toggle("hidden", !v);
  $("#trip-sheet").showModal();
  if (!v) $("#trip-name").focus();
}

async function guardarViaje(ev) {
  ev.preventDefault();
  const nombre = $("#trip-name").value.trim();
  const inicio = $("#trip-start").value;
  const fin = $("#trip-end").value;
  if (!nombre || !inicio || !fin) { toast("Pon el destino y las fechas"); return; }
  if (fin < inicio) { toast("La vuelta no puede ser antes de la ida"); return; }
  if (diasEntre(inicio, fin) > 366) { toast("Un viaje puede durar como mucho un año"); return; }
  const btn = ev.submitter || $("#trip-form button[type=submit]");
  btn.disabled = true;
  try {
    const datos = { nombre, inicio, fin };
    const v = state.viajeEdit
      ? await state.store.updateViaje(state.viajeEdit.id, datos)
      : await state.store.addViaje(datos);
    state.viajeSel = v.id;
    $("#trip-sheet").close();
    toast(state.viajeEdit ? "Viaje guardado" : `Viaje a ${nombre} creado`);
    await cargarViajes();
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar el viaje");
  } finally {
    btn.disabled = false;
  }
}

async function borrarViaje() {
  const v = state.viajeEdit;
  if (!v || !confirm(`¿Borrar el viaje a ${v.nombre}? Los gastos no se borran.`)) return;
  try {
    await state.store.removeViaje(v.id);
    state.viajeSel = null;
    $("#trip-sheet").close();
    toast("Viaje borrado");
    await cargarViajes();
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

/* ---------- Navegación entre secciones ---------- */

function cambiarVista(vista) {
  if (!VISTAS.includes(vista)) vista = "inicio";
  state.vista = vista;
  safeStorage(() => localStorage.setItem("gastos-erasmus:vista", vista));
  for (const v of VISTAS) $(`#view-${v}`).classList.toggle("hidden", v !== vista);
  $$("[data-view]").forEach((b) => {
    if (b.dataset.view === vista) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  Charts.hideTip();
  window.scrollTo(0, 0);
  if (vista === "graficos") renderDashboard();
  if (vista === "viajes") renderViajes();
  if (vista === "ajustes") llenarAjustes();
}

function llenarAjustes() {
  $("#budget-input").value = state.presupuesto ? String(state.presupuesto).replace(".", ",") : "";
  if (remote && state.user) {
    const u = state.user;
    const proveedor = u.app_metadata?.provider === "google" ? "Google" : "email y contraseña";
    $("#account-box").classList.remove("hidden");
    $("#account-email").textContent = u.email || "";
    $("#account-avatar").textContent = (u.user_metadata?.full_name || u.email || "?").trim().charAt(0).toUpperCase();
    $("#account-method").textContent = `Has entrado con ${proveedor}`;
    $("#open-shortcuts").classList.remove("hidden");
    $("#logout").classList.remove("hidden");
  }
}

async function cerrarSesion() {
  if (!confirm("¿Cerrar sesión en este dispositivo?")) return;
  await sb.auth.signOut();
}

async function borrar(g) {
  if (!confirm(`¿Borrar ${fmt(g.importe)} de ${catInfo(g.categoria).nombre}?`)) return;
  try {
    await state.store.remove(g.id);
    state.rango = state.rango.filter((x) => x.id !== g.id);
    state.gastosViaje = state.gastosViaje.filter((x) => x.id !== g.id);
    aplicarRango();
    pintar();
    toast("Gasto borrado");
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

/* ---------- Añadir gasto ---------- */

function pistaViaje() {
  const fecha = $("#date").value || hoyISO();
  const v = viajeDe({ fecha, id: null });
  const p = $("#add-trip-hint");
  p.classList.toggle("hidden", !v);
  if (v) p.textContent = `Se sumará al viaje a ${v.nombre}.`;
}

function abrirAñadir() {
  // La fecha vuelve a ser hoy cada vez, aunque la app lleve días abierta.
  $("#date").value = hoyISO();
  $("#amount").value = "";
  $("#note").value = "";
  pistaViaje();
  $("#add-sheet").showModal();
  $("#amount").focus();
}

async function añadir(ev) {
  ev.preventDefault();
  const importe = parseAmount($("#amount").value);
  if (!importe) { toast("Escribe un importe válido"); $("#amount").focus(); return; }
  const gasto = {
    importe,
    categoria: state.categoria,
    nota: $("#note").value.trim() || null,
    fecha: $("#date").value || hoyISO(),
  };
  const btn = ev.submitter || $("#add-form button[type=submit]");
  btn.disabled = true;
  try {
    const nuevo = await state.store.add(gasto);
    const [from, to] = rangoActual();
    if (nuevo.fecha >= from && nuevo.fecha <= to) state.rango.unshift(nuevo);
    if (state.viajes.some((v) => enFechas(v, nuevo))) state.gastosViaje.unshift(nuevo);
    aplicarRango();
    pintar();
    $("#add-sheet").close();
    const v = viajeDe(nuevo);
    toast(`Apuntado: ${fmt(importe)} en ${catInfo(gasto.categoria).nombre}${v ? ` · ${v.nombre}` : ""}`);
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar");
  } finally {
    btn.disabled = false;
  }
}

function cambiarMes(delta) {
  const d = new Date(state.year, state.month + delta, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  cargar();
}

async function exportarCSV() {
  try {
    const todos = await state.store.listAll();
    // Evita que una nota como "=HYPERLINK(...)" se ejecute como fórmula al abrir el CSV en Excel.
    const esc = (v) => {
      let t = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
      return `"${t.replace(/"/g, '""')}"`;
    };
    const filas = [["Fecha", "Categoría", "Importe", "Nota"].join(";")];
    for (const g of todos) {
      filas.push([g.fecha, catInfo(g.categoria).nombre, String(g.importe).replace(".", ","), esc(g.nota)].join(";"));
    }
    const blob = new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gastos-erasmus-${isoDate(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    console.error(e);
    toast("No se ha podido exportar");
  }
}

/* ---------- Pantallas (app y atajo) ---------- */

const PANTALLAS = ["#login", "#shell", "#shortcuts-screen"];
let scrollPrincipal = 0;

function mostrarPantalla(sel) {
  if (!$("#shell").classList.contains("hidden")) scrollPrincipal = window.scrollY;
  for (const p of PANTALLAS) $(p).classList.toggle("hidden", p !== sel);
  Charts.hideTip();
  window.scrollTo(0, sel === "#shell" ? scrollPrincipal : 0);
}

// La pantalla del atajo es una entrada del historial: el botón «‹» y el gesto
// o botón de atrás del móvil vuelven a Ajustes.
function pantallaDesdeHash() {
  if (!state.user && remote) return;
  if (location.hash === "#atajos" && remote) mostrarPantalla("#shortcuts-screen");
  else mostrarPantalla("#shell");
}

let tokenAtajo = null;

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Plan B para navegadores sin permiso de portapapeles.
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

function pintarPasosInstalacion(copiado) {
  const copy = $("#copy-code");
  const open = $("#open-shortcut");
  const hayAtajo = Boolean(cfg.shortcutUrl);
  copy.disabled = !tokenAtajo;
  copy.textContent = !tokenAtajo ? "No se ha podido cargar tu código" : copiado ? "✓ Código copiado" : "Copiar mi código";
  copy.classList.toggle("done", Boolean(copiado));
  $("#istep-1").classList.toggle("is-done", Boolean(copiado));
  $("#istep-2").classList.toggle("is-locked", !copiado);
  $("#shortcut-missing").classList.toggle("hidden", hayAtajo);
  $("#istep-2-text").innerHTML = hayAtajo
    ? "Se abrirá la app Atajos. Toca <strong>Configurar atajo</strong>, mantén el dedo en la casilla, pulsa <strong>Pegar</strong> y luego <strong>Añadir atajo</strong>."
    : "Abre la app Atajos y crea el atajo siguiendo la guía de abajo. Cuando llegues al campo <strong>p_token</strong>, mantén el dedo y pulsa <strong>Pegar</strong>.";
  if (!hayAtajo) $("#manual-guide").open = true;
  open.disabled = !copiado;
  open.textContent = !copiado ? "Primero copia tu código" : hayAtajo ? "Añadir el atajo" : "Abrir la app Atajos";
}

async function abrirAtajos() {
  history.pushState({ p: "atajos" }, "", "#atajos");
  mostrarPantalla("#shortcuts-screen");
  $("#sc-url").value = `${cfg.supabaseUrl}/rest/v1/rpc/add_gasto`;
  $("#sc-key").value = cfg.supabaseAnonKey;
  $("#sc-token").value = "Cargando…";
  tokenAtajo = null;
  pintarPasosInstalacion(false);
  $("#copy-code").textContent = "Cargando tu código…";
  const { data, error } = await sb.rpc("mi_token_atajo");
  tokenAtajo = error ? null : data;
  $("#sc-token").value = tokenAtajo || "No se ha podido obtener el token";
  pintarPasosInstalacion(false);
}

/* ---------- Acceso ---------- */

async function entrar(ev) {
  ev.preventDefault();
  const email = $("#login-email").value.trim();
  const password = $("#login-pass").value;
  $("#login-msg").textContent = "Entrando…";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  $("#login-msg").textContent = error ? `Error: ${error.message}` : "";
}

async function entrarConGoogle() {
  $("#login-msg").textContent = "Abriendo Google…";
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) $("#login-msg").textContent = `Error: ${error.message}`;
}

async function registrarse() {
  const email = $("#login-email").value.trim();
  const password = $("#login-pass").value;
  if (!email || password.length < 8) {
    $("#login-msg").textContent = "Escribe un email y una contraseña de al menos 8 caracteres.";
    return;
  }
  $("#login-msg").textContent = "Creando cuenta…";
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) $("#login-msg").textContent = `Error: ${error.message}`;
  else if (!data.session) $("#login-msg").textContent = "Revisa tu email para confirmar la cuenta y luego entra.";
}

async function mostrarApp() {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  mostrarPantalla("#shell");
  cambiarVista(state.vista);
  state.presupuesto = await state.store.getBudget().catch(() => 0);
  await Promise.all([cargar(), cargarViajes()]);
  if (state.vista === "ajustes") llenarAjustes();
  if (new URLSearchParams(location.search).has("nuevo")) abrirAñadir();
}

function mostrarLogin() {
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  mostrarPantalla("#login");
}

/* ---------- Aviso de instalación ---------- */

function avisoInstalacion() {
  const instalada = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const cerrado = safeStorage(() => localStorage.getItem("gastos-erasmus:aviso-instalar"), null);
  if (instalada || cerrado) return;

  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const enApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//.test(ua);
  const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  let pasos = "";
  if (ios && (!safari || enApp)) {
    pasos = "Abre este enlace en Safari (si vienes de WhatsApp, pulsa el icono de la brújula o «Abrir en Safari»). Luego pulsa Compartir ⬆️ y «Añadir a pantalla de inicio».";
  } else if (ios) {
    pasos = "Pulsa Compartir ⬆️ abajo y luego «Añadir a pantalla de inicio».";
  } else if (android) {
    pasos = "Pulsa el menú ⋮ del navegador y luego «Instalar aplicación» o «Añadir a pantalla de inicio».";
  } else {
    return; // En el ordenador no hace falta insistir.
  }
  $("#install-steps").textContent = pasos;
  $("#install-hint").classList.remove("hidden");

  // Chrome en Android permite instalar con un botón.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    const btn = $("#install-btn");
    btn.classList.remove("hidden");
    btn.onclick = async () => {
      e.prompt();
      await e.userChoice.catch(() => {});
      $("#install-hint").classList.add("hidden");
    };
  });
  $("#install-close").addEventListener("click", () => {
    $("#install-hint").classList.add("hidden");
    safeStorage(() => localStorage.setItem("gastos-erasmus:aviso-instalar", "1"));
  });
}

/* ---------- Arranque ---------- */

function init() {
  renderCategoryPicker();
  avisoInstalacion();
  const errOAuth = new URLSearchParams(location.search).get("error_description");
  if (errOAuth) {
    $("#login-msg").textContent = `Error al entrar con Google: ${errOAuth}`;
    history.replaceState(null, "", location.pathname);
  }
  // Enlaces antiguos a #ajustes abren la sección Ajustes.
  if (location.hash === "#ajustes") state.vista = "ajustes";

  $$("[data-view]").forEach((b) => b.addEventListener("click", () => cambiarVista(b.dataset.view)));
  $$("[data-add]").forEach((b) => b.addEventListener("click", abrirAñadir));
  $$("[data-month]").forEach((b) => b.addEventListener("click", () => cambiarMes(Number(b.dataset.month))));
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  // Tocar fuera de la hoja la cierra.
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  $("#add-form").addEventListener("submit", añadir);
  $("#date").addEventListener("change", pistaViaje);
  $("#trip-new").addEventListener("click", () => abrirViaje());
  $("#trip-form").addEventListener("submit", guardarViaje);
  $("#trip-delete").addEventListener("click", borrarViaje);
  $("#trip-start").addEventListener("change", () => {
    if ($("#trip-end").value < $("#trip-start").value) $("#trip-end").value = $("#trip-start").value;
  });

  $("#open-shortcuts").addEventListener("click", abrirAtajos);
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => history.back()));
  window.addEventListener("popstate", pantallaDesdeHash);
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
    const input = $(b.dataset.copy);
    try {
      await navigator.clipboard.writeText(input.value);
    } catch {
      input.select();
      document.execCommand("copy");
    }
    toast("Copiado");
  }));
  $("#export-csv").addEventListener("click", exportarCSV);
  $("#save-budget").addEventListener("click", async () => {
    const v = $("#budget-input").value.trim() === "" ? 0 : parseAmount($("#budget-input").value);
    if (v === null) { toast("Presupuesto no válido"); return; }
    try {
      await state.store.setBudget(v);
      state.presupuesto = v;
      pintar();
      toast(v ? `Presupuesto: ${fmt(v)} al mes` : "Presupuesto quitado");
    } catch (e) {
      console.error(e);
      toast("No se ha podido guardar");
    }
  });

  if (remote) {
    $("#login-form").addEventListener("submit", entrar);
    $("#signup-btn").addEventListener("click", registrarse);
    $("#google-btn").addEventListener("click", entrarConGoogle);
    $("#logout").addEventListener("click", cerrarSesion);
    $("#copy-code").addEventListener("click", async () => {
      if (!tokenAtajo) return;
      const ok = await copiarTexto(tokenAtajo);
      if (ok) {
        pintarPasosInstalacion(true);
        toast("Código copiado");
      } else {
        toast("No se ha podido copiar. Usa «¿Prefieres crearlo a mano?»");
      }
    });
    $("#open-shortcut").addEventListener("click", () => {
      window.location.href = cfg.shortcutUrl || "shortcuts://create-shortcut";
    });
    $("#regen-token").addEventListener("click", async () => {
      if (!confirm("El código anterior dejará de funcionar y tendrás que volver a instalar el atajo. ¿Seguir?")) return;
      const { data, error } = await sb.rpc("regenerar_token_atajo");
      if (error) toast("No se ha podido regenerar");
      else {
        tokenAtajo = data;
        $("#sc-token").value = data;
        pintarPasosInstalacion(false);
        toast("Código nuevo generado: vuelve a instalar el atajo");
      }
    });
    for (const id of ["#sc-url", "#sc-key", "#sc-token"]) {
      $(id).addEventListener("focus", (e) => e.target.select());
    }
    sb.auth.onAuthStateChange((_event, session) => {
      const prev = state.user?.id;
      state.user = session?.user || null;
      if (!state.user) {
        state.gastos = [];
        state.rango = [];
        state.viajes = [];
        state.gastosViaje = [];
        mostrarLogin();
      }
      else if (prev !== state.user.id) mostrarApp();
    });
  } else {
    mostrarApp();
  }

  let resizeTimer;
  let escritorio = esEscritorio();
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.vista === "graficos") renderDashboard();
      if (escritorio !== esEscritorio()) {
        escritorio = esEscritorio();
        if (state.vista === "viajes") renderViajes();
      }
    }, 150);
  });
  // Tocar fuera de un gráfico oculta el tooltip.
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("svg")) Charts.hideTip(); });

  // Sin zoom con dos dedos ni con doble toque (iOS ignora user-scalable=no en algunos casos).
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }

  // Al volver a la app (p. ej. tras añadir un gasto desde el atajo), recargar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !$("#shell").classList.contains("hidden")) {
      cargar();
      cargarViajes();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
