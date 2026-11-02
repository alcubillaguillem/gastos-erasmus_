"use strict";

// Si algo falla, que se vea en pantalla en vez de que el botón «no haga nada».
window.addEventListener("error", (e) => {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = `Error: ${e.message}. Cierra la app del todo y vuelve a abrirla.`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 6000);
});

// Iconos de línea (24×24) que se pueden elegir para una categoría.
const ICONOS = {
  comida: "M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9",
  tabaco: "M3 14h14v4H3zM20 14v4M17 10c0-2 3-2 3-4.5",
  alcohol: "M8 3h8l-1 8a3 3 0 0 1-6 0zM12 14v7M9 21h6",
  ocio: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  viajes: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  transporte: "M7 3h10a2 2 0 0 1 2 2v13H5V5a2 2 0 0 1 2-2zM5 11h14M8 18v3M16 18v3",
  casa: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  compras: "M6 8h12l-1 13H7zM9 8V6a3 3 0 0 1 6 0v2",
  estudios: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8",
  cafe: "M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3",
  fiesta: "M4 4h16l-8 9zM12 13v7M8 20h8",
  gimnasio: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  deporte: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  salud: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  belleza: "M6 6a2.5 2.5 0 1 0 0 .01M6 18a2.5 2.5 0 1 0 0 .01M8 7.5 20 19M8 16.5 20 5",
  ropa: "M8 3 3 6l2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 0 1-8 0z",
  regalo: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0",
  movil: "M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2",
  internet: "M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01",
  coche: "M5 16h14v-4l-2-5H7l-2 5zM5 12h14M7 16v3M17 16v3M8 14h.01M16 14h.01",
  musica: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  cine: "M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4",
  juegos: "M6 9h12a4 4 0 0 1 0 8c-2 0-3-2-6-2s-4 2-6 2a4 4 0 0 1 0-8zM8 11v4M6 13h4M16 12h.01M18 14h.01",
  foto: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  dinero: "M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9",
  otros: "M6 12h.01M12 12h.01M18 12h.01",
};
const COLORES = ["#7dd3fc", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fca5a5", "#fdba74",
  "#fde68a", "#c5f04a", "#86efac", "#5eead4", "#d4d4d8", "#a1a1aa"];
// Categorías con las que empieza cada cuenta (en Supabase las crea la base de datos).
const CATEGORIAS_INICIALES = [
  ["comida", "Comida", "#7dd3fc"], ["tabaco", "Tabaco", "#fdba74"], ["alcohol", "Alcohol", "#f9a8d4"],
  ["ocio", "Ocio", "#c4b5fd"], ["viajes", "Viajes", "#c5f04a"], ["transporte", "Transporte", "#d4d4d8"],
  ["casa", "Casa", "#fde68a"], ["compras", "Compras", "#86efac"], ["estudios", "Estudios", "#93c5fd"],
  ["otros", "Otros", "#a1a1aa"],
].map(([clave, nombre, color], orden) => ({ clave, nombre, color, icono: clave, orden }));
const MAX_CATEGORIAS = 40;

// Nombre, color e icono de una categoría a partir de la clave guardada en el gasto.
function catInfo(clave) {
  const c = state.categorias.find((x) => x.clave === clave);
  if (!c) return { id: clave, nombre: clave ? clave.charAt(0).toUpperCase() + clave.slice(1) : "Otros", color: "#a1a1aa", icono: ICONOS.otros };
  return {
    id: c.clave,
    nombre: c.nombre,
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : "#a1a1aa",
    icono: ICONOS[c.icono] || ICONOS.otros,
  };
}
const icono = (d, extra = "") => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
const ICONO_X = "M6 6l12 12M18 6 6 18";
const ICONO_MAS = "M5 12h.01M12 12h.01M19 12h.01";
const ICONO_EDITAR = "M4 20h4L19 9l-4-4L4 16zM14 6l4 4";
const ICONO_AVION = "M22 2 11 13M22 2l-7 20-4-9-9-4z";
const ICONO_PAPELERA = "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3";
const ICONO_CHECK = "M5 12l5 5 9-10";

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
  constructor() {
    this.key = "gastos-erasmus:gastos";
    this.keyViajes = "gastos-erasmus:viajes";
    this.keyCats = "gastos-erasmus:categorias";
  }
  all() { return safeStorage(() => JSON.parse(localStorage.getItem(this.key)) || [], []); }
  save(list) { safeStorage(() => localStorage.setItem(this.key, JSON.stringify(list))); }
  async listMonth(from, to) {
    return this.all().filter((g) => g.fecha >= from && g.fecha <= to);
  }
  async listAll() { return this.all(); }
  async listConViaje() { return this.all().filter((g) => g.viaje_id); }
  // Igual que el trigger de Supabase: un gasto nuevo va al viaje abierto que cubra su fecha.
  async add(g) {
    const auto = this.viajesAll().filter((v) => !v.cerrado && g.fecha >= v.inicio && g.fecha <= v.fin)
      .sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
    const item = { viaje_id: auto?.id || null, ...g, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const list = this.all(); list.push(item); this.save(list);
    return item;
  }
  async update(id, patch) {
    const list = this.all().map((g) => (g.id === id ? { ...g, ...patch } : g));
    this.save(list);
    return list.find((g) => g.id === id);
  }
  async remove(id) { this.save(this.all().filter((g) => g.id !== id)); }
  // Igual que el trigger de Supabase: un viaje abierto recoge los gastos sin viaje de sus fechas.
  recoger(v) {
    if (v.cerrado) return;
    this.save(this.all().map((g) => (!g.viaje_id && g.fecha >= v.inicio && g.fecha <= v.fin ? { ...g, viaje_id: v.id } : g)));
  }
  async getBudget() { return safeStorage(() => Number(localStorage.getItem("gastos-erasmus:presupuesto")) || 0, 0); }
  async setBudget(v) { safeStorage(() => localStorage.setItem("gastos-erasmus:presupuesto", String(v))); }

  viajesAll() { return safeStorage(() => JSON.parse(localStorage.getItem(this.keyViajes)) || [], []); }
  viajesSave(list) { safeStorage(() => localStorage.setItem(this.keyViajes, JSON.stringify(list))); }
  async listViajes() { return this.viajesAll().sort((a, b) => b.inicio.localeCompare(a.inicio)); }
  async addViaje(v) {
    const item = { cerrado: false, ...v, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this.viajesSave([...this.viajesAll(), item]);
    this.recoger(item);
    return item;
  }
  async updateViaje(id, patch) {
    const list = this.viajesAll().map((v) => (v.id === id ? { ...v, ...patch } : v));
    this.viajesSave(list);
    const v = list.find((x) => x.id === id);
    if ("inicio" in patch || "fin" in patch) this.recoger(v);
    return v;
  }
  async removeViaje(id) {
    this.viajesSave(this.viajesAll().filter((v) => v.id !== id));
    this.save(this.all().map((g) => (g.viaje_id === id ? { ...g, viaje_id: null } : g)));
  }

  catsAll() { return safeStorage(() => JSON.parse(localStorage.getItem(this.keyCats)) || [], []); }
  catsSave(list) { safeStorage(() => localStorage.setItem(this.keyCats, JSON.stringify(list))); }
  async listCategorias() {
    if (!this.catsAll().length) {
      this.catsSave(CATEGORIAS_INICIALES.map((c) => ({ ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() })));
    }
    return this.catsAll().sort((a, b) => a.orden - b.orden);
  }
  async addCategoria(c) {
    const item = { ...c, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this.catsSave([...this.catsAll(), item]);
    return item;
  }
  async updateCategoria(id, patch) {
    const list = this.catsAll().map((c) => (c.id === id ? { ...c, ...patch } : c));
    this.catsSave(list);
    return list.find((c) => c.id === id);
  }
  async removeCategoria(id) { this.catsSave(this.catsAll().filter((c) => c.id !== id)); }
  async recategorizar(de, a) {
    this.save(this.all().map((g) => (g.categoria === de ? { ...g, categoria: a } : g)));
  }
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
  async listConViaje() {
    const { data, error } = await this.sb.from("gastos").select("*").not("viaje_id", "is", null);
    if (error) throw error;
    return data;
  }
  async add(g) {
    const { data, error } = await this.sb.from("gastos").insert(g).select().single();
    if (error) throw error;
    return data;
  }
  async update(id, patch) {
    const { data, error } = await this.sb.from("gastos").update(patch).eq("id", id).select().single();
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
  // Una cuenta nueva empieza con las 10 categorías de siempre (las crea la base de datos).
  async listCategorias() {
    const leer = () => this.sb.from("categorias").select("*").order("orden").order("created_at");
    let { data, error } = await leer();
    if (error) throw error;
    if (!data.length) {
      const r = await this.sb.rpc("crear_categorias_iniciales");
      if (r.error) throw r.error;
      ({ data, error } = await leer());
      if (error) throw error;
    }
    return data;
  }
  async addCategoria(c) {
    const { data, error } = await this.sb.from("categorias").insert(c).select().single();
    if (error) throw error;
    return data;
  }
  async updateCategoria(id, patch) {
    const { data, error } = await this.sb.from("categorias").update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async removeCategoria(id) {
    const { error } = await this.sb.from("categorias").delete().eq("id", id);
    if (error) throw error;
  }
  async recategorizar(de, a) {
    const { error } = await this.sb.from("gastos").update({ categoria: a }).eq("categoria", de);
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
  categorias: [],    // categorías del usuario, en su orden
  catEdit: null,     // categoría que se está editando en la hoja
  gastos: [],        // gastos del mes seleccionado
  rango: [],         // gastos de los últimos 6 meses (para los gráficos)
  viajes: [],        // viajes, del más reciente al más antiguo
  gastosViaje: [],   // gastos que pertenecen a algún viaje
  viajeSel: null,    // id del viaje abierto en la pestaña Viajes
  viajeEdit: null,   // viaje que se está editando en la hoja
  gastoEdit: null,   // gasto que se está editando en la hoja de añadir
  verTodoViaje: false, // en el detalle de un viaje, mostrar todos sus gastos
  verCerrados: false,  // sección «Cerrados» desplegada en la pestaña Viajes
  vista: VISTAS.includes(vistaGuardada) ? vistaGuardada : "inicio",
  verTodo: false,    // en Inicio, mostrar los gastos de todo el mes y no solo los de hoy
  pickerYear: new Date().getFullYear(),
  presupuesto: 0,
  user: null,
};

/* ---------- Viajes: qué gastos cuentan ---------- */

// Cada gasto guarda su viaje (viaje_id). Al apuntarlo va solo al viaje abierto que cubra
// su fecha; después se puede mover a cualquier viaje abierto desde el menú del gasto.
function viajeDe(g) {
  return g.viaje_id ? state.viajes.find((v) => v.id === g.viaje_id) || null : null;
}
function enFechas(v, g) { return g.fecha >= v.inicio && g.fecha <= v.fin; }
// Viaje al que irá un gasto nuevo de esa fecha (mismo criterio que el trigger de Supabase).
function viajeAuto(fecha) {
  return state.viajes.find((v) => !v.cerrado && enFechas(v, { fecha })) || null;
}
function gastosDe(v) {
  return state.gastosViaje.filter((g) => g.viaje_id === v.id);
}
const viajesAbiertos = () => state.viajes.filter((v) => !v.cerrado);
function viajeEnCurso() {
  const hoy = hoyISO();
  return state.viajes.find((v) => !v.cerrado && v.inicio <= hoy && hoy <= v.fin) || null;
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
  for (const cat of state.categorias) {
    const c = catInfo(cat.clave);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat";
    b.setAttribute("role", "radio");
    b.dataset.cat = c.id;
    b.setAttribute("aria-checked", String(c.id === state.categoria));
    b.innerHTML = `${icono(c.icono, ` style="color:${c.color}"`)}<span></span>`;
    b.querySelector("span").textContent = c.nombre;
    b.addEventListener("click", () => {
      elegirCategoria(c.id);
      if (!state.gastoEdit) safeStorage(() => localStorage.setItem("gastos-erasmus:ultima-cat", c.id));
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

// Hora a la que se apuntó el gasto ("14:32"), para ubicarlo.
function horaDe(g) {
  if (!g.created_at) return "";
  const d = new Date(g.created_at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function itemGasto(g, { conViaje = true } = {}) {
  const c = catInfo(g.categoria);
  const v = conViaje ? viajeDe(g) : null;
  const el = document.createElement("div");
  el.className = "item";
  el.innerHTML = `
    <span class="cat-ic" style="color:${c.color}">${icono(c.icono)}</span>
    <div class="info"><div class="note"></div><div class="meta"></div></div>
    <span class="amt">−${esc(fmt(g.importe).replace(/\s?€$/, ""))}</span>
    <button type="button" class="more" aria-label="Opciones del gasto">${icono(ICONO_MAS)}</button>`;
  el.querySelector(".note").textContent = g.nota || c.nombre;
  const partes = [horaDe(g), g.nota ? c.nombre : ""].filter(Boolean);
  const meta = el.querySelector(".meta");
  meta.textContent = partes.join(" · ");
  if (v) {
    if (partes.length) meta.append(" · ");
    const s = document.createElement("span");
    s.className = "trip";
    s.textContent = v.nombre;
    meta.append(s);
  }
  el.querySelector(".more").addEventListener("click", () => abrirMenuGasto(g, el));
  mantenerPulsado(el, () => abrirMenuGasto(g, el));
  return el;
}

// Gastos agrupados por día, del más reciente al más antiguo.
function pintarDias(cont, gastos, { sinCabecera = null, conViaje = true } = {}) {
  const hoy = hoyISO();
  const ayer = isoDate(new Date(Date.now() - 86400000));
  const porDia = new Map();
  for (const g of gastos) {
    if (!porDia.has(g.fecha)) porDia.set(g.fecha, []);
    porDia.get(g.fecha).push(g);
  }
  for (const dia of [...porDia.keys()].sort().reverse()) {
    const items = porDia.get(dia).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    if (dia !== sinCabecera) {
      const head = document.createElement("div");
      head.className = "day";
      const nombre = dia === hoy ? "Hoy" : dia === ayer ? "Ayer"
        : parseISO(dia).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
      head.innerHTML = `<span></span><span>${esc(fmt(sum(items)))}</span>`;
      head.firstChild.textContent = nombre;
      cont.appendChild(head);
    }
    for (const g of items) cont.appendChild(itemGasto(g, { conViaje }));
  }
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
    return `<div class="legend-row"><span class="dot" style="background:${c.color}"></span><span class="name">${esc(c.nombre)}</span><span>${esc(fmt(v))}</span></div>`;
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

  // Movimientos agrupados por día. En el mes actual, al principio solo se ven los de hoy.
  const list = $("#list");
  const soloHoy = m.esMesActual && !state.verTodo;
  const visibles = soloHoy ? state.gastos.filter((g) => g.fecha === hoy) : state.gastos;
  const ocultos = state.gastos.length - visibles.length;
  $("#list-title").textContent = soloHoy ? "Gastos de hoy" : "Movimientos del mes";
  list.innerHTML = visibles.length ? ""
    : `<div class="empty">${soloHoy ? "Hoy aún no has apuntado nada" : "Aún no hay gastos este mes"}</div>`;
  const more = $("#list-more");
  more.classList.toggle("hidden", !(ocultos > 0 || (m.esMesActual && state.verTodo)));
  more.textContent = soloHoy
    ? `Ver más · ${ocultos} ${ocultos === 1 ? "gasto" : "gastos"} de otros días`
    : "Ver solo los de hoy";
  pintarDias(list, visibles, { sinCabecera: soloHoy ? hoy : null });
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
    state.gastosViaje = state.viajes.length ? await state.store.listConViaje() : [];
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
      irAMes(y, mo);
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

const GASTOS_VIAJE_VISIBLES = 5;

function tarjetaViaje(v, s, vc) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "trip-card" + (vc?.id === v.id ? " current" : "") + (v.cerrado ? " closed" : "");
  b.setAttribute("aria-current", String(state.viajeSel === v.id));
  const estado = v.cerrado ? "" : s.estado === "en-curso" ? `<span class="live">En curso · día ${s.vividos} de ${s.dias}</span>`
    : s.estado === "futuro" ? `<span class="small muted">Próximamente</span>` : "";
  b.innerHTML = `${estado}
    <span class="top-line"><span class="t-name"></span><span class="t-total">${esc(fmt(s.total))}</span></span>
    <span class="small muted">${esc(rangoTexto(v.inicio, v.fin))} · ${esc(fmt(s.porDia))}/día</span>
    <span class="stack"></span>`;
  b.querySelector(".t-name").textContent = v.nombre;
  pintarStack(b.querySelector(".stack"), porCategoria(s.gastos), s.total || 1);
  b.addEventListener("click", () => {
    if (state.viajeSel !== v.id) state.verTodoViaje = false;
    state.viajeSel = v.id;
    renderViajes();
    if (!esEscritorio()) window.scrollTo(0, 0);
  });
  return b;
}

function renderViajes() {
  const lista = $("#trips-list");
  const detalle = $("#trip-detail");
  const stats = new Map(state.viajes.map((v) => [v.id, statsViaje(v)]));
  const totalViajes = [...stats.values()].reduce((s, x) => s + x.total, 0);
  const n = state.viajes.length;
  const abiertos = viajesAbiertos();
  const cerrados = state.viajes.filter((v) => v.cerrado);
  $("#trips-summary").textContent = n
    ? `${n} ${n === 1 ? "viaje" : "viajes"} · ${fmt(totalViajes)} en total`
    : "";

  if (state.viajeSel && !state.viajes.some((v) => v.id === state.viajeSel)) state.viajeSel = null;
  // En el ordenador siempre hay un viaje abierto: el que está en curso o el más reciente.
  if (!state.viajeSel && esEscritorio() && n) state.viajeSel = (viajeEnCurso() || abiertos[0] || state.viajes[0]).id;

  lista.innerHTML = n ? "" : `<div class="card empty">Aún no tienes viajes. Crea uno con «Nuevo viaje» y sus gastos se sumarán solos.</div>`;
  const vc = viajeEnCurso();
  if (n) {
    lista.insertAdjacentHTML("beforeend", `<div class="label trips-label">Abiertos</div>`);
    if (!abiertos.length) lista.insertAdjacentHTML("beforeend", `<div class="small muted trips-none">No tienes viajes abiertos.</div>`);
  }
  for (const v of abiertos) lista.appendChild(tarjetaViaje(v, stats.get(v.id), vc));
  if (cerrados.length) {
    const det = document.createElement("details");
    det.className = "closed-trips";
    det.open = state.verCerrados || cerrados.some((v) => v.id === state.viajeSel);
    det.innerHTML = `<summary class="label">Cerrados · ${cerrados.length}</summary>`;
    det.addEventListener("toggle", () => { state.verCerrados = det.open; });
    const cont = document.createElement("div");
    cont.className = "trips-list-inner";
    for (const v of cerrados) cont.appendChild(tarjetaViaje(v, stats.get(v.id), vc));
    det.appendChild(cont);
    lista.appendChild(det);
  }

  const v = state.viajes.find((x) => x.id === state.viajeSel);
  $(".trips-layout").classList.toggle("detail-open", Boolean(v));
  detalle.classList.toggle("hidden", !v);
  if (!v) return;
  const s = stats.get(v.id);

  const estado = v.cerrado ? " · cerrado" : s.estado === "en-curso" ? ` · día ${s.vividos} de ${s.dias}` : s.estado === "futuro" ? " · próximamente" : ` · ${s.dias} ${s.dias === 1 ? "día" : "días"}`;
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
    <button type="button" class="btn wide trip-close" id="trip-close"></button>
    <div class="sub-grid">
      <div class="cat-rows"><div class="label">Por categoría</div></div>
      <div class="cat-rows"><div class="label">Por día</div><div class="day-bars"></div><div class="day-labels"></div></div>
    </div>
    <div class="trip-gastos"><div class="label">Gastos del viaje</div><div class="list"></div></div>`;
  detalle.querySelector("h2").textContent = v.nombre;
  detalle.querySelector(".trip-back").addEventListener("click", () => { state.viajeSel = null; renderViajes(); });
  detalle.querySelector("#trip-edit").addEventListener("click", () => abrirViaje(v));
  const cerrar = detalle.querySelector("#trip-close");
  cerrar.innerHTML = v.cerrado
    ? `${icono("M4 12a8 8 0 1 0 3-6.2M4 4v4h4")}Reabrir viaje`
    : `${icono(ICONO_CHECK)}Terminar viaje`;
  cerrar.classList.toggle("reopen", v.cerrado);
  cerrar.addEventListener("click", () => cambiarCerrado(v, !v.cerrado));

  const cats = detalle.querySelector(".cat-rows");
  const filas = porCategoria(s.gastos);
  if (!filas.length) cats.insertAdjacentHTML("beforeend", `<div class="empty">Sin gastos todavía</div>`);
  for (const [id, imp] of filas) {
    const c = catInfo(id);
    cats.insertAdjacentHTML("beforeend", `<div class="cat-row"><div class="row-top"><span>${esc(c.nombre)}</span><span>${esc(fmt(imp))}</span></div>
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

  // Gastos del viaje: los últimos y «Ver más» para el resto, como en Inicio.
  const cont = detalle.querySelector(".trip-gastos .list");
  const ordenados = [...s.gastos].sort((a, b) => (b.fecha + b.created_at).localeCompare(a.fecha + a.created_at));
  if (!ordenados.length) {
    cont.innerHTML = `<div class="empty">${v.cerrado ? "Este viaje no tiene gastos."
      : "Los gastos que apuntes entre la ida y la vuelta aparecerán aquí. También puedes añadir cualquier gasto manteniéndolo pulsado."}</div>`;
  }
  const visibles = state.verTodoViaje ? ordenados : ordenados.slice(0, GASTOS_VIAJE_VISIBLES);
  pintarDias(cont, visibles, { conViaje: false });
  const ocultos = ordenados.length - visibles.length;
  if (ordenados.length > GASTOS_VIAJE_VISIBLES) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "btn wide more-btn";
    more.textContent = state.verTodoViaje ? "Ver menos" : `Ver más · ${ocultos} ${ocultos === 1 ? "gasto" : "gastos"} más`;
    more.addEventListener("click", () => { state.verTodoViaje = !state.verTodoViaje; renderViajes(); });
    detalle.querySelector(".trip-gastos").appendChild(more);
  }
}

async function cambiarCerrado(v, cerrado) {
  try {
    const nuevo = await state.store.updateViaje(v.id, { cerrado });
    state.viajes = state.viajes.map((x) => (x.id === v.id ? nuevo : x));
    if (cerrado) state.verCerrados = true;
    pintar();
    toast(cerrado ? `Viaje a ${v.nombre} terminado` : `Viaje a ${v.nombre} reabierto`);
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
    if (state.viajeSel !== v.id) state.verTodoViaje = false;
    state.viajeSel = v.id;
    $("#trip-sheet").close();
    toast(state.viajeEdit ? "Viaje guardado" : `Viaje a ${nombre} creado`);
    await Promise.all([cargar(), cargarViajes()]);
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
    await Promise.all([cargar(), cargarViajes()]);
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

/* ---------- Categorías del usuario ---------- */

async function cargarCategorias() {
  try {
    state.categorias = await state.store.listCategorias();
  } catch (e) {
    console.error(e);
    toast("No se han podido cargar las categorías");
  }
  renderCategoryPicker();
  pintarCategoriasAjustes();
}

const ICONO_ARRASTRAR = "M5 9h14M5 15h14";

function pintarCategoriasAjustes() {
  const cont = $("#cats-admin");
  cont.innerHTML = "";
  state.categorias.forEach((cat) => {
    const c = catInfo(cat.clave);
    const row = document.createElement("div");
    row.className = "cat-admin-row";
    row.innerHTML = `
      <button type="button" class="cat-admin-main"><span class="cat-ic" style="color:${c.color}">${icono(c.icono)}</span><span class="cat-admin-name"></span></button>
      <button type="button" class="more" aria-label="Opciones de la categoría">${icono(ICONO_MAS)}</button>
      <span class="drag-handle" aria-hidden="true">${icono(ICONO_ARRASTRAR)}</span>`;
    row.querySelector(".cat-admin-name").textContent = c.nombre;
    row.querySelector(".cat-admin-main").addEventListener("click", () => {
      // Tras mantener pulsado o arrastrar, el clic que llega al soltar no abre la hoja.
      if (Date.now() < Number(row.dataset.ignorarHasta || 0)) return;
      abrirCategoria(cat);
    });
    row.querySelector(".more").addEventListener("click", () => abrirMenuCategoria(cat, row));
    prepararArrastre(row, cat);
    cont.appendChild(row);
  });
  $("#cat-new").disabled = state.categorias.length >= MAX_CATEGORIAS;
}

// Mantener pulsada una categoría abre su menú; si después se mueve el dedo, el menú se
// cierra y la fila se arrastra (como en iPhone). Desde el asa ≡ se arrastra directamente.
function prepararArrastre(row, cat) {
  let timer = null, x0 = 0, y0 = 0, pulsado = false;
  const asa = row.querySelector(".drag-handle");
  const cancelar = () => { clearTimeout(timer); timer = null; row.classList.remove("pressing"); };

  row.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".more")) return;
    x0 = e.clientX; y0 = e.clientY; pulsado = false;
    if (asa.contains(e.target)) {
      e.preventDefault();
      asa.setPointerCapture(e.pointerId);
      arrastrar(row, asa, e.pointerId, y0);
      return;
    }
    row.classList.add("pressing");
    const id = e.pointerId;
    timer = setTimeout(() => {
      timer = null;
      row.classList.remove("pressing");
      pulsado = true;
      try { row.setPointerCapture(id); } catch { /* el dedo ya se levantó */ }
      navigator.vibrate?.(10);
      abrirMenuCategoria(cat, row);
    }, 450);
  });
  row.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancelar();
    else if (pulsado && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) {
      pulsado = false;
      cerrarMenu(true);
      arrastrar(row, row, e.pointerId, y0);
      row.dispatchEvent(new PointerEvent("pointermove", e));
    }
  });
  for (const ev of ["pointerup", "pointercancel"]) {
    row.addEventListener(ev, () => {
      if (pulsado) row.dataset.ignorarHasta = String(Date.now() + 500);
      cancelar();
      pulsado = false;
    });
  }
  row.addEventListener("pointerleave", () => { if (timer) cancelar(); });
  row.addEventListener("contextmenu", (e) => { e.preventDefault(); cancelar(); abrirMenuCategoria(cat, row); });
  // En iOS, una vez pulsada la fila, el dedo no debe desplazar la página.
  row.addEventListener("touchmove", (e) => { if (pulsado || row.classList.contains("dragging")) e.preventDefault(); }, { passive: false });
}

function arrastrar(row, capturador, pointerId, y0) {
  const cont = $("#cats-admin");
  const filas = [...cont.children];
  const i = filas.indexOf(row);
  const rects = filas.map((f) => f.getBoundingClientRect());
  const paso = filas.length > 1 ? rects[1].top - rects[0].top : rects[i].height;
  const scroll0 = window.scrollY;
  let destino = i, ultimoY = y0, raf = null, fin = false;

  row.classList.add("dragging");
  cont.classList.add("sorting");

  const actualizar = () => {
    const dy = ultimoY - y0 + (window.scrollY - scroll0);
    row.style.transform = `translateY(${dy}px) scale(1.02)`;
    const centro = rects[i].top + rects[i].height / 2 + dy;
    destino = i;
    filas.forEach((f, j) => {
      const mitad = rects[j].top + rects[j].height / 2;
      if (j < i && centro < mitad) destino = Math.min(destino, j);
      if (j > i && centro > mitad) destino = Math.max(destino, j);
    });
    filas.forEach((f, j) => {
      if (j === i) return;
      const desplazar = i < j && j <= destino ? -paso : destino <= j && j < i ? paso : 0;
      f.style.transform = desplazar ? `translateY(${desplazar}px)` : "";
    });
  };
  // Si el dedo llega al borde de la pantalla, la página se desplaza sola.
  const autoScroll = () => {
    if (fin) return;
    const abajo = window.innerHeight - (esEscritorio() ? 0 : 90);
    const v = ultimoY < 90 ? -8 : ultimoY > abajo - 60 ? 8 : 0;
    if (v) { window.scrollBy(0, v); actualizar(); }
    raf = requestAnimationFrame(autoScroll);
  };
  raf = requestAnimationFrame(autoScroll);

  const mover = (e) => { if (e.pointerId !== pointerId) return; ultimoY = e.clientY; actualizar(); };
  const soltar = (e) => {
    if (e.pointerId !== pointerId) return;
    fin = true;
    cancelAnimationFrame(raf);
    capturador.removeEventListener("pointermove", mover);
    capturador.removeEventListener("pointerup", soltar);
    capturador.removeEventListener("pointercancel", soltar);
    row.dataset.ignorarHasta = String(Date.now() + 500);
    cont.classList.remove("sorting");
    row.classList.remove("dragging");
    filas.forEach((f) => { f.style.transform = ""; });
    if (destino !== i) {
      const lista = [...state.categorias];
      const [movida] = lista.splice(i, 1);
      lista.splice(destino, 0, movida);
      guardarOrden(lista);
    }
  };
  capturador.addEventListener("pointermove", mover);
  capturador.addEventListener("pointerup", soltar);
  capturador.addEventListener("pointercancel", soltar);
  actualizar();
}

let catColor = COLORES[0];
let catIcono = "otros";

function pintarHojaCategoria() {
  $("#cat-preview").style.color = catColor;
  $("#cat-preview").innerHTML = icono(ICONOS[catIcono] || ICONOS.otros);
  $$("#cat-colors button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.color === catColor)));
  $$("#cat-icons button").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.icono === catIcono));
    b.style.color = b.dataset.icono === catIcono ? catColor : "";
  });
}

function prepararHojaCategoria() {
  const colores = $("#cat-colors");
  for (const color of COLORES) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Color ${color}`);
    b.dataset.color = color;
    b.style.background = color;
    b.addEventListener("click", () => { catColor = color; pintarHojaCategoria(); });
    colores.appendChild(b);
  }
  const iconos = $("#cat-icons");
  for (const [clave, d] of Object.entries(ICONOS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.setAttribute("aria-label", `Icono ${clave}`);
    b.dataset.icono = clave;
    b.innerHTML = icono(d);
    b.addEventListener("click", () => { catIcono = clave; pintarHojaCategoria(); });
    iconos.appendChild(b);
  }
}

function abrirCategoria(cat = null) {
  if (!cat && state.categorias.length >= MAX_CATEGORIAS) { toast(`Como mucho ${MAX_CATEGORIAS} categorías`); return; }
  state.catEdit = cat;
  $("#cat-title").textContent = cat ? "Editar categoría" : "Nueva categoría";
  $("#cat-name").value = cat ? cat.nombre : "";
  catColor = cat ? catInfo(cat.clave).color : COLORES[state.categorias.length % COLORES.length];
  catIcono = cat && ICONOS[cat.icono] ? cat.icono : "otros";
  $("#cat-delete").classList.toggle("hidden", !cat || state.categorias.length <= 1);
  pintarHojaCategoria();
  $("#cat-sheet").showModal();
  if (!cat) $("#cat-name").focus();
}

async function guardarCategoria(ev) {
  ev.preventDefault();
  const nombre = $("#cat-name").value.trim().replace(/\s+/g, " ");
  if (!nombre) { toast("Ponle un nombre"); return; }
  const ed = state.catEdit;
  const repetida = state.categorias.some((c) => c.id !== ed?.id && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
  if (repetida) { toast("Ya tienes una categoría con ese nombre"); return; }
  const btn = ev.submitter || $("#cat-form button[type=submit]");
  btn.disabled = true;
  try {
    const datos = { nombre, color: catColor, icono: catIcono };
    if (ed) {
      const nueva = await state.store.updateCategoria(ed.id, datos);
      state.categorias = state.categorias.map((c) => (c.id === ed.id ? nueva : c));
    } else {
      const orden = state.categorias.reduce((m, c) => Math.max(m, c.orden), -1) + 1;
      const clave = "c-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      state.categorias.push(await state.store.addCategoria({ ...datos, clave, orden }));
    }
    $("#cat-sheet").close();
    renderCategoryPicker();
    pintarCategoriasAjustes();
    pintar();
    toast(ed ? "Categoría guardada" : `Categoría ${nombre} creada`);
  } catch (e) {
    console.error(e);
    toast(e?.code === "23505" ? "Ya tienes una categoría con ese nombre" : "No se ha podido guardar");
  } finally {
    btn.disabled = false;
  }
}

// Al borrar una categoría, sus gastos pasan a «Otros» (o a la primera que quede).
async function borrarCategoria() {
  const cat = state.catEdit;
  if (!cat) return;
  const resto = state.categorias.filter((c) => c.id !== cat.id);
  if (!resto.length) return;
  const destino = resto.find((c) => c.clave === "otros") || resto[0];
  if (!confirm(`¿Borrar la categoría ${cat.nombre}? Sus gastos pasarán a ${destino.nombre}.`)) return;
  try {
    await state.store.recategorizar(cat.clave, destino.clave);
    await state.store.removeCategoria(cat.id);
    state.categorias = resto;
    if (state.categoria === cat.clave) state.categoria = destino.clave;
    $("#cat-sheet").close();
    renderCategoryPicker();
    pintarCategoriasAjustes();
    toast("Categoría borrada");
    await Promise.all([cargar(), cargarViajes()]);
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

// Guarda el nuevo orden: es el mismo en el que el atajo muestra las categorías.
async function guardarOrden(lista) {
  const cambios = lista.map((c, orden) => ({ c, orden })).filter(({ c, orden }) => c.orden !== orden);
  state.categorias = lista.map((c, orden) => ({ ...c, orden }));
  pintarCategoriasAjustes();
  renderCategoryPicker();
  try {
    await Promise.all(cambios.map(({ c, orden }) => state.store.updateCategoria(c.id, { orden })));
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar el orden");
    await cargarCategorias();
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
    quitarGasto(g.id);
    aplicarRango();
    pintar();
    toast("Gasto borrado");
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

// Mantiene las listas en memoria al día tras crear, editar o borrar un gasto.
function quitarGasto(id) {
  state.rango = state.rango.filter((x) => x.id !== id);
  state.gastosViaje = state.gastosViaje.filter((x) => x.id !== id);
}
function ponerGasto(g) {
  quitarGasto(g.id);
  const [from, to] = rangoActual();
  if (g.fecha >= from && g.fecha <= to) state.rango.unshift(g);
  if (g.viaje_id) state.gastosViaje.unshift(g);
}

/* ---------- Menú del gasto (mantener pulsado, como en iPhone) ---------- */

// Mantener pulsado medio segundo abre el menú. En el ordenador también con clic derecho.
function mantenerPulsado(el, fn) {
  let timer = null, x0 = 0, y0 = 0;
  const cancelar = () => { clearTimeout(timer); timer = null; el.classList.remove("pressing"); };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    x0 = e.clientX; y0 = e.clientY;
    el.classList.add("pressing");
    timer = setTimeout(() => { timer = null; el.classList.remove("pressing"); fn(); }, 450);
  });
  el.addEventListener("pointermove", (e) => {
    if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancelar();
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(ev, cancelar);
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); cancelar(); fn(); });
}

let menuAbierto = null;

function cerrarMenu(inmediato = false) {
  if (!menuAbierto) return;
  const m = menuAbierto;
  menuAbierto = null;
  if (inmediato) { m.remove(); return; }
  m.classList.remove("show");
  setTimeout(() => m.remove(), 180);
}

function filaMenu(texto, icon, fn, { peligro = false, activo = false } = {}) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctx-row" + (peligro ? " danger" : "") + (activo ? " active" : "");
  b.innerHTML = `<span></span>${icon ? icono(icon) : ""}`;
  b.firstChild.textContent = texto;
  b.addEventListener("click", fn);
  return b;
}

// Menú estilo iPhone: la copia del elemento queda en su sitio y el menú debajo (o encima).
// construir(menu, colocar) rellena el menú y llama a colocar() cada vez que cambia.
function abrirMenu(el, construir) {
  if (menuAbierto) return;
  const rect = el.getBoundingClientRect();
  const capa = document.createElement("div");
  capa.className = "ctx-layer";
  capa.innerHTML = `<div class="ctx-preview"></div><div class="ctx-menu" role="menu"></div>`;
  const preview = capa.querySelector(".ctx-preview");
  const copia = el.cloneNode(true);
  copia.classList.remove("pressing");
  copia.querySelectorAll(".more, .drag-handle").forEach((x) => x.remove());
  preview.appendChild(copia);
  const menu = capa.querySelector(".ctx-menu");
  document.body.appendChild(capa);
  menuAbierto = capa;

  function colocar() {
    const margen = 12, hueco = 8;
    const alto = window.innerHeight;
    const hMenu = menu.offsetHeight;
    const ancho = Math.min(rect.width, window.innerWidth - margen * 2);
    let top = rect.top;
    preview.style.left = `${Math.max(margen, rect.left)}px`;
    preview.style.width = `${ancho}px`;
    const debajo = top + rect.height + hueco + hMenu <= alto - margen;
    const encima = top - hueco - hMenu >= margen;
    if (!debajo && !encima) top = Math.max(margen, alto - margen - hMenu - hueco - rect.height);
    preview.style.top = `${top}px`;
    const menuTop = debajo || !encima ? top + rect.height + hueco : top - hueco - hMenu;
    menu.style.top = `${menuTop}px`;
    const izquierda = rect.left + rect.width / 2 < window.innerWidth / 2;
    menu.style.left = izquierda ? `${Math.max(margen, rect.left)}px` : "auto";
    menu.style.right = izquierda ? "auto" : `${Math.max(margen, window.innerWidth - rect.right)}px`;
  }

  construir(menu, colocar);
  capa.addEventListener("click", (e) => { if (e.target === capa || e.target.closest(".ctx-preview")) cerrarMenu(); });
  requestAnimationFrame(() => capa.classList.add("show"));
}

function abrirMenuGasto(g, el) {
  abrirMenu(el, (menu, colocar) => {
    const v = viajeDe(g);
    const principal = () => {
      menu.innerHTML = "";
      menu.append(
        filaMenu("Editar", ICONO_EDITAR, () => { cerrarMenu(); abrirAñadir(g); }),
        filaMenu(v ? "Cambiar de viaje" : "Añadir a viaje", ICONO_AVION, viajes),
        filaMenu("Eliminar", ICONO_PAPELERA, () => { cerrarMenu(); borrar(g); }, { peligro: true }),
      );
      if (v) {
        const info = document.createElement("div");
        info.className = "ctx-info";
        info.textContent = `En el viaje a ${v.nombre}`;
        menu.prepend(info);
      }
      colocar();
    };
    const viajes = () => {
      menu.innerHTML = "";
      menu.append(filaMenu("Atrás", "M15 6l-6 6 6 6", principal));
      menu.firstChild.classList.add("back");
      const abiertos = viajesAbiertos();
      if (!abiertos.length) {
        const info = document.createElement("div");
        info.className = "ctx-info";
        info.textContent = "No tienes viajes abiertos";
        menu.append(info);
      }
      for (const x of abiertos) {
        menu.append(filaMenu(x.nombre, x.id === g.viaje_id ? ICONO_CHECK : null,
          () => { cerrarMenu(); if (x.id !== g.viaje_id) moverAViaje(g, x); }, { activo: x.id === g.viaje_id }));
      }
      if (v) menu.append(filaMenu("Quitar del viaje", ICONO_X, () => { cerrarMenu(); moverAViaje(g, null); }, { peligro: true }));
      colocar();
    };
    principal();
  });
}

function abrirMenuCategoria(cat, el) {
  abrirMenu(el, (menu, colocar) => {
    menu.append(filaMenu("Editar", ICONO_EDITAR, () => { cerrarMenu(); abrirCategoria(cat); }));
    if (state.categorias.length > 1) {
      menu.append(filaMenu("Eliminar", ICONO_PAPELERA, () => { cerrarMenu(); state.catEdit = cat; borrarCategoria(); }, { peligro: true }));
    }
    const info = document.createElement("div");
    info.className = "ctx-info";
    info.textContent = "Arrastra para cambiar el orden";
    menu.append(info);
    colocar();
  });
}

async function moverAViaje(g, v) {
  try {
    const nuevo = await state.store.update(g.id, { viaje_id: v ? v.id : null });
    ponerGasto(nuevo);
    aplicarRango();
    pintar();
    toast(v ? `Añadido al viaje a ${v.nombre}` : "Quitado del viaje");
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar");
  }
}

/* ---------- Añadir o editar gasto ---------- */

function pistaViaje() {
  const p = $("#add-trip-hint");
  const g = state.gastoEdit;
  const v = g ? viajeDe(g) : viajeAuto($("#date").value || hoyISO());
  p.classList.toggle("hidden", !v);
  if (v) p.textContent = g ? `En el viaje a ${v.nombre}.` : `Se sumará al viaje a ${v.nombre}.`;
}

function elegirCategoria(id) {
  state.categoria = id;
  $$("#cat-grid .cat").forEach((el) => el.setAttribute("aria-checked", String(el.dataset.cat === id)));
}

function abrirAñadir(g = null) {
  // Al crear, la fecha vuelve a ser hoy cada vez, aunque la app lleve días abierta.
  state.gastoEdit = g && g.id ? g : null;
  const ed = state.gastoEdit;
  $("#add-title").textContent = ed ? "Editar gasto" : "Nuevo gasto";
  $("#add-submit").textContent = ed ? "Guardar cambios" : "Añadir gasto";
  $("#date").value = ed ? ed.fecha : hoyISO();
  $("#amount").value = ed ? String(ed.importe).replace(".", ",") : "";
  $("#note").value = ed ? ed.nota || "" : "";
  if (ed) elegirCategoria(ed.categoria);
  else {
    const ultima = safeStorage(() => localStorage.getItem("gastos-erasmus:ultima-cat"), null) || state.categoria;
    elegirCategoria(state.categorias.some((c) => c.clave === ultima) ? ultima : state.categorias[0]?.clave);
  }
  pistaViaje();
  $("#add-sheet").showModal();
  if (!ed) $("#amount").focus();
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
  const ed = state.gastoEdit;
  const btn = ev.submitter || $("#add-submit");
  btn.disabled = true;
  try {
    const nuevo = ed ? await state.store.update(ed.id, gasto) : await state.store.add(gasto);
    ponerGasto(nuevo);
    aplicarRango();
    pintar();
    $("#add-sheet").close();
    const v = viajeDe(nuevo);
    toast(ed ? "Gasto guardado" : `Apuntado: ${fmt(importe)} en ${catInfo(gasto.categoria).nombre}${v ? ` · ${v.nombre}` : ""}`);
  } catch (e) {
    console.error(e);
    toast("No se ha podido guardar");
  } finally {
    btn.disabled = false;
  }
}

function irAMes(year, month) {
  const d = new Date(year, month, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.verTodo = false;
  cargar();
}
const cambiarMes = (delta) => irAMes(state.year, state.month + delta);

/* ---------- Selector de mes ---------- */

function pintarSelector() {
  const hoy = new Date();
  $("#picker-year").textContent = state.pickerYear;
  const cont = $("#picker-months");
  cont.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = new Date(state.pickerYear, i, 1).toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
    b.setAttribute("aria-label", new Date(state.pickerYear, i, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
    b.setAttribute("aria-current", String(state.pickerYear === state.year && i === state.month));
    if (state.pickerYear === hoy.getFullYear() && i === hoy.getMonth()) b.classList.add("now");
    b.addEventListener("click", () => { $("#month-picker").close(); irAMes(state.pickerYear, i); });
    cont.appendChild(b);
  }
}

function abrirSelector() {
  state.pickerYear = state.year;
  pintarSelector();
  $("#month-picker").showModal();
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
  $("#sc-url-cats").value = `${cfg.supabaseUrl}/rest/v1/rpc/mis_categorias`;
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
  await cargarCategorias();
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
  $$("[data-add]").forEach((b) => b.addEventListener("click", () => abrirAñadir()));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrarMenu(); });
  window.addEventListener("scroll", () => cerrarMenu(), { passive: true });
  $$("[data-month]").forEach((b) => b.addEventListener("click", () => cambiarMes(Number(b.dataset.month))));
  $$("[data-picker]").forEach((b) => b.addEventListener("click", abrirSelector));
  $$("[data-year]").forEach((b) => b.addEventListener("click", () => { state.pickerYear += Number(b.dataset.year); pintarSelector(); }));
  $("#picker-today").addEventListener("click", () => {
    $("#month-picker").close();
    const hoy = new Date();
    irAMes(hoy.getFullYear(), hoy.getMonth());
  });
  $("#list-more").addEventListener("click", () => { state.verTodo = !state.verTodo; render(); });
  $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  // Tocar fuera de la hoja la cierra.
  $$("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  $("#add-form").addEventListener("submit", añadir);
  $("#date").addEventListener("change", pistaViaje);
  $("#trip-new").addEventListener("click", () => abrirViaje());
  prepararHojaCategoria();
  $("#cat-new").addEventListener("click", () => abrirCategoria());
  $("#cat-form").addEventListener("submit", guardarCategoria);
  $("#cat-delete").addEventListener("click", borrarCategoria);
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
    for (const id of ["#sc-url", "#sc-url-cats", "#sc-key", "#sc-token"]) {
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
        state.categorias = [];
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
