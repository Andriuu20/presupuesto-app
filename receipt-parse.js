/* Turns the OCR text of a Spanish shop receipt into { comercio, total, fecha, pista }.
   `pista` is a category hint ("comida", "transporte"…) for known shops. Pure functions, no DOM. */
(function (root) {
  "use strict";

  // Known shops: name to show, words to find in the receipt, category hint.
  var SHOPS = [
    ["Mercadona", ["MERCADONA"], "comida"], ["Lidl", ["LIDL"], "comida"], ["Carrefour", ["CARREFOUR"], "comida"],
    ["Dia", ["DIA RETAIL", "SUPERMERCADOS DIA", "DISTRIBUIDORA INTERNACIONAL DE ALIMENTACION"], "comida"],
    ["Alcampo", ["ALCAMPO"], "comida"], ["Eroski", ["EROSKI"], "comida"], ["Consum", ["CONSUM"], "comida"],
    ["Aldi", ["ALDI"], "comida"], ["Hipercor", ["HIPERCOR"], "comida"], ["Ahorramás", ["AHORRAMAS"], "comida"],
    ["Caprabo", ["CAPRABO"], "comida"], ["bonÀrea", ["BONAREA", "BON AREA"], "comida"], ["Supermercados BM", ["SUPERMERCADOS BM", "UVESCO"], "comida"],
    ["Gadis", ["GADIS"], "comida"], ["Froiz", ["FROIZ"], "comida"], ["Spar", ["SPAR"], "comida"], ["Covirán", ["COVIRAN"], "comida"],
    ["Mas", ["SUPERMERCADOS MAS"], "comida"], ["El Corte Inglés Supermercado", ["SUPERMERCADO EL CORTE"], "comida"],
    ["McDonald's", ["MCDONALD"], "comida"], ["Burger King", ["BURGER KING"], "comida"], ["Telepizza", ["TELEPIZZA"], "comida"],
    ["Starbucks", ["STARBUCKS"], "comida"], ["KFC", ["KFC"], "comida"], ["Domino's", ["DOMINO"], "comida"], ["Glovo", ["GLOVO"], "comida"],
    ["Repsol", ["REPSOL"], "transporte"], ["Cepsa", ["CEPSA", "MOEVE"], "transporte"], ["BP", ["BP OIL", "ESTACION BP", "E.S. BP"], "transporte"],
    ["Galp", ["GALP"], "transporte"], ["Shell", ["SHELL"], "transporte"], ["Plenoil", ["PLENOIL"], "transporte"], ["Ballenoil", ["BALLENOIL"], "transporte"],
    ["Petroprix", ["PETROPRIX"], "transporte"], ["Renfe", ["RENFE"], "transporte"], ["Cabify", ["CABIFY"], "transporte"], ["Uber", ["UBER"], "transporte"],
    ["Metro", ["METRO DE MADRID", "TMB", "METRO BILBAO", "METROVALENCIA"], "transporte"], ["Parking", ["PARKING", "APARCAMIENTO"], "transporte"],
    ["Farmacia", ["FARMACIA", "PARAFARMACIA"], "salud"], ["Óptica", ["OPTICA", "GENERAL OPTICA", "MULTIOPTICAS"], "salud"],
    ["Iberdrola", ["IBERDROLA"], "servicios"], ["Endesa", ["ENDESA"], "servicios"], ["Naturgy", ["NATURGY"], "servicios"],
    ["Movistar", ["MOVISTAR", "TELEFONICA"], "servicios"], ["Vodafone", ["VODAFONE"], "servicios"], ["Orange", ["ORANGE"], "servicios"],
    ["Digi", ["DIGI MOBIL", "DIGI SPAIN"], "servicios"],
    ["Cinesa", ["CINESA"], "ocio"], ["Yelmo", ["YELMO"], "ocio"], ["Kinépolis", ["KINEPOLIS"], "ocio"], ["Ocine", ["OCINE"], "ocio"],
    ["Odeon", ["ODEON"], "ocio"], ["Cines Renoir", ["RENOIR"], "ocio"], ["Golem", ["GOLEM"], "ocio"], ["Artesiete", ["ARTESIETE"], "ocio"],
    ["Cine", ["CINES", "CINE"], "ocio"], ["Entradas.com", ["ENTRADAS.COM", "ENTRADAS COM"], "ocio"], ["Ticketmaster", ["TICKETMASTER"], "ocio"],
    ["Eventbrite", ["EVENTBRITE"], "ocio"], ["Atrápalo", ["ATRAPALO"], "ocio"], ["Spotify", ["SPOTIFY"], "ocio"], ["Netflix", ["NETFLIX"], "ocio"], ["Decathlon", ["DECATHLON"], "ocio"], ["Fnac", ["FNAC"], "ocio"],
    ["Zara", ["ZARA"], "ocio"], ["Primark", ["PRIMARK"], "ocio"], ["Mango", ["MANGO"], "ocio"], ["H&M", ["H&M", "H & M"], "ocio"],
    ["Ikea", ["IKEA"], "vivienda"], ["Leroy Merlin", ["LEROY MERLIN"], "vivienda"], ["Bricomart", ["BRICOMART"], "vivienda"], ["Bauhaus", ["BAUHAUS"], "vivienda"]
  ];

  var GENERIC = ["Farmacia", "Óptica", "Parking", "Metro", "Cine"];

  // Words a category name may use for each hint, so a hint finds "Supermercado" as well as "Comida".
  var HINT_WORDS = {
    comida: ["comida", "aliment", "super", "compra", "restaur", "comer"],
    transporte: ["transporte", "coche", "gasolina", "combustible", "movilidad"],
    salud: ["salud", "farmacia", "medic"],
    servicios: ["servicio", "suministro", "factura", "luz", "telefon"],
    ocio: ["ocio", "entreten", "ropa", "compras", "tiempo libre"],
    vivienda: ["vivienda", "casa", "hogar"]
  };

  function strip(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function upper(s) { return strip(s).toUpperCase(); }
  function norm(s) { return strip(String(s || "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

  // "1.234,56" / "47,85" / "47.85" / "47,85€" → 47.85
  var AMOUNT = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[.,]\s?(\d{2})(?!\d)/g;
  function amounts(line) {
    var out = [], m;
    AMOUNT.lastIndex = 0;
    while ((m = AMOUNT.exec(line))) out.push(parseFloat(m[1].replace(/[.\s]/g, "") + "." + m[2]));
    return out;
  }

  function findTotal(lines) {
    var best = null;
    lines.forEach(function (raw, i) {
      var L = upper(raw).replace(/0/g, "O");
      if (!/T\s?O\s?T\s?A\s?L|IMPORTE|A PAGAR|EFECTIVO|TARJETA/.test(L)) return;
      if (/SUB\s?TOTAL|BASE|I\.?V\.?A|IMPUESTO|CUOTA|DESCUENTO|AHORRO|CAMBIO|DEVOLVER|ENTREGAD|PUNTOS/.test(L)) return;
      var nums = amounts(raw);
      if (!nums.length && lines[i + 1]) nums = amounts(lines[i + 1]); // amount on the next line
      if (!nums.length) return;
      var v = nums[nums.length - 1];
      var weight = /T\s?O\s?T\s?A\s?L/.test(L) ? 3 : /A PAGAR|IMPORTE/.test(L) ? 2 : 1;
      if (!best || weight > best.weight || (weight === best.weight && v > best.v)) best = { v: v, weight: weight };
    });
    return best && best.v > 0 && best.v < 100000 ? best.v : null;
  }

  function findDate(text) {
    var re = /(\d{1,2})\s?[\/\-.]\s?(\d{1,2})\s?[\/\-.]\s?(\d{2,4})/g, m;
    while ((m = re.exec(text))) {
      var d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      }
    }
    return null;
  }

  function findShop(lines) {
    var all = " " + upper(lines.join(" \n ")) + " ";
    for (var i = 0; i < SHOPS.length; i++) {
      for (var j = 0; j < SHOPS[i][1].length; j++) {
        var w = SHOPS[i][1][j];
        var re = new RegExp("(^|[^A-Z])" + w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^A-Z]|$)");
        if (!re.test(all)) continue;
        // Generic shop types keep the receipt's own name ("Farmacia López García").
        if (GENERIC.indexOf(SHOPS[i][0]) >= 0) {
          for (var g = 0; g < Math.min(lines.length, 6); g++) {
            if (upper(lines[g]).indexOf(w) >= 0 && lines[g].length <= 40) return { comercio: titleCase(lines[g].replace(/[^\wÀ-ÿ&'.\- ]/g, "").trim()), pista: SHOPS[i][2] };
          }
        }
        return { comercio: SHOPS[i][0], pista: SHOPS[i][2] };
      }
    }
    // Unknown shop: first line that reads like a name (letters, not a tax id, phone or address).
    for (var k = 0; k < Math.min(lines.length, 6); k++) {
      var l = lines[k].trim(), U = upper(l);
      var letters = (l.match(/[A-Za-zÀ-ÿ]/g) || []).length;
      if (letters < 3 || letters < l.length * 0.5) continue;
      if (/C\.?I\.?F|N\.?I\.?F|TEL|FACTURA|TICKET|CALLE|C\/|AVDA|AVENIDA|PLAZA|WWW|HTTP|@/.test(U)) continue;
      return { comercio: titleCase(l.replace(/[^\wÀ-ÿ&'.\- ]/g, "").trim()).slice(0, 40), pista: null };
    }
    return { comercio: "", pista: null };
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s\-])([a-zà-ÿ])/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  function parse(text) {
    var lines = String(text || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var shop = findShop(lines);
    return { comercio: shop.comercio, pista: shop.pista, total: findTotal(lines), fecha: findDate(text) };
  }

  // Best category for a shop: what the person chose before, then the hint, else null (ask).
  function guessCategory(comercio, pista, cats, learned) {
    var key = norm(comercio);
    if (key && learned && learned[key] && cats.some(function (c) { return c.id === learned[key]; })) return learned[key];
    if (!pista) return null;
    var words = HINT_WORDS[pista] || [pista];
    for (var i = 0; i < cats.length; i++) {
      var n = norm(cats[i].nombre);
      if (words.some(function (w) { return n.indexOf(norm(w)) >= 0; })) return cats[i].id;
    }
    return null;
  }

  var api = { parse: parse, guessCategory: guessCategory, norm: norm, amounts: amounts };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ReceiptParse = api;
})(this);
