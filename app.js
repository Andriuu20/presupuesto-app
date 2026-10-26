(function () {
  "use strict";

  var KEY = "presupuesto-v1";
  var DEFAULT_CATS = [
    ["Vivienda", 1100], ["Comida", 450], ["Transporte", 180],
    ["Servicios", 220], ["Ocio", 250], ["Salud", 120]
  ];

  var eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var dayFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  var monthOnly = new Intl.DateTimeFormat("es-ES", { month: "long" });
  var monthShort = new Intl.DateTimeFormat("es-ES", { month: "short" });

  /* ---------- storage ----------
     data.meses["YYYY-MM"] = { ingresos, cerrado, cats }
     `cats` is the frozen copy of the categories and limits, taken when the month is first closed. */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.categorias) && Array.isArray(d.gastos)) { d.meses = d.meses || {}; return d; }
    } catch (e) {}
    return {
      categorias: DEFAULT_CATS.map(function (c) { return { id: uid(), nombre: c[0], limite: c[1] }; }),
      gastos: [], meses: {}, tema: "business"
    };
  }
  var data = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { setMsg("No se pudo guardar en este dispositivo. Exporta una copia de seguridad."); }
  }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "on") for (var ev in attrs.on) n.addEventListener(ev, attrs.on[ev]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function num(v) {
    var s = String(v).trim().replace(/\s|€/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    var x = parseFloat(s);
    return isFinite(x) ? Math.round(x * 100) / 100 : NaN;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(v) { return (v < 0 ? "−" : "") + eur.format(Math.abs(v)); }
  function signed(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + eur.format(Math.abs(v)); }
  function showError(id, msg) { $(id).textContent = msg || ""; $(id).hidden = !msg; }
  function setMsg(msg) { $("settings-msg").textContent = msg; }

  function toDate(mes) { var p = mes.split("-"); return new Date(+p[0], +p[1] - 1, 1); }
  function addMonths(mes, delta) { var d = toDate(mes); d.setMonth(d.getMonth() + delta); return d.getFullYear() + "-" + pad(d.getMonth() + 1); }
  function monthName(mes) { var d = toDate(mes); return cap(monthOnly.format(d)) + " " + d.getFullYear(); }
  function monthWord(mes) { return monthOnly.format(toDate(mes)); }
  function lastDay(mes) { var d = toDate(mes); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }

  /* ---------- month model ---------- */
  var today = new Date();
  var currentMes = today.getFullYear() + "-" + pad(today.getMonth() + 1);

  function info(mes) { return data.meses[mes] || {}; }
  function isClosed(mes) { return !!info(mes).cerrado; }
  function hasSnapshot(mes) { return Array.isArray(info(mes).cats); }
  function catsFor(mes) { return hasSnapshot(mes) ? info(mes).cats : data.categorias; }
  function gastosFor(mes) { return data.gastos.filter(function (g) { return (g.fecha || "").slice(0, 7) === mes; }); }
  function stats(mes) {
    var gs = gastosFor(mes), por = {};
    var total = gs.reduce(function (s, g) { por[g.categoria] = (por[g.categoria] || 0) + g.importe; return s + g.importe; }, 0);
    var inc = info(mes).ingresos || 0;
    return { ingresos: inc, gastos: total, ahorro: inc - total, porCat: por, count: gs.length, hasData: inc > 0 || gs.length > 0 };
  }
  function catName(id, mes) {
    var lists = [catsFor(mes), data.categorias];
    for (var i = 0; i < lists.length; i++) for (var j = 0; j < lists[i].length; j++) if (lists[i][j].id === id) return lists[i][j].nombre;
    return "Sin categoría";
  }
  function setInfo(mes, patch) { data.meses[mes] = Object.assign({}, info(mes), patch); }

  /* ---------- view state ---------- */
  var view = { screen: "index", year: today.getFullYear(), mes: currentMes, editingCats: false, editing: null, confirm: null };

  function openMonth(mes) {
    view.mes = mes; view.screen = "month";
    view.editingCats = false; view.editing = null; view.confirm = null;
    var d = ymd(new Date());
    $("exp-date").min = mes + "-01";
    $("exp-date").max = mes + "-" + pad(lastDay(mes));
    $("exp-date").value = d.slice(0, 7) === mes ? d : mes + "-01";
    showError("exp-error"); showError("cat-error");
    render(); window.scrollTo(0, 0);
  }
  function openIndex() {
    view.screen = "index"; view.year = toDate(view.mes).getFullYear();
    render(); window.scrollTo(0, 0);
  }

  function render() {
    $("screen-index").hidden = view.screen !== "index";
    $("screen-month").hidden = view.screen !== "month";
    if (view.screen === "index") renderIndex(); else renderMonth();
  }

  /* ---------- index ---------- */
  function renderIndex() {
    $("year").textContent = String(view.year);
    var box = $("months"); box.textContent = "";
    var yearSaving = 0;
    for (var m = 1; m <= 12; m++) {
      var mes = view.year + "-" + pad(m), s = stats(mes), closed = isClosed(mes);
      if (s.hasData) yearSaving += s.ahorro;
      var state = closed ? "Guardado" : mes === currentMes ? "En curso" : s.hasData ? "Abierto" : "—";
      var cls = "tile" + (closed ? " closed" : "") + (mes === currentMes ? " current" : "") + (!s.hasData && !closed ? " empty" : "");
      box.appendChild(el("button", {
        type: "button", class: cls,
        "aria-label": monthName(mes) + ". " + state + (s.hasData ? ". Ahorro " + money(s.ahorro) : ""),
        on: { click: (function (x) { return function () { openMonth(x); }; })(mes) }
      }, [
        el("span", { class: "tile-name", text: cap(monthShort.format(toDate(mes)).replace(".", "")) }),
        el("span", { class: "tile-state" }, [closed ? lockIcon() : null, state]),
        el("span", { class: "tile-saving" + (s.ahorro < 0 ? " neg" : ""), text: s.hasData ? signed(s.ahorro) : "" })
      ]));
    }
    var ys = $("year-saving");
    ys.textContent = signed(yearSaving);
    ys.className = yearSaving < 0 ? "neg" : "";
  }

  function lockIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16"); svg.setAttribute("class", "lock"); svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<rect x="3" y="7" width="10" height="8" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/>';
    return svg;
  }

  /* ---------- month ---------- */
  function renderMonth() {
    var mes = view.mes, closed = isClosed(mes), s = stats(mes);
    $("month").textContent = monthName(mes);
    $("month-state").textContent = closed ? "Guardado" : mes === currentMes ? "En curso" : "Abierto";

    var incInput = $("income");
    $("income-edit").hidden = closed;
    $("income-read").hidden = !closed;
    $("income-read").textContent = eur.format(s.ingresos);
    if (closed) $("income-label").removeAttribute("for"); else $("income-label").setAttribute("for", "income");
    if (document.activeElement !== incInput) incInput.value = s.ingresos ? String(s.ingresos).replace(".", ",") : "";
    $("exp").textContent = eur.format(s.gastos);
    $("sav").textContent = money(s.ahorro);
    $("sav-box").classList.toggle("neg", s.ahorro < 0);

    $("add-card").hidden = closed;
    $("toggle-cats").hidden = closed || hasSnapshot(mes);
    if (closed || hasSnapshot(mes)) view.editingCats = false;

    renderCats(s);
    renderSelect();
    renderList();
    renderCompare(s);
    renderClose();
  }

  function renderCats(s) {
    var mes = view.mes, cats = catsFor(mes);
    var rows = $("rows"); rows.textContent = "";
    var max = Math.max.apply(null, [1].concat(cats.map(function (c) { return Math.max(c.limite, s.porCat[c.id] || 0); })));
    if (!cats.length) rows.appendChild(el("p", { class: "empty", text: "No hay categorías. Pulsa «Editar categorías» para crear la primera." }));

    cats.forEach(function (c) {
      if (view.editing === c.id) { rows.appendChild(editRow(c)); return; }
      var spent = s.porCat[c.id] || 0, over = spent > c.limite;
      var row = el("div", { class: "row" + (over ? " over" : "") + (view.editingCats ? " has-actions" : "") }, [
        el("span", { class: "name" }, [c.nombre, over ? el("span", { class: "flag", text: "−" + eur.format(spent - c.limite) + " sobre el límite" }) : null]),
        el("div", { class: "bar-track", role: "img", "aria-label": c.nombre + ": " + eur.format(spent) + " de " + eur.format(c.limite) }, [
          el("i", { style: "width:" + (spent / max * 100).toFixed(1) + "%" }),
          el("span", { class: "limit", style: "left:calc(" + (c.limite / max * 100).toFixed(1) + "% - 1px)" })
        ]),
        el("span", { class: "amt" }, [el("b", { text: eur.format(spent) }), " / " + eur.format(c.limite)])
      ]);
      if (view.editingCats) {
        var actions = el("div", { class: "actions" });
        if (view.confirm === "cat:" + c.id) {
          var n = data.gastos.filter(function (g) { return g.categoria === c.id && !hasSnapshot(g.fecha.slice(0, 7)); }).length;
          actions.appendChild(el("button", { type: "button", class: "link danger", text: n ? "Borrar con sus " + n + " gastos" : "Sí, borrar", on: { click: function () { deleteCat(c.id); } } }));
          actions.appendChild(el("button", { type: "button", class: "link", text: "Cancelar", on: { click: function () { view.confirm = null; render(); } } }));
        } else {
          actions.appendChild(el("button", { type: "button", class: "link", text: "Editar", "aria-label": "Editar " + c.nombre, on: { click: function () { view.editing = c.id; view.confirm = null; render(); } } }));
          actions.appendChild(el("button", { type: "button", class: "link danger", text: "Borrar", "aria-label": "Borrar " + c.nombre, on: { click: function () { view.confirm = "cat:" + c.id; render(); } } }));
        }
        row.appendChild(actions);
      }
      rows.appendChild(row);
    });
    $("cat-form").hidden = !view.editingCats;
    $("toggle-cats").textContent = view.editingCats ? "Listo" : "Editar categorías";
  }

  function editRow(c) {
    var name = el("input", { id: "edit-name", maxlength: "40", value: c.nombre, "aria-label": "Nombre de la categoría", autocomplete: "off" });
    var lim = el("input", { id: "edit-limit", type: "text", inputmode: "decimal", value: String(c.limite).replace(".", ","), "aria-label": "Límite en euros", autocomplete: "off" });
    function done() { view.editing = null; render(); }
    function saveEdit() {
      var n = name.value.trim(), l = num(lim.value);
      if (!n || !(l >= 0)) { (n ? lim : name).focus(); return; }
      c.nombre = n; c.limite = l; save(); done();
    }
    [name, lim].forEach(function (i) {
      i.addEventListener("keydown", function (e) { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") done(); });
    });
    setTimeout(function () { name.focus(); }, 0);
    return el("div", { class: "row editing" }, [name, lim, el("div", { class: "actions" }, [
      el("button", { type: "button", class: "link", text: "Guardar", on: { click: saveEdit } }),
      el("button", { type: "button", class: "link", text: "Cancelar", on: { click: done } })
    ])]);
  }

  function renderSelect() {
    var sel = $("exp-cat"), prev = sel.value, cats = catsFor(view.mes);
    sel.textContent = "";
    cats.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.nombre })); });
    if (prev && cats.some(function (c) { return c.id === prev; })) sel.value = prev;
    $("exp-form").querySelector("button").disabled = !cats.length;
  }

  function renderList() {
    var mes = view.mes, closed = isClosed(mes);
    var list = $("list"); list.textContent = "";
    var items = gastosFor(mes).sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || b.creado - a.creado; });
    $("count").textContent = items.length ? items.length + (items.length === 1 ? " gasto" : " gastos") : "";
    if (!items.length) list.appendChild(el("li", { class: "empty", text: closed ? "Este mes no tuvo gastos." : "Todavía no hay gastos este mes." }));
    items.forEach(function (g) {
      var actions = el("div", { class: "actions" });
      if (!closed) {
        if (view.confirm === "g:" + g.id) {
          actions.appendChild(el("button", { type: "button", class: "link danger", text: "Sí, borrar", on: { click: function () { deleteGasto(g.id); } } }));
          actions.appendChild(el("button", { type: "button", class: "link", text: "No", on: { click: function () { view.confirm = null; render(); } } }));
        } else {
          actions.appendChild(el("button", { type: "button", class: "link danger", text: "Borrar", "aria-label": "Borrar " + g.concepto, on: { click: function () { view.confirm = "g:" + g.id; render(); } } }));
        }
      }
      list.appendChild(el("li", { class: "item" + (closed ? " readonly" : "") }, [
        el("span", { class: "date", text: dayFmt.format(new Date(g.fecha + "T12:00:00")) }),
        el("span", { class: "what" }, [g.concepto, el("small", { text: catName(g.categoria, mes) })]),
        el("span", { class: "money", text: eur.format(g.importe) }),
        actions
      ]));
    });
  }

  /* ---------- comparison with the previous month ---------- */
  function renderCompare(s) {
    var mes = view.mes, prev = addMonths(mes, -1), p = stats(prev);
    $("compare-title").textContent = "Comparado con " + monthWord(prev);
    var body = $("compare-body"); body.textContent = "";
    if (!p.hasData) { body.appendChild(el("p", { class: "empty", text: "No hay datos de " + monthWord(prev) + " para comparar." })); return; }
    if (!s.hasData) { body.appendChild(el("p", { class: "empty", text: "Cuando añadas ingresos o gastos, aquí verás la comparación con " + monthWord(prev) + "." })); return; }

    // Headline.
    var d = s.ahorro - p.ahorro, pw = monthWord(prev), head;
    if (s.ahorro < 0) head = "Este mes gastaste " + eur.format(-s.ahorro) + " más de lo que ingresaste.";
    else if (d > 0) head = "Ahorraste " + eur.format(d) + " más que en " + pw + ".";
    else if (d < 0) head = "Ahorraste " + eur.format(-d) + " menos que en " + pw + ".";
    else head = "Ahorraste lo mismo que en " + pw + ".";
    body.appendChild(el("p", { class: "compare-head" + (d < 0 || s.ahorro < 0 ? " bad" : " good"), text: head }));

    // Totals.
    var table = el("div", { class: "cmp-table", role: "table", "aria-label": "Totales comparados" }, [
      el("div", { class: "cmp-row cmp-headrow", role: "row" }, [
        el("span", { role: "columnheader", text: "" }),
        el("span", { role: "columnheader", text: cap(monthShort.format(toDate(prev)).replace(".", "")) }),
        el("span", { role: "columnheader", text: cap(monthShort.format(toDate(mes)).replace(".", "")) }),
        el("span", { role: "columnheader", text: "Diferencia" })
      ])
    ]);
    [["Ingresos", p.ingresos, s.ingresos, 1], ["Gastos", p.gastos, s.gastos, -1], ["Ahorro", p.ahorro, s.ahorro, 1]].forEach(function (r) {
      var diff = r[2] - r[1], tone = diff === 0 ? "" : (diff * r[3] > 0 ? " good" : " bad");
      table.appendChild(el("div", { class: "cmp-row", role: "row" }, [
        el("span", { role: "cell", class: "cmp-label", text: r[0] }),
        el("span", { role: "cell", text: money(r[1]) }),
        el("span", { role: "cell", text: money(r[2]) }),
        el("span", { role: "cell", class: "cmp-diff" + tone, text: diff === 0 ? "=" : signed(diff) })
      ]));
    });
    body.appendChild(table);

    // Per category, biggest increase first.
    var ids = {};
    Object.keys(p.porCat).concat(Object.keys(s.porCat)).forEach(function (id) { ids[id] = true; });
    var cats = Object.keys(ids).map(function (id) {
      var a = p.porCat[id] || 0, b = s.porCat[id] || 0;
      return { name: catName(id, mes), a: a, b: b, diff: b - a };
    }).sort(function (x, y) { return y.diff - x.diff; });

    var up = cats.filter(function (c) { return c.diff > 0; })[0];
    var down = cats.slice().reverse().filter(function (c) { return c.diff < 0; })[0];
    var notes = el("ul", { class: "cmp-notes" });
    if (up) notes.appendChild(el("li", { class: "bad" }, [el("b", { text: "Donde más subió el gasto: " }), up.name + ", " + signed(up.diff) + " (de " + eur.format(up.a) + " a " + eur.format(up.b) + ")."]));
    if (down) notes.appendChild(el("li", { class: "good" }, [el("b", { text: "Donde más bajó: " }), down.name + ", " + signed(down.diff) + " (de " + eur.format(down.a) + " a " + eur.format(down.b) + ")."]));
    if (!up && !down) notes.appendChild(el("li", { text: "El gasto por categoría fue igual que en " + pw + "." }));
    body.appendChild(notes);

    if (cats.length) {
      body.appendChild(el("h3", { text: "Por categoría" }));
      var ct = el("div", { class: "cmp-table", role: "table", "aria-label": "Gasto por categoría comparado" });
      cats.forEach(function (c) {
        var tone = c.diff > 0 ? " bad" : c.diff < 0 ? " good" : "";
        ct.appendChild(el("div", { class: "cmp-row", role: "row" }, [
          el("span", { role: "cell", class: "cmp-label", text: c.name }),
          el("span", { role: "cell", text: eur.format(c.a) }),
          el("span", { role: "cell", text: eur.format(c.b) }),
          el("span", { role: "cell", class: "cmp-diff" + tone, text: c.diff === 0 ? "=" : signed(c.diff) })
        ]));
      });
      body.appendChild(ct);
    }
  }

  /* ---------- close / reopen ---------- */
  function renderClose() {
    var mes = view.mes, zone = $("close-zone"); zone.textContent = "";
    if (isClosed(mes)) {
      zone.appendChild(el("p", { class: "note center", text: "Este mes está guardado: solo se puede consultar." }));
      zone.appendChild(el("button", { type: "button", class: "link", text: "Reabrir para editar", on: { click: function () {
        setInfo(mes, { cerrado: false }); save(); render();
      } } }));
      return;
    }
    if (view.confirm === "close") {
      zone.appendChild(el("p", { class: "close-ask", text: "¿Guardar y cerrar " + monthWord(mes) + "? Quedará solo para consultar, con los límites de hoy." }));
      zone.appendChild(el("div", { class: "close-actions" }, [
        el("button", { type: "button", class: "btn btn-close", text: "Sí, guardar y cerrar", on: { click: closeMonth } }),
        el("button", { type: "button", class: "link", text: "Cancelar", on: { click: function () { view.confirm = null; render(); } } })
      ]));
      return;
    }
    zone.appendChild(el("button", { type: "button", class: "btn btn-close wide" }, [lockIcon(), " Guardar y cerrar mes"]));
    zone.lastChild.addEventListener("click", function () { view.confirm = "close"; render(); });
  }

  function closeMonth() {
    var mes = view.mes;
    var patch = { cerrado: true };
    // Freeze categories and limits the first time the month is closed.
    if (!hasSnapshot(mes)) patch.cats = data.categorias.map(function (c) { return { id: c.id, nombre: c.nombre, limite: c.limite }; });
    setInfo(mes, patch);
    view.confirm = null; view.editingCats = false; view.editing = null;
    save(); render(); window.scrollTo(0, 0);
  }

  /* ---------- edits ---------- */
  function deleteCat(id) {
    data.categorias = data.categorias.filter(function (c) { return c.id !== id; });
    // Saved months keep their expenses; only months without a frozen copy lose them.
    data.gastos = data.gastos.filter(function (g) { return g.categoria !== id || hasSnapshot(g.fecha.slice(0, 7)); });
    view.confirm = null; save(); render();
  }
  function deleteGasto(id) {
    data.gastos = data.gastos.filter(function (g) { return g.id !== id; });
    view.confirm = null; save(); render();
  }

  $("year-prev").addEventListener("click", function () { view.year--; render(); });
  $("year-next").addEventListener("click", function () { view.year++; render(); });
  $("back").addEventListener("click", openIndex);
  $("toggle-cats").addEventListener("click", function () {
    view.editingCats = !view.editingCats; view.editing = null; view.confirm = null; render();
  });

  $("income").addEventListener("change", function () {
    if (isClosed(view.mes)) return;
    var v = this.value.trim() === "" ? 0 : num(this.value);
    if (!(v >= 0)) { render(); return; }
    setInfo(view.mes, { ingresos: v }); save(); render();
  });

  $("exp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (isClosed(view.mes)) return;
    var what = $("exp-what").value.trim(), amount = num($("exp-amount").value), cat = $("exp-cat").value, date = $("exp-date").value;
    if (!what) return showError("exp-error", "Escribe en qué gastaste.");
    if (!(amount > 0)) return showError("exp-error", "Escribe un importe mayor que 0.");
    if (!cat) return showError("exp-error", "Elige una categoría.");
    if (!date || date.slice(0, 7) !== view.mes) return showError("exp-error", "Elige una fecha de " + monthWord(view.mes) + ".");
    showError("exp-error");
    data.gastos.push({ id: uid(), concepto: what, importe: amount, categoria: cat, fecha: date, creado: Date.now() });
    save();
    $("exp-what").value = ""; $("exp-amount").value = "";
    render();
  });

  $("cat-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var n = $("cat-name").value.trim(), l = num($("cat-limit").value);
    if (!n) return showError("cat-error", "Escribe un nombre para la categoría.");
    if (!(l >= 0)) return showError("cat-error", "Escribe un límite en euros (puede ser 0).");
    showError("cat-error");
    var c = { id: uid(), nombre: n, limite: l };
    data.categorias.push(c); save();
    $("cat-name").value = ""; $("cat-limit").value = "";
    render(); $("exp-cat").value = c.id;
  });

  /* ---------- receipt scan ----------
     The OCR engine (Tesseract.js) and its Spanish data live in vendor/ocr and load on the first scan.
     The photo is only used to read the text; it is never stored. */
  var ocr = { worker: null, loading: null, job: 0 };

  function loadScript(src) {
    return new Promise(function (ok, ko) {
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s);
    });
  }
  function getWorker(onProgress) {
    if (ocr.worker) return Promise.resolve(ocr.worker);
    if (!ocr.loading) {
      var base = new URL("vendor/ocr/", location.href).href;
      ocr.loading = (window.Tesseract ? Promise.resolve() : loadScript(base + "tesseract.min.js")).then(function () {
        return window.Tesseract.createWorker("spa", 1, {
          workerPath: base + "worker.min.js", corePath: base, langPath: base + "lang", gzip: true,
          logger: function (m) { if (ocr.onProgress) ocr.onProgress(m); }
        });
      }).then(function (w) { ocr.worker = w; return w; }, function (e) { ocr.loading = null; throw e; });
    }
    ocr.onProgress = onProgress;
    return ocr.loading;
  }

  // Shrink, grey and add contrast: faster and more accurate on phone photos.
  function prepareImage(file) {
    return new Promise(function (ok, ko) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        var px = ctx.getImageData(0, 0, c.width, c.height), d = px.data, sum = 0;
        for (var i = 0; i < d.length; i += 4) {
          var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = g; sum += g;
        }
        // Dark-mode screenshots (light text on dark) read far better inverted.
        var invert = sum / (d.length / 4) < 110;
        for (var k = 0; k < d.length; k += 4) {
          var v = invert ? 255 - d[k] : d[k];
          v = Math.max(0, Math.min(255, (v - 128) * 1.4 + 128));
          d[k] = d[k + 1] = d[k + 2] = v;
        }
        ctx.putImageData(px, 0, 0);
        ok({ canvas: c, url: url });
      };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error("imagen")); };
      img.src = url;
    });
  }

  var scan = { url: null, pista: null };
  function openSheet() {
    $("scan-sheet").hidden = false; $("scan-progress").hidden = false; $("scan-form").hidden = true;
    $("scan-bar").style.width = "0"; $("scan-status").textContent = "Preparando el lector…";
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    ocr.job++; // ignore any result still on its way
    $("scan-sheet").hidden = true; document.body.style.overflow = "";
    if (scan.url) { URL.revokeObjectURL(scan.url); scan.url = null; }
    $("scan-thumb").removeAttribute("src");
  }
  function progress(m) {
    var pct = 0, label = "Preparando el lector…";
    if (m.status === "recognizing text") { pct = 30 + m.progress * 70; label = "Leyendo el ticket… " + Math.round(pct) + " %"; }
    else if (/load|initializ/.test(m.status || "")) { pct = 5 + (m.progress || 0) * 25; label = "Preparando el lector (solo la primera vez)…"; }
    $("scan-bar").style.width = pct.toFixed(0) + "%"; $("scan-status").textContent = label;
  }

  function onScanFile() {
    var file = this.files && this.files[0]; this.value = "";
    if (!file || isClosed(view.mes)) return;
    var job = ++ocr.job;
    openSheet();
    prepareImage(file).then(function (prep) {
      if (job !== ocr.job) { URL.revokeObjectURL(prep.url); return; }
      scan.url = prep.url; $("scan-thumb").src = prep.url;
      return getWorker(progress).then(function (w) { return w.recognize(prep.canvas); }).then(function (res) {
        if (job !== ocr.job) return;
        showScanResult(window.ReceiptParse.parse(res.data.text));
      });
    }).catch(function () {
      if (job !== ocr.job) return;
      $("scan-status").textContent = "No he podido leer la foto. Prueba con otra con más luz, o apúntalo a mano.";
      $("scan-bar").style.width = "0";
    });
  }
  $("scan-camera").addEventListener("change", onScanFile);
  $("scan-file").addEventListener("change", onScanFile);

  function showScanResult(r) {
    var mes = view.mes, cats = catsFor(mes);
    $("scan-progress").hidden = true; $("scan-form").hidden = false;
    showError("scan-error");
    scan.pista = r.pista;

    $("scan-what").value = r.comercio || "";
    $("scan-amount").value = r.total ? String(r.total.toFixed(2)).replace(".", ",") : "";
    $("scan-amount").parentNode.classList.toggle("ask", !r.total);
    $("scan-amount-label").textContent = r.total ? "Total (€)" : "Total (€) · no lo he encontrado, escríbelo tú";

    var date = $("scan-date"), hint = [];
    date.min = mes + "-01"; date.max = mes + "-" + pad(lastDay(mes));
    if (r.fecha && r.fecha.slice(0, 7) === mes) date.value = r.fecha;
    else {
      date.value = $("exp-date").value;
      if (r.fecha) hint.push("El ticket es del " + r.fecha.split("-").reverse().join("/") + ", pero estás en " + monthWord(mes) + ": he puesto una fecha de " + monthWord(mes) + ".");
    }

    var sel = $("scan-cat"); sel.textContent = "";
    sel.appendChild(el("option", { value: "", text: "Elige una categoría…" }));
    cats.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.nombre })); });
    var guess = window.ReceiptParse.guessCategory(r.comercio, r.pista, cats, data.comercios || {});
    sel.value = guess || "";
    updateCatQuestion();

    if (!r.comercio) hint.push("No he reconocido el comercio: escribe su nombre.");
    $("scan-hint").textContent = hint.join(" ");
    $("scan-hint").hidden = !hint.length;
    (r.total ? (guess ? $("scan-what") : sel) : $("scan-amount")).focus({ preventScroll: true });
  }

  function updateCatQuestion() {
    var unknown = !$("scan-cat").value, name = $("scan-what").value.trim();
    $("scan-cat").parentNode.classList.toggle("ask", unknown);
    $("scan-cat-label").textContent = unknown ? "¿En qué categoría va" + (name ? " «" + name + "»" : " este gasto") + "?" : "Categoría";
  }
  $("scan-cat").addEventListener("change", updateCatQuestion);
  $("scan-what").addEventListener("input", function () {
    var cats = catsFor(view.mes), sel = $("scan-cat");
    var learned = window.ReceiptParse.guessCategory(this.value, null, cats, data.comercios || {});
    if (learned) sel.value = learned;
    updateCatQuestion();
  });
  $("scan-cancel").addEventListener("click", closeSheet);
  $("scan-close").addEventListener("click", closeSheet);

  $("scan-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var what = $("scan-what").value.trim(), amount = num($("scan-amount").value), cat = $("scan-cat").value, date = $("scan-date").value;
    if (!what) return showError("scan-error", "Escribe el nombre del comercio.");
    if (!(amount > 0)) return showError("scan-error", "Escribe el total del ticket.");
    if (!cat) return showError("scan-error", "Elige una categoría.");
    if (!date || date.slice(0, 7) !== view.mes) return showError("scan-error", "Elige una fecha de " + monthWord(view.mes) + ".");
    data.gastos.push({ id: uid(), concepto: what, importe: amount, categoria: cat, fecha: date, creado: Date.now() });
    // Remember this shop's category for next time.
    data.comercios = data.comercios || {};
    data.comercios[window.ReceiptParse.norm(what)] = cat;
    save(); closeSheet(); render();
  });

  /* ---------- theme ---------- */
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    document.querySelectorAll(".switch button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === t)); });
    var color = getComputedStyle(document.documentElement).getPropertyValue("--bar").trim();
    document.querySelector('meta[name="theme-color"]').setAttribute("content", color || "#0b1f3a");
  }
  document.querySelectorAll(".switch button").forEach(function (b) {
    b.addEventListener("click", function () { data.tema = b.dataset.t; save(); setTheme(b.dataset.t); });
  });

  /* ---------- backup ---------- */
  $("export").addEventListener("click", function () {
    var name = "presupuesto-" + ymd(new Date()) + ".json";
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var file = typeof File === "function" ? new File([blob], name, { type: "application/json" }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Copia de seguridad del presupuesto" })
        .then(function () { setMsg("Copia exportada."); })
        .catch(function (err) { if (err && err.name !== "AbortError") setMsg("No se pudo exportar la copia."); });
      return;
    }
    var a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setMsg("Copia exportada como " + name + ".");
  });

  $("import-file").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = "";
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || !Array.isArray(d.categorias) || !Array.isArray(d.gastos)) throw new Error("formato");
        if (!confirm("Esto sustituye todos los datos de este dispositivo por los de la copia. ¿Continuar?")) return;
        d.meses = d.meses || {}; data = d; save();
        setTheme(data.tema || "business"); render();
        setMsg("Copia importada: " + data.categorias.length + " categorías y " + data.gastos.length + " gastos.");
      } catch (e) { setMsg("Ese archivo no es una copia de seguridad válida de esta app."); }
    };
    reader.readAsText(f);
  });

  /* ---------- start ---------- */
  setTheme(data.tema || "business");
  render();
  save();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
