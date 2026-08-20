const CACHE_NAME = "lagunalive-shell-v2.23";

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

  // "Stale-while-revalidate": risponde subito con quello che c'e' in
  // cache (veloce), e in parallelo scarica dalla rete per aggiornare la
  // cache in vista della prossima visita. In precedenza si aspettava
  // sempre la rete prima di mostrare qualsiasi cosa, il che teneva tutto
  // aggiornato ma rendeva il caricamento piu' lento ad ogni apertura.
  // Ora non serve piu' pagare quel prezzo: l'aggiornamento immediato e'
  // gestito a parte, in app.js, che forza un controllo della versione e
  // ricarica la pagina da solo quando trova qualcosa di piu' recente.
  event.respondWith(
    caches.match(event.request).then((cached) => {

      const networkFetch = fetch(event.request)
        .then((response) => {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
