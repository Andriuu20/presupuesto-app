/* Builds one month as an editable .xlsx with ExcelJS (vendor/excel, loaded on demand).
   Sheets: Resumen (totals + categories, all formulas), Gastos, Gastos fijos, Ingresos extra.
   Every formula also carries its computed result so previews (Quick Look, Archivos) show numbers. */
(function (root) {
  "use strict";

  var INK = "FF111827", MUTED = "FF5F6B7A", TEAL = "FF0F766E", ORANGE = "FF9A3412", ORANGE_SOFT = "FFFFEDD5";
  var INPUT = "FFF3F5F8", LINE = "FFE7EAF0", WHITE = "FFFFFFFF";
  var EUR = '#,##0.00 "€";[Red]-#,##0.00 "€"';
  var PCT = "0%";
  var GASTOS_ROWS = 500, FIJOS_ROWS = 100, EXTRAS_ROWS = 200, SPARE_CATS = 5;
  var TIPOS = ["Trabajo extra", "Venta", "Regalo", "Otros"];

  function sum(list, f) { return list.reduce(function (t, x) { return t + (f ? f(x) : x); }, 0); }
  function round2(v) { return Math.round(v * 100) / 100; }
  function toDate(ymd) { var p = ymd.split("-"); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }

  function header(ws, titles, widths) {
    ws.columns = widths.map(function (w) { return { width: w }; });
    var row = ws.getRow(1);
    titles.forEach(function (t, i) {
      var c = row.getCell(i + 1);
      c.value = t;
      c.font = { name: "Arial", bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
      c.alignment = { vertical: "middle" };
    });
    row.height = 22;
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  function base(c) { c.font = Object.assign({ name: "Arial" }, c.font || {}); }
  function input(c) {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT } };
    c.border = { bottom: { style: "thin", color: { argb: LINE } } };
  }

  // model: { titulo, principal, cats: [{nombre, limite}], gastos: [{fecha, concepto, categoria, importe}],
  //          fijos: [{nombre, importe, cuenta}], extras: [{fecha, tipo, concepto, importe}] }
  function build(ExcelJS, m) {
    var wb = new ExcelJS.Workbook();
    wb.creator = "Presupuesto";
    wb.created = new Date();
    wb.calcProperties = { fullCalcOnLoad: true };

    var resumen = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: TEAL } } });
    var wsG = wb.addWorksheet("Gastos");
    var wsF = wb.addWorksheet("Gastos fijos");
    var wsX = wb.addWorksheet("Ingresos extra");

    /* ---- Gastos ---- */
    header(wsG, ["Fecha", "Concepto", "Categoría", "Importe"], [12, 34, 20, 14]);
    m.gastos.forEach(function (g, i) {
      var r = wsG.getRow(i + 2);
      r.getCell(1).value = toDate(g.fecha); r.getCell(1).numFmt = "dd/mm/yyyy";
      r.getCell(2).value = g.concepto;
      r.getCell(3).value = g.categoria;
      r.getCell(4).value = g.importe; r.getCell(4).numFmt = EUR;
    });
    for (var gi = 2; gi <= GASTOS_ROWS + 1; gi++) {
      var gr = wsG.getRow(gi);
      gr.getCell(1).numFmt = "dd/mm/yyyy"; gr.getCell(4).numFmt = EUR;
      [1, 2, 3, 4].forEach(function (k) { base(gr.getCell(k)); });
    }
    wsG.autoFilter = "A1:D1";

    /* ---- Gastos fijos ---- */
    header(wsF, ["Nombre", "Importe", "¿Cuenta este mes?"], [30, 14, 20]);
    m.fijos.forEach(function (f, i) {
      var r = wsF.getRow(i + 2);
      r.getCell(1).value = f.nombre;
      r.getCell(2).value = f.importe;
      r.getCell(3).value = f.cuenta ? "Sí" : "No";
    });
    for (var fi = 2; fi <= FIJOS_ROWS + 1; fi++) {
      var fr = wsF.getRow(fi);
      fr.getCell(2).numFmt = EUR;
      fr.getCell(3).dataValidation = { type: "list", allowBlank: true, formulae: ['"Sí,No"'] };
      [1, 2, 3].forEach(function (k) { base(fr.getCell(k)); });
    }

    /* ---- Ingresos extra ---- */
    header(wsX, ["Fecha", "Tipo", "Concepto", "Importe"], [12, 16, 32, 14]);
    m.extras.forEach(function (x, i) {
      var r = wsX.getRow(i + 2);
      r.getCell(1).value = toDate(x.fecha); r.getCell(1).numFmt = "dd/mm/yyyy";
      r.getCell(2).value = x.tipo;
      r.getCell(3).value = x.concepto;
      r.getCell(4).value = x.importe;
    });
    for (var xi = 2; xi <= EXTRAS_ROWS + 1; xi++) {
      var xr = wsX.getRow(xi);
      xr.getCell(1).numFmt = "dd/mm/yyyy"; xr.getCell(4).numFmt = EUR;
      xr.getCell(2).dataValidation = { type: "list", allowBlank: true, formulae: ['"' + TIPOS.join(",") + '"'] };
      [1, 2, 3, 4].forEach(function (k) { base(xr.getCell(k)); });
    }

    /* ---- Resumen ---- */
    var extra = round2(sum(m.extras, function (x) { return x.importe; }));
    var enCats = round2(sum(m.gastos, function (g) { return g.importe; }));
    var fijos = round2(sum(m.fijos, function (f) { return f.cuenta ? f.importe : 0; }));
    var ingresos = round2(m.principal + extra), gastado = round2(enCats + fijos);

    resumen.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 11 }];
    var t = resumen.getCell("A1");
    t.value = m.titulo; t.font = { name: "Arial", size: 16, bold: true, color: { argb: INK } };
    var note = resumen.getCell("A2");
    note.value = "Las celdas grises se pueden editar; el resto se calcula solo.";
    note.font = { name: "Arial", size: 9, italic: true, color: { argb: MUTED } };

    var G = "Gastos!$D$2:$D$" + (GASTOS_ROWS + 1), GC = "Gastos!$C$2:$C$" + (GASTOS_ROWS + 1);
    var lines = [
      ["Ingreso principal", m.principal, null, true],
      ["Ingresos extra", { formula: "SUM('Ingresos extra'!D2:D" + (EXTRAS_ROWS + 1) + ")", result: extra }],
      ["Total ingresos", { formula: "B4+B5", result: ingresos }, "bold"],
      ["Gastos en categorías", { formula: "SUM(" + G + ")", result: enCats }],
      ["Gastos fijos", { formula: "SUMIFS('Gastos fijos'!B2:B" + (FIJOS_ROWS + 1) + ",'Gastos fijos'!C2:C" + (FIJOS_ROWS + 1) + ",\"Sí\")", result: fijos }],
      ["Total gastado", { formula: "B7+B8", result: gastado }, "bold"],
      ["Ahorro", { formula: "B6-B9", result: round2(ingresos - gastado) }, "accent"],
      ["% gastado", { formula: "IF(B6>0,B9/B6,0)", result: ingresos > 0 ? gastado / ingresos : 0 }, "pct"]
    ];
    lines.forEach(function (l, i) {
      var r = resumen.getRow(4 + i), a = r.getCell(1), b = r.getCell(2);
      a.value = l[0]; a.font = { name: "Arial", color: { argb: INK }, bold: l[2] === "bold" || l[2] === "accent" };
      b.value = l[1]; b.numFmt = l[2] === "pct" ? PCT : EUR;
      b.font = { name: "Arial", bold: !!l[2] && l[2] !== "pct", color: { argb: l[2] === "accent" ? TEAL : INK } };
      if (l[3]) input(b);
      if (l[2] === "bold" || l[2] === "accent") a.border = b.border = { top: { style: "thin", color: { argb: LINE } } };
    });

    // Categories table.
    var top = 13;
    ["Categoría", "Límite", "Gastado", "Disponible", "% usado"].forEach(function (h, i) {
      var c = resumen.getRow(top).getCell(i + 1);
      c.value = h; c.font = { name: "Arial", bold: true, color: { argb: WHITE } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    });
    var cats = m.cats.concat(Array.apply(null, Array(SPARE_CATS)).map(function () { return null; }));
    var first = top + 1, last = top + cats.length;
    cats.forEach(function (c, i) {
      var n = first + i, r = resumen.getRow(n);
      var spent = c ? round2(sum(m.gastos, function (g) { return g.categoria === c.nombre ? g.importe : 0; })) : 0;
      r.getCell(1).value = c ? c.nombre : null;
      r.getCell(2).value = c ? c.limite : null;
      r.getCell(3).value = { formula: 'IF(A' + n + '="","",SUMIFS(' + G + "," + GC + ",A" + n + "))", result: c ? spent : "" };
      r.getCell(4).value = { formula: 'IF(A' + n + '="","",B' + n + "-C" + n + ")", result: c ? round2(c.limite - spent) : "" };
      r.getCell(5).value = { formula: 'IF(OR(A' + n + '="",N(B' + n + ")=0),\"\",C" + n + "/B" + n + ")", result: c && c.limite ? spent / c.limite : "" };
      input(r.getCell(1)); input(r.getCell(2));
      [2, 3, 4].forEach(function (k) { r.getCell(k).numFmt = EUR; });
      r.getCell(5).numFmt = PCT;
      [1, 2, 3, 4, 5].forEach(function (k) { base(r.getCell(k)); });
    });
    var totalRow = resumen.getRow(last + 1);
    var limTot = round2(sum(m.cats, function (c) { return c.limite; }));
    totalRow.getCell(1).value = "Total";
    totalRow.getCell(2).value = { formula: "SUM(B" + first + ":B" + last + ")", result: limTot };
    totalRow.getCell(3).value = { formula: "SUM(C" + first + ":C" + last + ")", result: enCats };
    totalRow.getCell(4).value = { formula: "B" + (last + 1) + "-C" + (last + 1), result: round2(limTot - enCats) };
    totalRow.getCell(5).value = { formula: "IF(B" + (last + 1) + ">0,C" + (last + 1) + "/B" + (last + 1) + ",0)", result: limTot ? enCats / limTot : 0 };
    [1, 2, 3, 4, 5].forEach(function (k) {
      var c = totalRow.getCell(k);
      c.font = { name: "Arial", bold: true, color: { argb: INK } };
      c.border = { top: { style: "thin", color: { argb: INK } } };
      if (k > 1 && k < 5) c.numFmt = EUR;
    });
    totalRow.getCell(5).numFmt = PCT;

    // Over the limit: orange.
    resumen.addConditionalFormatting({
      ref: "C" + first + ":E" + last,
      rules: [{ type: "expression", formulae: ["AND(N($B" + first + ")>0,N($C" + first + ")>N($B" + first + "))"],
        style: { font: { color: { argb: ORANGE }, bold: true }, fill: { type: "pattern", pattern: "solid", bgColor: { argb: ORANGE_SOFT } } } }]
    });

    // Category list for the Gastos sheet comes from the table, spare rows included.
    for (var vi = 2; vi <= GASTOS_ROWS + 1; vi++) {
      wsG.getCell("C" + vi).dataValidation = { type: "list", allowBlank: true, formulae: ["Resumen!$A$" + first + ":$A$" + last],
        showErrorMessage: false };
    }

    return wb.xlsx.writeBuffer().then(function (buf) {
      return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    });
  }

  var api = { build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PresupuestoExport = api;
})(this);
