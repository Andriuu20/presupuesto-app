// Network first: online, always the latest version (and refresh the cache);
// offline, the cached copy. Bump CACHE on every change.
var CACHE = "presupuesto-v13";
var FILES = [
  "./",
  "index.html",
  "app.css",
  "app.js",
  "receipt-parse.js",
  "export-xlsx.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "fonts/manrope-latin-400-normal.woff2",
  "fonts/manrope-latin-600-normal.woff2",
  "fonts/manrope-latin-700-normal.woff2",
  "fonts/manrope-latin-800-normal.woff2"
];

self.addEventListener("install", function (e) {
  // cache: "reload" skips the browser's HTTP cache, so a fresh deploy is not cached stale.
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(FILES.map(function (f) { return new Request(f, { cache: "reload" }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.open(CACHE).then(function (c) {
        return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
          return hit || (e.request.mode === "navigate" ? c.match("index.html") : undefined) || Response.error();
        });
      });
    })
  );
});
