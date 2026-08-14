/* Contami — service worker
   Tiene in cache i file dell'app così funziona senza rete.
   I dati delle finanze NON passano di qui: restano in localStorage,
   sul dispositivo, e non vengono mai inviati da nessuna parte. */

const VERSIONE = "contami-v8";
const FILE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icone/icona-192.png",
  "./icone/icona-512.png",
  "./icone/maskable-192.png",
  "./icone/maskable-512.png",
  "./icone/apple-touch-icon.png",
  "./icone/favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSIONE)
      .then((c) => c.addAll(FILE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(
        chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* Per la pagina: prima la rete (così un aggiornamento arriva subito),
     con la cache come rete di salvataggio quando si è offline. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSIONE).then((c) => c.put("./index.html", copia));
          return r;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  /* Il manifest cambia, e servirne una copia vecchia impedisce a Chrome
     di installare l'app: qui la rete viene prima, la cache è solo la
     riserva per quando si è offline. */
  if (url.pathname.endsWith(".webmanifest") || url.pathname.endsWith("manifest.json")) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r && r.ok) {
            const copia = r.clone();
            caches.open(VERSIONE).then((c) => c.put(req, copia));
          }
          return r;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  /* Le icone invece non cambiano: prima la cache, è più veloce. */
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === "basic") {
        const copia = res.clone();
        caches.open(VERSIONE).then((c) => c.put(req, copia));
      }
      return res;
    }))
  );
});

/* Svuota tutta la cache su richiesta della pagina */
self.addEventListener("message", (e) => {
  if (e.data === "svuota") {
    e.waitUntil(
      caches.keys().then((k) => Promise.all(k.map((n) => caches.delete(n))))
    );
  }
});

/* Permette alla pagina di forzare l'attivazione di una nuova versione */
self.addEventListener("message", (e) => {
  if (e.data === "aggiorna") self.skipWaiting();
});
