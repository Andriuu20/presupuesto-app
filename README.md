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

## Meses

La pantalla de inicio muestra los 12 meses del año. Cada mes se puede **guardar y cerrar**: queda solo para consultar, con los límites de categoría que tenía ese día. Al final de cada mes hay una comparación con el mes anterior.

## Escanear tickets

En *Añadir gasto → Escanear ticket* haces una foto o eliges una de la galería. La app lee el comercio, el total y la fecha en el propio iPhone (no se envía a ningún sitio ni se guarda la foto) y te los muestra para confirmar. Si no sabe la categoría, te pregunta y la recuerda para la próxima vez.

El lector usa [Tesseract.js](https://github.com/naptha/tesseract.js) (licencia Apache 2.0), incluido en `vendor/ocr/`.

## Gastos fijos e ingresos extra

- **Gastos fijos**: suscripciones, cuotas o deudas. Los creas una vez y aparecen solos cada mes (todos los meses o durante un número de meses). Cada mes puedes quitarlos solo de ese mes, cambiar su importe o darlos de baja.
- **Ingresos extra**: ventas, horas extra, regalos… se suman al ingreso principal del mes.

## Compras con Apple Pay

Con una automatización de la app **Atajos** (disparador «Transacción»), cada pago con Apple Pay se copia al portapapeles. En la app, *Añadir gasto → Pegar compra de Apple Pay* lo convierte en un gasto para confirmar. Los pasos están en *Ajustes → Conectar Apple Pay*.
