# Presupuesto (PWA) — notas para continuar

App web instalable en iPhone (Safari → Compartir → Añadir a pantalla de inicio) para llevar un presupuesto mensual. Sin Mac ni App Store: es una PWA publicada con GitHub Pages.

- Web: https://andriuu20.github.io/presupuesto-app/
- Publicación: cada push a `main` redespliega GitHub Pages (Settings → Pages → Deploy from a branch → main, / root).
- El usuario escribe en español y prueba desde un iPhone 13. Antes de cambios grandes, enseñar un borrador (wireframe en texto) y esperar su visto bueno.

## Archivos

- `index.html`: dos pantallas, `#screen-index` (índice de meses del año) y `#screen-month` (un mes).
- `app.js`: toda la lógica, sin dependencias. Guarda en `localStorage` con la clave `presupuesto-v1`.
- `app.css`: estilo **Moderna**, el único (el usuario quitó los temas Finanzas/Daylight/Night). Letra Manrope incluida en `fonts/` para funcionar sin conexión.
- `sw.js`: caché sin conexión. **Sube el número de `CACHE` en cada cambio** para que el iPhone descargue la versión nueva.
- `manifest.webmanifest`, `icons/`: nombre, colores e icono (fondo navy con tres barras).
- `receipt-parse.js`: interpreta el texto de un ticket (comercio, total, fecha, pista de categoría). Funciones puras, se pueden probar con `node`.
- `vendor/ocr/`: Tesseract.js 5.1.1 + datos de español (`spa` best_int), incluidos en el repo para funcionar sin CDN ni conexión. Se cargan solo al primer escaneo.

## Modelo de datos (localStorage)

```
{ categorias: [{id, nombre, limite}],
  gastos: [{id, concepto, importe, categoria, fecha "YYYY-MM-DD", creado}],
  meses: { "YYYY-MM": { ingresos, cerrado, cats: [{id, nombre, limite}], fijos: [copia congelada] } },
  fijos: [{id, nombre, importe, desde "YYYY-MM", meses (null = indefinido), baja "YYYY-MM",
           importes: [{desde, importe}], cambios: {"YYYY-MM": {importe, quitado}}}],
  extras: [{id, tipo, concepto, importe, fecha, creado}],
  comercios: { "mercadona": catId, ... },
  tema: "business" | "light" | "dark" }
```

## Decisiones ya tomadas

- Cada mes se **guarda y cierra a mano**; cerrado = solo consulta. Se puede reabrir.
- Al cerrar un mes por primera vez se congelan sus categorías y límites (`meses[mes].cats`); un mes con copia congelada no permite editar categorías y conserva sus gastos aunque la categoría se borre después.
- Cada mes nuevo empieza con el ingreso principal en 0.
- **Gastos fijos** (Netflix, deudas…): se definen una vez en el mes en que empiezan y salen solos cada mes; **cuentan solos** en los gastos. Van todos en la pseudo-categoría «Gastos fijos» (`FIJOS`), **sin límite**. Indefinidos o «durante N meses» (muestra «cuota k de N»). Por mes: quitar solo de este mes, cambiar importe (solo este mes / desde este mes), dar de baja desde este mes, eliminar si fue un error. **Sin día de cobro** (el usuario no lo quiso). Al cerrar un mes se congela la lista (`meses[mes].fijos`); al reabrir se vuelve a calcular desde las definiciones.
- **Ingresos extra**: lista por mes con tipo (Trabajo extra, Venta, Regalo, Otros) + concepto libre. Ahorro = ingreso principal + extras − gastos. Un mes con solo gastos fijos no cuenta como «con datos» en el índice.
- **Apple Pay (opción 1, sin servidor)**: una automatización «Transacción» de Atajos copia `PRESUPUESTO;<Importe>;<Comercio>` al portapapeles; en la app, «Pegar compra de Apple Pay» lo lee (`navigator.clipboard.readText`, con recuadro de pegar como alternativa) y abre la misma hoja de confirmación que los tickets. Instrucciones para el usuario en Ajustes → «Conectar Apple Pay». Si lo pegado parece una recarga de Revolut (`isTopUp`: revolut, top up, recarga…), avisa y no lo apunta salvo que el usuario pulse «Es un gasto, apuntarlo». La opción 2 (servidor tipo Supabase/Firebase que recibe las compras y sincroniza los datos) queda para más adelante.
- Al final de cada mes: comparación con el mes anterior (frase resumen, totales, dónde más subió y bajó el gasto, tabla por categoría).
- Los datos viven solo en el dispositivo; Ajustes tiene exportar/importar copia `.json`.
- **Escanear ticket** (opción A, OCR en el iPhone con Tesseract.js): siempre muestra una hoja de confirmación editable. Si no reconoce la categoría, pregunta. Dos botones: «Hacer foto» (cámara) y «Elegir captura» (galería, para entradas y recibos digitales). Las capturas en modo oscuro se invierten antes de leerlas. Recuerda la categoría elegida por comercio en `data.comercios` (nombre normalizado → id). **La foto no se guarda nunca.** Opción B (IA con Claude vía un pequeño servidor) queda para más adelante si la A falla mucho.

## Estilo Moderna (tokens en `:root` de `app.css`)

fondo `#f3f5f8` · tarjetas `#ffffff` radio 20 · texto `#111827` · secundario `#5f6b7a` · acento verde azulado `#0f766e` (suave `#d9f2ee`) · pasado de límite naranja `#c2410c` (texto `#9a3412`, suave `#ffedd5`) · tarjeta principal oscura `#111827` con acento `#7ee0cf`. Botones radio 14. Arriba de cada mes, la tarjeta oscura muestra **lo gastado este mes** en grande (no el ahorro), % de lo que entró, barra de progreso y tres cajitas: Principal (editable), Extra, Ahorro. Categorías: nombre + pastilla (% o «+X € pasado»), barra fina medida contra su propio límite, «x de y».

## Probar

`npx http-server -p 8765 -c-1 .` y abrir con Playwright en el dispositivo "iPhone 13".
