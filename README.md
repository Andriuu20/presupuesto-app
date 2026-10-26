# Presupuesto

App web instalable (PWA) para llevar un presupuesto mensual: ingresos, categorías con límite y gastos. Usa el tema Finanzas del sistema de diseño Bloom.

## Instalar en el iPhone

1. Abre la dirección de GitHub Pages de este repositorio en **Safari**.
2. Pulsa **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre la app desde su icono: se ve a pantalla completa y funciona sin conexión.

## Datos

Los datos se guardan solo en el dispositivo (localStorage). En **Ajustes → Copia de seguridad** puedes exportar un archivo `.json` e importarlo en otro dispositivo.

## Archivos

- `index.html`, `app.css`, `app.js`: la app.
- `manifest.webmanifest`, `icons/`: nombre, colores e iconos para instalarla.
- `sw.js`: service worker que guarda la app en caché para usarla sin conexión.
