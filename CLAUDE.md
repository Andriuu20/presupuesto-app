# Presupuesto (PWA) — notas para continuar

App web instalable en iPhone (Safari → Compartir → Añadir a pantalla de inicio) para llevar un presupuesto mensual. Sin Mac ni App Store: es una PWA publicada con GitHub Pages.

- Web: https://andriuu20.github.io/presupuesto-app/
- Publicación: cada push a `main` redespliega GitHub Pages (Settings → Pages → Deploy from a branch → main, / root).
- El usuario escribe en español y prueba desde un iPhone 13. Antes de cambios grandes, enseñar un borrador (wireframe en texto) y esperar su visto bueno.

## Archivos

- `index.html`: dos pantallas, `#screen-index` (índice de meses del año) y `#screen-month` (un mes).
- `app.js`: toda la lógica, sin dependencias. Guarda en `localStorage` con la clave `presupuesto-v1`.
- `app.css`: tokens de color del sistema de diseño Bloom (tema Finanzas por defecto; Daylight y Night por selector).
- `sw.js`: caché sin conexión. **Sube el número de `CACHE` en cada cambio** para que el iPhone descargue la versión nueva.
- `manifest.webmanifest`, `icons/`: nombre, colores e icono (fondo navy con tres barras).
- `receipt-parse.js`: interpreta el texto de un ticket (comercio, total, fecha, pista de categoría). Funciones puras, se pueden probar con `node`.
- `vendor/ocr/`: Tesseract.js 5.1.1 + datos de español (`spa` best_int), incluidos en el repo para funcionar sin CDN ni conexión. Se cargan solo al primer escaneo.

## Modelo de datos (localStorage)

```
{ categorias: [{id, nombre, limite}],
  gastos: [{id, concepto, importe, categoria, fecha "YYYY-MM-DD", creado}],
  meses: { "YYYY-MM": { ingresos, cerrado, cats: [{id, nombre, limite}] } },
  comercios: { "mercadona": catId, ... },
  tema: "business" | "light" | "dark" }
```

## Decisiones ya tomadas

- Cada mes se **guarda y cierra a mano**; cerrado = solo consulta. Se puede reabrir.
- Al cerrar un mes por primera vez se congelan sus categorías y límites (`meses[mes].cats`); un mes con copia congelada no permite editar categorías y conserva sus gastos aunque la categoría se borre después.
- Cada mes nuevo empieza con ingresos en 0.
- Al final de cada mes: comparación con el mes anterior (frase resumen, totales, dónde más subió y bajó el gasto, tabla por categoría).
- Los datos viven solo en el dispositivo; Ajustes tiene exportar/importar copia `.json`.
- **Escanear ticket** (opción A, OCR en el iPhone con Tesseract.js): siempre muestra una hoja de confirmación editable. Si no reconoce la categoría, pregunta. Recuerda la categoría elegida por comercio en `data.comercios` (nombre normalizado → id). **La foto no se guarda nunca.** Opción B (IA con Claude vía un pequeño servidor) queda para más adelante si la A falla mucho.

## Tokens de color (tema Finanzas)

navy `#0b1f3a` (texto, barra superior, botón principal) · cobalt `#1d4ed8` (acciones, ahorro positivo) · crimson `#b42318` (gasto excesivo, negativos) · cloud `#f5f7fa` (fondo) · white `#ffffff` (tarjetas) · steel `#5b6b82` (texto secundario) · gold `#c9a227` (acento, nunca texto sobre blanco). Tipografía Arial. Radios 5 / 10 / 50px.

## Probar

`npx http-server -p 8765 -c-1 .` y abrir con Playwright en el dispositivo "iPhone 13".
