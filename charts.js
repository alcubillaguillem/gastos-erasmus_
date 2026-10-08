"use strict";

// Gráficos en SVG hechos a mano (sin librerías). Cada función pinta en un contenedor
// y usa el ancho real del contenedor; app.js los vuelve a pintar si cambia el tamaño.

const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const fmtEUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const fmt = (n) => fmtEUR.format(Number(n) || 0);
  const fmtCorto = (n) => (n >= 1000 ? `${(n / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} k€` : `${Math.round(n)} €`);

  function el(tag, attrs = {}, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }

  // Escala "bonita" para el eje Y: 0, paso, 2·paso… hasta cubrir el máximo.
  function niceScale(max, ticks = 4) {
    if (max <= 0) return { top: 10, step: 5 };
    const raw = max / ticks;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
    return { top: Math.ceil(max / step) * step, step };
  }

  // Barra con la parte superior redondeada (4px) y la base recta sobre el eje.
  function topRoundedBar(x, y, w, h, r = 4) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return "";
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  /* ---------- Tooltip compartido ---------- */
  let tipEl;
  function tip() {
    tipEl = tipEl || document.getElementById("tooltip");
    return tipEl;
  }
  function showTip(evt, html) {
    const t = tip();
    t.innerHTML = html;
    t.classList.add("show");
    const pad = 12;
    const r = t.getBoundingClientRect();
    let x = evt.clientX - r.width / 2;
    let y = evt.clientY - r.height - pad;
    x = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
    if (y < 8) y = evt.clientY + pad;
    t.style.transform = `translate(${x}px, ${y}px)`;
  }
  function hideTip() {
    tip()?.classList.remove("show");
  }
  document.addEventListener("scroll", hideTip, { passive: true });

  function bindTip(target, html) {
    target.addEventListener("pointerenter", (e) => showTip(e, html));
    target.addEventListener("pointermove", (e) => showTip(e, html));
    target.addEventListener("pointerleave", hideTip);
    target.addEventListener("click", (e) => showTip(e, html));
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- 1. Barras verticales por mes ---------- */
  // data: [{ key, label, value, selected }]
  function monthBars(container, data, { onSelect, average } = {}) {
    container.innerHTML = "";
    const W = Math.max(container.clientWidth, 260);
    const H = 200;
    const m = { top: 12, right: 8, bottom: 26, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;
    const max = Math.max(...data.map((d) => d.value), average || 0);
    const { top, step } = niceScale(max);
    const y = (v) => m.top + ih - (v / top) * ih;

    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": "Gasto por mes: " + data.map((d) => `${d.label} ${fmt(d.value)}`).join(", ") }, container);

    for (let v = 0; v <= top + 1e-9; v += step) {
      el("line", { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svg);
      el("text", { x: m.left - 6, y: y(v) + 4, "text-anchor": "end", class: "tick" }, svg).textContent = fmtCorto(v);
    }

    const slot = iw / data.length;
    const bw = Math.min(36, slot * 0.6);
    data.forEach((d, i) => {
      const cx = m.left + slot * i + slot / 2;
      const h = Math.max(0, y(0) - y(d.value));
      el("path", { d: topRoundedBar(cx - bw / 2, y(d.value), bw, h), class: d.selected ? "bar bar-sel" : "bar bar-dim" }, svg);
      el("text", { x: cx, y: H - 8, "text-anchor": "middle", class: d.selected ? "tick tick-sel" : "tick" }, svg).textContent = d.label;
      if (d.selected && d.value > 0) {
        el("text", { x: cx, y: y(d.value) - 5, "text-anchor": "middle", class: "val" }, svg).textContent = fmtCorto(d.value);
      }
      // Zona táctil más grande que la barra.
      const hit = el("rect", { x: cx - slot / 2, y: m.top, width: slot, height: ih + 4, class: "hit" }, svg);
      bindTip(hit, `<strong>${esc(d.fullLabel || d.label)}</strong><br>${fmt(d.value)}`);
      if (onSelect) hit.addEventListener("click", () => onSelect(d.key));
    });

    if (average > 0) {
      el("line", { x1: m.left, x2: W - m.right, y1: y(average), y2: y(average), class: "ref" }, svg);
      el("text", { x: W - m.right, y: y(average) - 4, "text-anchor": "end", class: "tick" }, svg).textContent = `media ${fmtCorto(average)}`;
    }
  }

  /* ---------- 2. Gasto acumulado del mes (línea + área) ---------- */
  // days: [{ day, value }] para cada día 1..n del mes; lastDay = último día con datos.
  function cumulative(container, days, { budget, lastDay, monthLabel } = {}) {
    container.innerHTML = "";
    const W = Math.max(container.clientWidth, 260);
    const H = 200;
    const m = { top: 14, right: 12, bottom: 26, left: 44 };
    const iw = W - m.left - m.right;
    const ih = H - m.top - m.bottom;
    const n = days.length;
    let acc = 0;
    const pts = days.map((d) => ({ day: d.day, value: d.value, cum: (acc += d.value) }));
    const shown = pts.slice(0, lastDay);
    const total = shown.length ? shown[shown.length - 1].cum : 0;
    const { top, step } = niceScale(Math.max(total, budget || 0));
    const x = (day) => m.left + ((day - 1) / Math.max(n - 1, 1)) * iw;
    const y = (v) => m.top + ih - (v / top) * ih;

    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": `Gasto acumulado en ${monthLabel}: ${fmt(total)}` }, container);

    for (let v = 0; v <= top + 1e-9; v += step) {
      el("line", { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), class: v === 0 ? "axis" : "grid" }, svg);
      el("text", { x: m.left - 6, y: y(v) + 4, "text-anchor": "end", class: "tick" }, svg).textContent = fmtCorto(v);
    }
    for (const dd of [1, 8, 15, 22, n]) {
      el("text", { x: x(dd), y: H - 8, "text-anchor": dd === 1 ? "start" : dd === n ? "end" : "middle", class: "tick" }, svg).textContent = dd;
    }

    if (budget > 0) {
      el("line", { x1: m.left, x2: W - m.right, y1: y(budget), y2: y(budget), class: "ref" }, svg);
      el("text", { x: m.left + 4, y: y(budget) - 4, class: "tick" }, svg).textContent = `presupuesto ${fmtCorto(budget)}`;
    }

    if (shown.length) {
      const line = shown.map((p, i) => `${i ? "L" : "M"}${x(p.day)},${y(p.cum)}`).join("");
      el("path", { d: `${line}L${x(shown[shown.length - 1].day)},${y(0)}L${x(1)},${y(0)}Z`, class: "area" }, svg);
      el("path", { d: line, class: "line" }, svg);
      const last = shown[shown.length - 1];
      el("circle", { cx: x(last.day), cy: y(last.cum), r: 4.5, class: "dot" }, svg);

      // Cruceta + tooltip: el día más cercano al dedo/ratón.
      const cross = el("line", { y1: m.top, y2: m.top + ih, class: "cross", visibility: "hidden" }, svg);
      const marker = el("circle", { r: 4.5, class: "dot", visibility: "hidden" }, svg);
      const hit = el("rect", { x: m.left, y: m.top, width: iw, height: ih, class: "hit" }, svg);
      const move = (e) => {
        const rect = svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const day = Math.min(lastDay, Math.max(1, Math.round(((px - m.left) / iw) * (n - 1)) + 1));
        const p = pts[day - 1];
        cross.setAttribute("x1", x(day)); cross.setAttribute("x2", x(day));
        cross.setAttribute("visibility", "visible");
        marker.setAttribute("cx", x(day)); marker.setAttribute("cy", y(p.cum));
        marker.setAttribute("visibility", "visible");
        showTip(e, `<strong>Día ${day}</strong><br>Ese día: ${fmt(p.value)}<br>Acumulado: ${fmt(p.cum)}`);
      };
      const leave = () => { cross.setAttribute("visibility", "hidden"); marker.setAttribute("visibility", "hidden"); hideTip(); };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", leave);
    } else {
      el("text", { x: m.left + iw / 2, y: m.top + ih / 2, "text-anchor": "middle", class: "tick" }, svg).textContent = "Sin gastos este mes";
    }
  }

  /* ---------- 3. Barras horizontales por categoría ---------- */
  // rows: [{ label, value }] ya ordenadas de mayor a menor.
  function categoryBars(container, rows) {
    container.innerHTML = "";
    if (!rows.length) {
      container.innerHTML = `<div class="empty">Aún no hay gastos este mes</div>`;
      return;
    }
    const total = rows.reduce((s, r) => s + r.value, 0);
    const W = Math.max(container.clientWidth, 260);
    const rowH = 30;
    const labelW = 112;
    const valueW = 92;
    const H = rows.length * rowH + 4;
    const iw = W - labelW - valueW;
    const max = rows[0].value;
    const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": "Gasto por categoría: " + rows.map((r) => `${r.label} ${fmt(r.value)}`).join(", ") }, container);
    el("line", { x1: labelW, x2: labelW, y1: 0, y2: H, class: "axis" }, svg);
    rows.forEach((r, i) => {
      const yy = i * rowH + 6;
      const bh = rowH - 12;
      const bw = Math.max(2, (r.value / max) * iw);
      el("text", { x: labelW - 8, y: yy + bh / 2 + 4, "text-anchor": "end", class: "cat-label" }, svg).textContent = r.label;
      // Barra con el extremo derecho redondeado (4px) y anclada al eje.
      const rr = Math.min(4, bw / 2, bh / 2);
      el("path", { d: `M${labelW},${yy}H${labelW + bw - rr}Q${labelW + bw},${yy} ${labelW + bw},${yy + rr}V${yy + bh - rr}Q${labelW + bw},${yy + bh} ${labelW + bw - rr},${yy + bh}H${labelW}Z`, class: "bar bar-sel" }, svg);
      const pct = total ? Math.round((r.value / total) * 100) : 0;
      el("text", { x: labelW + bw + 6, y: yy + bh / 2 + 4, class: "val" }, svg).textContent = `${fmt(r.value)} · ${pct}%`;
      const hit = el("rect", { x: 0, y: i * rowH, width: W, height: rowH, class: "hit" }, svg);
      bindTip(hit, `<strong>${esc(r.label)}</strong><br>${fmt(r.value)} (${pct}% del mes)`);
    });
  }

  return { monthBars, cumulative, categoryBars, hideTip };
})();
