"use strict";

// Si algo falla, que se vea en pantalla en vez de que el botón «no haga nada».
window.addEventListener("error", (e) => {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = `Error: ${e.message}. Cierra la app del todo y vuelve a abrirla.`;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 6000);
});

const CATEGORIAS = [
  { id: "comida", nombre: "Comida", emoji: "🍝" },
  { id: "tabaco", nombre: "Tabaco", emoji: "🚬" },
  { id: "alcohol", nombre: "Alcohol", emoji: "🍺" },
  { id: "ocio", nombre: "Ocio", emoji: "🎉" },
  { id: "viajes", nombre: "Viajes", emoji: "✈️" },
  { id: "transporte", nombre: "Transporte", emoji: "🚌" },
  { id: "casa", nombre: "Casa", emoji: "🏠" },
  { id: "compras", nombre: "Compras", emoji: "🛍️" },
  { id: "estudios", nombre: "Estudios", emoji: "📚" },
  { id: "otros", nombre: "Otros", emoji: "📦" },
];
const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]));
const catInfo = (id) => CAT[id] || CAT.otros;

const $ = (sel) => document.querySelector(sel);
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const fmt = (n) => euro.format(Number(n) || 0);

function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

/* ---------- Almacenes de datos ---------- */

class LocalStore {
  constructor() { this.key = "gastos-erasmus:gastos"; }
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

const state = {
  store: remote ? new SupabaseStore(sb) : new LocalStore(),
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  categoria: safeStorage(() => localStorage.getItem("gastos-erasmus:ultima-cat"), null) || "comida",
  gastos: [],   // gastos del mes seleccionado
  rango: [],    // gastos de los últimos 6 meses (para los gráficos)
  vista: safeStorage(() => localStorage.getItem("gastos-erasmus:vista"), null) || "gastos",
  presupuesto: 0,
  user: null,
};

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
    b.innerHTML = `<span class="emoji">${c.emoji}</span><span>${c.nombre}</span>`;
    b.addEventListener("click", () => {
      state.categoria = c.id;
      safeStorage(() => localStorage.setItem("gastos-erasmus:ultima-cat", c.id));
      grid.querySelectorAll(".cat").forEach((el) => el.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
    });
    grid.appendChild(b);
  }
}

function render() {
  const label = new Date(state.year, state.month, 1)
    .toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  $("#month-label").textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const total = state.gastos.reduce((s, g) => s + Number(g.importe), 0);
  const hoy = isoDate(new Date());
  const totalHoy = state.gastos.filter((g) => g.fecha === hoy).reduce((s, g) => s + Number(g.importe), 0);
  $("#month-total").textContent = fmt(total);
  $("#today-total").textContent = fmt(totalHoy);

  // Presupuesto
  const box = $("#budget-box");
  if (state.presupuesto > 0) {
    box.classList.remove("hidden");
    const pct = (total / state.presupuesto) * 100;
    const fill = $("#budget-fill");
    fill.style.width = `${Math.min(pct, 100)}%`;
    fill.classList.toggle("warn", pct >= 80 && pct < 100);
    fill.classList.toggle("over", pct >= 100);
    const resto = state.presupuesto - total;
    $("#budget-text").textContent = resto >= 0
      ? `Te quedan ${fmt(resto)} de ${fmt(state.presupuesto)} (${Math.round(pct)} %)`
      : `Te has pasado ${fmt(-resto)} del presupuesto de ${fmt(state.presupuesto)}`;
  } else {
    box.classList.add("hidden");
  }

  $("#mode-badge").textContent = remote
    ? ""
    : "Modo local: los gastos se guardan solo en este dispositivo.";

  // Desglose por categoría
  const porCat = {};
  for (const g of state.gastos) porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.importe);
  const filas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  const bd = $("#breakdown");
  bd.innerHTML = filas.length ? "" : `<div class="empty">Aún no hay gastos este mes</div>`;
  for (const [id, importe] of filas) {
    const c = catInfo(id);
    const pct = total ? (importe / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row-top"><span>${c.emoji} ${c.nombre} <span class="muted small">${Math.round(pct)} %</span></span>
      <span class="amt">${fmt(importe)}</span></div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>`;
    bd.appendChild(row);
  }

  // Lista agrupada por día
  const list = $("#list");
  list.innerHTML = state.gastos.length ? "" : `<div class="empty">Sin movimientos</div>`;
  const porDia = new Map();
  for (const g of state.gastos) {
    if (!porDia.has(g.fecha)) porDia.set(g.fecha, []);
    porDia.get(g.fecha).push(g);
  }
  const dias = [...porDia.keys()].sort().reverse();
  for (const dia of dias) {
    const items = porDia.get(dia).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const sumDia = items.reduce((s, g) => s + Number(g.importe), 0);
    const [y, m, d] = dia.split("-").map(Number);
    const head = document.createElement("div");
    head.className = "day";
    head.innerHTML = `<span>${new Date(y, m - 1, d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</span><span>${fmt(sumDia)}</span>`;
    list.appendChild(head);
    for (const g of items) {
      const c = catInfo(g.categoria);
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <span class="emoji">${c.emoji}</span>
        <div class="info"><div class="cat-name"></div><div class="note"></div></div>
        <span class="amt">${fmt(g.importe)}</span>
        <button class="del" aria-label="Borrar">✕</button>`;
      el.querySelector(".cat-name").textContent = c.nombre;
      el.querySelector(".note").textContent = g.nota || "";
      el.querySelector(".del").addEventListener("click", () => borrar(g));
      list.appendChild(el);
    }
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

/* ---------- Dashboard de gráficos ---------- */

function renderDashboard() {
  const { year, month } = state;
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === year && hoy.getMonth() === month;
  const esFuturo = new Date(year, month, 1) > hoy;
  const diasMes = new Date(year, month + 1, 0).getDate();
  const diasTranscurridos = esMesActual ? hoy.getDate() : esFuturo ? 0 : diasMes;
  const sum = (arr) => arr.reduce((s, g) => s + Number(g.importe), 0);
  const nombreMes = (y, m, opts) => new Date(y, m, 1).toLocaleDateString("es-ES", opts);

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
  const anteriores = meses.slice(0, -1).filter((m) => m.value > 0);
  const media = anteriores.length ? anteriores.reduce((s, m) => s + m.value, 0) / anteriores.length : 0;

  const total = sum(state.gastos);
  const anterior = meses[meses.length - 2];

  // KPIs
  $("#k-total").textContent = fmt(total);
  if (anterior.value > 0) {
    const pct = Math.round(((total - anterior.value) / anterior.value) * 100);
    $("#k-vs").textContent = `${pct > 0 ? "+" : ""}${pct} % vs ${anterior.fullLabel.split(" ")[0]}`;
  } else {
    $("#k-vs").textContent = "";
  }
  const mediaDia = diasTranscurridos ? total / diasTranscurridos : 0;
  $("#k-media").textContent = diasTranscurridos ? fmt(mediaDia) : "—";
  $("#k-dias").textContent = diasTranscurridos ? `${diasTranscurridos} de ${diasMes} días` : "";
  if (esMesActual) {
    const prevision = mediaDia * diasMes;
    $("#k-prev").textContent = fmt(prevision);
    $("#k-prev-sub").textContent = state.presupuesto > 0
      ? (prevision > state.presupuesto ? `${fmt(prevision - state.presupuesto)} por encima del presupuesto` : "dentro del presupuesto")
      : "a este ritmo";
  } else {
    $("#k-prev").textContent = esFuturo ? "—" : fmt(total);
    $("#k-prev-sub").textContent = esFuturo ? "" : "mes cerrado";
  }
  const porCat = {};
  for (const g of state.gastos) porCat[g.categoria] = (porCat[g.categoria] || 0) + Number(g.importe);
  const filas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (filas.length) {
    const c = catInfo(filas[0][0]);
    $("#k-top").textContent = `${c.emoji} ${c.nombre}`;
    $("#k-top-sub").textContent = `${fmt(filas[0][1])} · ${Math.round((filas[0][1] / total) * 100)} %`;
  } else {
    $("#k-top").textContent = "—";
    $("#k-top-sub").textContent = "";
  }

  // Gráficos
  Charts.monthBars($("#chart-meses"), meses, {
    average: media,
    onSelect: (key) => {
      const [y, m] = key.split("-").map(Number);
      if (y === state.year && m === state.month) return;
      Charts.hideTip();
      state.year = y;
      state.month = m;
      cargar();
    },
  });

  const dias = Array.from({ length: diasMes }, (_, i) => ({ day: i + 1, value: 0 }));
  for (const g of state.gastos) {
    const d = Number(g.fecha.slice(8, 10));
    if (dias[d - 1]) dias[d - 1].value += Number(g.importe);
  }
  $("#acum-sub").textContent = state.presupuesto > 0
    ? `Cómo vas respecto al presupuesto de ${fmt(state.presupuesto)}.`
    : "Ponle un presupuesto en ⚙︎ Ajustes para ver la línea de referencia.";
  Charts.cumulative($("#chart-acum"), dias, {
    budget: state.presupuesto,
    lastDay: diasTranscurridos,
    monthLabel: nombreMes(year, month, { month: "long" }),
  });

  Charts.categoryBars($("#chart-cats"), filas.map(([id, v]) => ({ label: `${catInfo(id).emoji} ${catInfo(id).nombre}`, value: v })));
}

function cambiarVista(vista) {
  state.vista = vista;
  safeStorage(() => localStorage.setItem("gastos-erasmus:vista", vista));
  $("#tab-gastos").setAttribute("aria-selected", String(vista === "gastos"));
  $("#tab-graficos").setAttribute("aria-selected", String(vista === "graficos"));
  $("#view-gastos").classList.toggle("hidden", vista !== "gastos");
  $("#view-graficos").classList.toggle("hidden", vista !== "graficos");
  Charts.hideTip();
  if (vista === "graficos") renderDashboard();
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
    aplicarRango();
    pintar();
    toast("Gasto borrado");
  } catch (e) {
    console.error(e);
    toast("No se ha podido borrar");
  }
}

async function añadir(ev) {
  ev.preventDefault();
  const importe = parseAmount($("#amount").value);
  if (!importe) { toast("Escribe un importe válido"); $("#amount").focus(); return; }
  const gasto = {
    importe,
    categoria: state.categoria,
    nota: $("#note").value.trim() || null,
    fecha: $("#date").value || isoDate(new Date()),
  };
  const btn = ev.submitter || $("#add-form button[type=submit]");
  btn.disabled = true;
  try {
    const nuevo = await state.store.add(gasto);
    const [from, to] = rangoActual();
    if (nuevo.fecha >= from && nuevo.fecha <= to) state.rango.unshift(nuevo);
    aplicarRango();
    pintar();
    $("#amount").value = "";
    $("#note").value = "";
    toast(`Apuntado: ${fmt(importe)} en ${catInfo(gasto.categoria).nombre}`);
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

/* ---------- Pantallas (principal, ajustes, atajos) ---------- */

const PANTALLAS = ["#login", "#app", "#settings-screen", "#shortcuts-screen"];
let scrollPrincipal = 0;

function mostrarPantalla(sel) {
  if (!$("#app").classList.contains("hidden")) scrollPrincipal = window.scrollY;
  for (const p of PANTALLAS) $(p).classList.toggle("hidden", p !== sel);
  Charts.hideTip();
  window.scrollTo(0, sel === "#app" ? scrollPrincipal : 0);
}

// Cada pantalla de ajustes es una entrada del historial: el botón «‹» y el gesto
// o botón de atrás del móvil vuelven a la pantalla anterior.
function pantallaDesdeHash() {
  if (!state.user && remote) return;
  if (location.hash === "#ajustes") mostrarPantalla("#settings-screen");
  else if (location.hash === "#atajos" && remote) mostrarPantalla("#shortcuts-screen");
  else mostrarPantalla("#app");
}

function abrirAjustes() {
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
  history.pushState({ p: "ajustes" }, "", "#ajustes");
  mostrarPantalla("#settings-screen");
}

async function abrirAtajos() {
  history.pushState({ p: "atajos" }, "", "#atajos");
  mostrarPantalla("#shortcuts-screen");
  $("#sc-url").value = `${cfg.supabaseUrl}/rest/v1/rpc/add_gasto`;
  $("#sc-key").value = cfg.supabaseAnonKey;
  $("#sc-token").value = "Cargando…";
  const { data, error } = await sb.rpc("mi_token_atajo");
  $("#sc-token").value = error ? "No se ha podido obtener el token" : data;
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
  mostrarPantalla("#app");
  state.presupuesto = await state.store.getBudget().catch(() => 0);
  await cargar();
  if (new URLSearchParams(location.search).has("nuevo")) $("#amount").focus();
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
  $("#date").value = isoDate(new Date());
  $("#add-form").addEventListener("submit", añadir);
  $("#prev-month").addEventListener("click", () => cambiarMes(-1));
  $("#next-month").addEventListener("click", () => cambiarMes(1));
  $("#open-settings").addEventListener("click", abrirAjustes);
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
    $("#logout-top").addEventListener("click", cerrarSesion);
    $("#regen-token").addEventListener("click", async () => {
      if (!confirm("El token anterior dejará de funcionar y tendrás que cambiarlo en el Atajo. ¿Seguir?")) return;
      const { data, error } = await sb.rpc("regenerar_token_atajo");
      if (error) toast("No se ha podido regenerar");
      else { $("#sc-token").value = data; toast("Token nuevo generado"); }
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
        mostrarLogin();
      }
      else if (prev !== state.user.id) mostrarApp();
    });
  } else {
    $("#logout-top").classList.add("hidden");
    mostrarApp();
  }

  $("#tab-gastos").addEventListener("click", () => cambiarVista("gastos"));
  $("#tab-graficos").addEventListener("click", () => cambiarVista("graficos"));
  cambiarVista(state.vista);
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.vista === "graficos") renderDashboard(); }, 150);
  });
  // Tocar fuera de un gráfico oculta el tooltip.
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest("svg")) Charts.hideTip(); });

  // Sin zoom con dos dedos ni con doble toque (iOS ignora user-scalable=no en algunos casos).
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }

  // Al volver a la app (p. ej. tras añadir un gasto con Siri), recargar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !$("#app").classList.contains("hidden")) cargar();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
