const CACHE_NAME = "lagunalive-shell-v9";

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

  // Rete prima, cache come ripiego. In precedenza faceva il contrario
  // (cache prima, rete solo se mancava): una volta scaricata la prima
  // volta, la cache restava quella per sempre, quindi ogni aggiornamento
  // (icona compresa) non veniva mai visto finche' non si svuotava la
  // cache manualmente. Cosi' invece si vede sempre la versione piu'
  // recente quando c'e' connessione, e quella salvata solo se offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
