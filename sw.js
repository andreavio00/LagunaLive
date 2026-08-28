const CACHE_NAME = "lagunalive-shell-v3.2";

// Solo la "cornice" dell'app (HTML/CSS/JS/icone) viene messa in cache:
// i dati meteo restano sempre presi dalla rete in tempo reale, cosi'
// l'app si apre subito anche con connessione lenta o assente, ma non
// mostra mai dati vecchi spacciandoli per aggiornati.
//
// app.js e style.css includono "?v=..." nell'indirizzo (deve
// corrispondere a quello scritto in index.html): senza, il browser
// puo' continuare a servire una versione vecchia dalla propria cache
// HTTP anche dopo che questo Service Worker si e' aggiornato - sono
// due cache indipendenti (bug reale riscontrato il 22/08/2026).
const SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css?v=3.2",
  "./app.js?v=3.2",
  "./manifest.json",
  "./stations.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // Icone meteo usate da previsioni-render.js (iconaPer/fileIcona):
  // precaricate cosi' previsioni.html mostra le icone giuste anche
  // offline, non solo la struttura della pagina.
  "./icons/sole.png",
  "./icons/luna.png",
  "./icons/poco_nuvoloso.png",
  "./icons/poco_nuvoloso_notte.png",
  "./icons/nuvoloso.png",
  "./icons/pioggia.png",
  "./icons/temporale.png",
  "./icons/neve.png",
  "./icons/nebbia.png",
  // Pagina previsioni: stessa logica di cache-busting/precache della
  // shell principale, cosi' anche lei si aggiorna forzatamente ad ogni
  // rilascio e funziona offline dopo la prima visita.
  "./previsioni.html",
  "./previsioni.css?v=3.2",
  "./osservazioni.js?v=3.2",
  "./previsioni-data.js?v=3.2",
  "./previsioni-render.js?v=3.2"
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

  // Il confronto usa solo il percorso "base" del file (senza "./" e
  // senza l'eventuale "?v=..."), perche' url.pathname non include mai
  // la query string: senza questa pulizia, le voci con "?v=..." in
  // SHELL_FILES non troverebbero mai corrispondenza.
  const isShellFile =
    url.origin === self.location.origin &&
    SHELL_FILES.some((file) => {
      const basePath = file.replace("./", "").split("?")[0];
      return url.pathname.endsWith(basePath);
    });

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
