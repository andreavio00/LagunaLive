const CACHE_NAME = "lagunalive-shell-v1";

// Solo la "cornice" dell'app (HTML/CSS/JS/icone) viene messa in cache:
// i dati meteo restano sempre presi dalla rete in tempo reale, cosi'
// l'app si apre subito anche con connessione lenta o assente, ma non
// mostra mai dati vecchi spacciandoli per aggiornati.
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./stations.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {

  const url = new URL(event.request.url);

  const isShellFile =
    url.origin === self.location.origin &&
    SHELL_FILES.some((file) => url.pathname.endsWith(file.replace("./", "")));

  if (!isShellFile) {
    // Dati meteo e altre richieste esterne: sempre dalla rete.
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {

      const network = fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
