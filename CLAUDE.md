# Presupuesto (PWA) — notas para continuar

App web instalable en iPhone (Safari → Compartir → Añadir a pantalla de inicio) para llevar un presupuesto mensual. Sin Mac ni App Store: es una PWA publicada con GitHub Pages.

- Web: https://andriuu20.github.io/presupuesto-app/
- Publicación: cada push a `main` redespliega GitHub Pages (Settings → Pages → Deploy from a branch → main, / root).
- El usuario escribe en español y prueba desde un iPhone 13. Antes de cambios grandes, enseñar un borrador (wireframe en texto) y esperar su visto bueno.

## Archivos

- `index.html`: dos pantallas, `#screen-index` (índice de meses del año) y `#screen-month` (un mes).
- `app.js`: toda la lógica, sin dependencias. Guarda en `localStorage` con la clave `presupuesto-v1`.
- `app.css`: estilo **Moderna**, el único (el usuario quitó los temas Finanzas/Daylight/Night). Letra Manrope incluida en `fonts/` para funcionar sin conexión.
- `sw.js`: **red primero** (con conexión siempre la última versión; sin conexión, la copia guardada). **En cada cambio sube `CACHE` en `sw.js` y `VERSION` en `app.js` al mismo número**; Ajustes muestra «Versión N» para que el usuario compruebe que se actualizó. Al tomar el control una versión nueva, la página se recarga sola una vez.
- `manifest.webmanifest`, `icons/`: nombre, colores e icono (fondo navy con tres barras).
- `receipt-parse.js`: interpreta el texto de un ticket (comercio, total, fecha, pista de categoría). Funciones puras, se pueden probar con `node`.
- `export-xlsx.js` + `vendor/excel/exceljs.min.js` (ExcelJS 4.4.0, se carga solo al exportar): botón «Exportar a Excel» al final de cada mes → `Presupuesto <Mes> <Año>.xlsx` con hojas Resumen (totales y tabla de categorías, todo fórmulas con su resultado precalculado; celdas grises editables; naranja si se pasa del límite), Gastos (categoría con desplegable), Gastos fijos (¿Cuenta este mes? Sí/No) e Ingresos extra. Se comparte con `navigator.share` (Guardar en Archivos / abrir en Excel). Lo editado en Excel no vuelve a la app. Solo un mes; el año entero quedó para más adelante.
- `vendor/ocr/`: Tesseract.js 5.1.1 + datos de español (`spa` best_int), incluidos en el repo para funcionar sin CDN ni conexión. Se cargan solo al primer escaneo.

## Modelo de datos (localStorage)

```
{ categorias: [{id, nombre, limite}],
  gastos: [{id, concepto, importe, categoria, fecha "YYYY-MM-DD", creado}],
  meses: { "YYYY-MM": { ingresos (solo este mes), cerrado, cats: [{id, nombre, limite}], fijos: [copia congelada], sueldoCongelado, arrastre: {importe, de} } },
  sueldos: [{desde "YYYY-MM", importe}],
  fijos: [{id, nombre, importe, desde "YYYY-MM", meses (null = indefinido), baja "YYYY-MM",
           importes: [{desde, importe}], cambios: {"YYYY-MM": {importe, quitado}}}],
  extras: [{id, tipo, concepto, importe, fecha, creado}],
  comercios: { "mercadona": catId, ... },
  tema: "business" | "light" | "dark" }
```

## Decisiones ya tomadas

- Cada mes se **guarda y cierra a mano**; cerrado = solo consulta. Se puede reabrir.
- Al cerrar un mes por primera vez se congelan sus categorías y límites (`meses[mes].cats`); un mes con copia congelada no permite editar categorías y conserva sus gastos aunque la categoría se borre después.
- **Sueldo fijo** (sustituye a «cada mes empieza en 0»): `data.sueldos = [{desde, importe}]` se repite cada mes desde `desde`. Al cambiarlo en el hero se pregunta «Solo este mes» (`meses[mes].ingresos`, con enlace «Usar el fijo») o «Desde este mes» (nuevo tramo; borra los «solo este mes» posteriores no cerrados). El primer sueldo se fija sin preguntar. Al cerrar un mes se congela en `meses[mes].sueldoCongelado`; al reabrir se recalcula. Datos antiguos: `migrateSueldo` convierte el último mes con ingresos en el sueldo fijo.
- **Pasar el ahorro**: al cerrar un mes con ahorro > 0 sale una hoja «¿Quieres añadir este ahorro a tu saldo de <mes siguiente>?» con **importe editable** (0…ahorro; el resto «queda aparte, fuera de la app»). Se guarda en `meses[siguiente].arrastre = {importe, de}`; cuenta como saldo principal (disponible, ingresos, ahorro) solo ese mes; franja «+X € de octubre» con Cambiar / Quitar. El «Ahorro del año» resta los arrastres para no contar doble. Solo ahorro positivo (los negativos no se pasan).
- **Gastos fijos** (Netflix, deudas…): se definen una vez en el mes en que empiezan y salen solos cada mes; **cuentan solos** en los gastos. Van todos en la pseudo-categoría «Gastos fijos» (`FIJOS`), **sin límite**. Indefinidos o «durante N meses» (muestra «cuota k de N»). Por mes: quitar solo de este mes, cambiar importe (solo este mes / desde este mes), dar de baja desde este mes, eliminar si fue un error. **Sin día de cobro** (el usuario no lo quiso). Al cerrar un mes se congela la lista (`meses[mes].fijos`); al reabrir se vuelve a calcular desde las definiciones.
- **Ingresos extra**: lista por mes con tipo (Trabajo extra, Venta, Regalo, Otros) + concepto libre. Ahorro = ingreso principal + extras − gastos. Un mes con solo gastos fijos no cuenta como «con datos» en el índice.
- **Apple Pay (opción 1, sin servidor)**: una automatización «Transacción» de Atajos copia `PRESUPUESTO;<Importe>;<Comercio>` al portapapeles; en la app, «Pegar compra de Apple Pay» lo lee (`navigator.clipboard.readText`, con recuadro de pegar como alternativa) y abre la misma hoja de confirmación que los tickets. Instrucciones para el usuario en Ajustes → «Conectar Apple Pay». Si lo pegado parece una recarga de Revolut (`isTopUp`: revolut, top up, recarga…), avisa y no lo apunta salvo que el usuario pulse «Es un gasto, apuntarlo». La opción 2 (servidor tipo Supabase/Firebase que recibe las compras y sincroniza los datos) queda para más adelante.
- Al final de cada mes: comparación con el mes anterior (frase resumen, totales, dónde más subió y bajó el gasto, tabla por categoría).
- Los datos viven solo en el dispositivo; Ajustes tiene exportar/importar copia `.json`.
- **Escanear ticket** (opción A, OCR en el iPhone con Tesseract.js): siempre muestra una hoja de confirmación editable. Si no reconoce la categoría, pregunta. Dos botones: «Hacer foto» (cámara) y «Elegir captura» (galería, para entradas y recibos digitales). Las capturas en modo oscuro se invierten antes de leerlas. Recuerda la categoría elegida por comercio en `data.comercios` (nombre normalizado → id). **La foto no se guarda nunca.** Opción B (IA con Claude vía un pequeño servidor) queda para más adelante si la A falla mucho.

## Estilo Moderna (tokens en `:root` de `app.css`)

fondo `#f3f5f8` · tarjetas `#ffffff` radio 20 · texto `#111827` · secundario `#5f6b7a` · acento verde azulado `#0f766e` (suave `#d9f2ee`) · pasado de límite naranja `#c2410c` (texto `#9a3412`, suave `#ffedd5`) · tarjeta principal oscura `#111827` con acento `#7ee0cf`. Botones radio 14. Arriba de cada mes, la tarjeta oscura muestra **lo gastado este mes** en grande (no el ahorro), % de lo que entró, barra de progreso y tres cajitas: Principal (editable, con nota «Sueldo fijo desde…» / «Solo este mes»), Extra, Ahorro; debajo, pregunta solo/desde este mes y franja del ahorro pasado. Arriba de «Por categoría», tarjeta **Presupuesto de categorías**: primero el **plan** — Disponible = ingreso principal − gastos fijos; − Límites; + Ingresos extra (los extras **solo suman al ahorro**, nunca al disponible); = Ahorro previsto. Si los límites superan el disponible, aviso naranja «Tus límites no caben… baja X €» con botón «Ajustar límites» (abre Editar categorías). **Solo avisa, no bloquea** (decisión del usuario). Sin ingreso principal: «Apunta tu ingreso principal…». Al editar límites, nota en directo «Quedan X € sin asignar» / «Te pasas X €». Después, gastado en categorías con límite (sin gastos fijos) frente a la suma de límites, barra (naranja si se pasa), «Te quedan X € para N días (hoy incluido) → unos Y € al día» y frase de ritmo (% del dinero frente a % del mes). Sin marca de «hoy» en la barra (el usuario no la quiso). Meses pasados/cerrados: resultado final; futuros: «Aún no ha empezado». Categorías: nombre + pastilla (% o «+X € pasado»), barra fina medida contra su propio límite, «x de y».

## Probar

`npx http-server -p 8765 -c-1 .` y abrir con Playwright en el dispositivo "iPhone 13".
