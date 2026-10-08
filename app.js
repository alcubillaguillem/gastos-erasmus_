"use strict";

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
  gastos: [],
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

async function cargar() {
  const [from, to] = monthRange(state.year, state.month);
  try {
    state.gastos = await state.store.listMonth(from, to);
  } catch (e) {
    console.error(e);
    toast("No se han podido cargar los gastos");
  }
  render();
}

async function borrar(g) {
  if (!confirm(`¿Borrar ${fmt(g.importe)} de ${catInfo(g.categoria).nombre}?`)) return;
  try {
    await state.store.remove(g.id);
    state.gastos = state.gastos.filter((x) => x.id !== g.id);
    render();
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
    const [from, to] = monthRange(state.year, state.month);
    if (nuevo.fecha >= from && nuevo.fecha <= to) state.gastos.unshift(nuevo);
    render();
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

async function abrirAjustes() {
  $("#budget-input").value = state.presupuesto ? String(state.presupuesto).replace(".", ",") : "";
  if (remote) {
    $("#shortcut-box").classList.remove("hidden");
    $("#account-box").classList.remove("hidden");
    $("#account-email").textContent = `Conectado como ${state.user?.email || ""}`;
    $("#sc-url").value = cfg.supabaseUrl;
    $("#sc-key").value = cfg.supabaseAnonKey;
    const { data, error } = await sb.rpc("mi_token_atajo");
    $("#sc-token").value = error ? "Error: ¿has ejecutado schema.sql?" : data;
  }
  $("#settings").showModal();
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
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  state.presupuesto = await state.store.getBudget().catch(() => 0);
  await cargar();
  if (new URLSearchParams(location.search).has("nuevo")) $("#amount").focus();
}

function mostrarLogin() {
  $("#app").classList.add("hidden");
  $("#login").classList.remove("hidden");
}

/* ---------- Arranque ---------- */

function init() {
  renderCategoryPicker();
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
  $("#export-csv").addEventListener("click", exportarCSV);
  $("#save-budget").addEventListener("click", async () => {
    const v = $("#budget-input").value.trim() === "" ? 0 : parseAmount($("#budget-input").value);
    if (v === null) { toast("Presupuesto no válido"); return; }
    try {
      await state.store.setBudget(v);
      state.presupuesto = v;
      render();
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
    $("#logout").addEventListener("click", async () => {
      await sb.auth.signOut();
      $("#settings").close();
    });
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
        mostrarLogin();
      }
      else if (prev !== state.user.id) mostrarApp();
    });
  } else {
    mostrarApp();
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
