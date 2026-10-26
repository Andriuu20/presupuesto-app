(function () {
  "use strict";

  var KEY = "presupuesto-v1";
  var DEFAULT_CATS = [
    ["Vivienda", 1100], ["Comida", 450], ["Transporte", 180],
    ["Servicios", 220], ["Ocio", 250], ["Salud", 120]
  ];

  var eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var dayFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
  var monthFmt = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

  /* ---------- storage ---------- */
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
  function showError(id, msg) { $(id).textContent = msg || ""; $(id).hidden = !msg; }
  function setMsg(msg) { $("settings-msg").textContent = msg; }

  /* ---------- view state ---------- */
  var now = new Date();
  var view = { mes: now.getFullYear() + "-" + pad(now.getMonth() + 1), editingCats: false, editing: null, confirm: null };

  function monthGastos() { return data.gastos.filter(function (g) { return (g.fecha || "").slice(0, 7) === view.mes; }); }
  function income() { return (data.meses[view.mes] && data.meses[view.mes].ingresos) || 0; }
  function defaultDate() {
    var today = ymd(new Date());
    return today.slice(0, 7) === view.mes ? today : view.mes + "-01";
  }
  function shiftMonth(delta) {
    var p = view.mes.split("-"), d = new Date(+p[0], +p[1] - 1 + delta, 1);
    view.mes = d.getFullYear() + "-" + pad(d.getMonth() + 1);
    view.editing = null; view.confirm = null;
    $("exp-date").value = defaultDate();
    render();
  }

  /* ---------- render ---------- */
  function render() {
    var p = view.mes.split("-");
    var label = monthFmt.format(new Date(+p[0], +p[1] - 1, 1));
    $("month").textContent = label.charAt(0).toUpperCase() + label.slice(1);

    var gastos = monthGastos();
    var total = gastos.reduce(function (s, g) { return s + g.importe; }, 0);
    var inc = income(), saving = inc - total;
    var incInput = $("income");
    if (document.activeElement !== incInput) incInput.value = inc ? String(inc).replace(".", ",") : "";
    $("exp").textContent = eur.format(total);
    $("sav").textContent = (saving < 0 ? "−" : "") + eur.format(Math.abs(saving));
    $("sav-box").classList.toggle("neg", saving < 0);

    renderCats(gastos);
    renderSelect();
    renderList(gastos);
  }

  function renderCats(gastos) {
    var rows = $("rows"); rows.textContent = "";
    var spent = {};
    gastos.forEach(function (g) { spent[g.categoria] = (spent[g.categoria] || 0) + g.importe; });
    var max = Math.max.apply(null, [1].concat(data.categorias.map(function (c) { return Math.max(c.limite, spent[c.id] || 0); })));
    if (!data.categorias.length) rows.appendChild(el("p", { class: "empty", text: "No hay categorías. Pulsa «Editar categorías» para crear la primera." }));

    data.categorias.forEach(function (c) {
      if (view.editing === c.id) { rows.appendChild(editRow(c)); return; }
      var s = spent[c.id] || 0, over = s > c.limite;
      var row = el("div", { class: "row" + (over ? " over" : "") + (view.editingCats ? " has-actions" : "") }, [
        el("span", { class: "name" }, [c.nombre, over ? el("span", { class: "flag", text: "−" + eur.format(s - c.limite) + " sobre el límite" }) : null]),
        el("div", { class: "bar-track", role: "img", "aria-label": c.nombre + ": " + eur.format(s) + " de " + eur.format(c.limite) }, [
          el("i", { style: "width:" + (s / max * 100).toFixed(1) + "%" }),
          el("span", { class: "limit", style: "left:calc(" + (c.limite / max * 100).toFixed(1) + "% - 1px)" })
        ]),
        el("span", { class: "amt" }, [el("b", { text: eur.format(s) }), " / " + eur.format(c.limite)])
      ]);
      if (view.editingCats) {
        var actions = el("div", { class: "actions" });
        if (view.confirm === "cat:" + c.id) {
          var n = data.gastos.filter(function (g) { return g.categoria === c.id; }).length;
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
    var sel = $("exp-cat"), prev = sel.value; sel.textContent = "";
    data.categorias.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.nombre })); });
    if (prev && data.categorias.some(function (c) { return c.id === prev; })) sel.value = prev;
    $("exp-form").querySelector("button").disabled = !data.categorias.length;
  }

  function renderList(gastos) {
    var list = $("list"); list.textContent = "";
    var names = {}; data.categorias.forEach(function (c) { names[c.id] = c.nombre; });
    var items = gastos.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || b.creado - a.creado; });
    $("count").textContent = items.length ? items.length + (items.length === 1 ? " gasto" : " gastos") : "";
    if (!items.length) list.appendChild(el("li", { class: "empty", text: "Todavía no hay gastos este mes." }));
    items.forEach(function (g) {
      var actions = el("div", { class: "actions" });
      if (view.confirm === "g:" + g.id) {
        actions.appendChild(el("button", { type: "button", class: "link danger", text: "Sí, borrar", on: { click: function () { deleteGasto(g.id); } } }));
        actions.appendChild(el("button", { type: "button", class: "link", text: "No", on: { click: function () { view.confirm = null; render(); } } }));
      } else {
        actions.appendChild(el("button", { type: "button", class: "link danger", text: "Borrar", "aria-label": "Borrar " + g.concepto, on: { click: function () { view.confirm = "g:" + g.id; render(); } } }));
      }
      list.appendChild(el("li", { class: "item" }, [
        el("span", { class: "date", text: dayFmt.format(new Date(g.fecha + "T12:00:00")) }),
        el("span", { class: "what" }, [g.concepto, el("small", { text: names[g.categoria] || "Sin categoría" })]),
        el("span", { class: "money", text: eur.format(g.importe) }),
        actions
      ]));
    });
  }

  /* ---------- actions ---------- */
  function deleteCat(id) {
    data.categorias = data.categorias.filter(function (c) { return c.id !== id; });
    data.gastos = data.gastos.filter(function (g) { return g.categoria !== id; });
    view.confirm = null; save(); render();
  }
  function deleteGasto(id) {
    data.gastos = data.gastos.filter(function (g) { return g.id !== id; });
    view.confirm = null; save(); render();
  }

  $("prev").addEventListener("click", function () { shiftMonth(-1); });
  $("next").addEventListener("click", function () { shiftMonth(1); });
  $("toggle-cats").addEventListener("click", function () {
    view.editingCats = !view.editingCats; view.editing = null; view.confirm = null; render();
  });

  $("income").addEventListener("change", function () {
    var v = this.value.trim() === "" ? 0 : num(this.value);
    if (!(v >= 0)) { render(); return; }
    data.meses[view.mes] = { ingresos: v }; save(); render();
  });

  $("exp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var what = $("exp-what").value.trim(), amount = num($("exp-amount").value), cat = $("exp-cat").value, date = $("exp-date").value || defaultDate();
    if (!what) return showError("exp-error", "Escribe en qué gastaste.");
    if (!(amount > 0)) return showError("exp-error", "Escribe un importe mayor que 0.");
    if (!cat) return showError("exp-error", "Elige una categoría.");
    showError("exp-error");
    data.gastos.push({ id: uid(), concepto: what, importe: amount, categoria: cat, fecha: date, creado: Date.now() });
    save();
    $("exp-what").value = ""; $("exp-amount").value = "";
    if (date.slice(0, 7) !== view.mes) { view.mes = date.slice(0, 7); }
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
  $("exp-date").value = defaultDate();
  render();
  save();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
