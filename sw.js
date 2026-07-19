const VERSION = 'one80-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './fonts/dmsans-latin.woff2',
  './js/i18n.js',
  './js/store.js',
  './js/ui.js',
  './js/input.js',
  './js/games.js',
  './js/games-extra.js',
  './js/training.js',
  './js/training-extra.js',
  './js/stats.js',
  './js/tournament.js',
  './js/qr.js',
  './js/friends.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* Caller-Sprachclips: optional, werden einzeln gecacht und Fehler ignoriert –
   ohne audio-Ordner läuft die App mit der System-Stimme weiter.
   Ein komplettes Voice-Pack (0.mp3 … 180.mp3) landet hier absichtlich NICHT:
   181 Dateien würden die SW-Installation ausbremsen. Die holt der Fetch-Handler
   unten beim ersten Durchlauf einzeln in den Cache – die App lädt sie beim
   Start ohnehin vor. Danach ist alles offline verfügbar.                      */
const OPTIONAL = (() => {
  const a = ['no_score', 'bust', 'busted', 'game_shot', 'gameshot',
             'game_shot_match', 'matchshot', 'hundred', 'hundred_and', 'crowd'];
  for (let n = 1; n <= 19; n++) a.push('n' + n);
  for (let n = 20; n <= 90; n += 10) a.push('n' + n);
  return a.map(k => './audio/caller/' + k + '.mp3');
})();

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS)
        .then(() => Promise.all(OPTIONAL.map(u => c.add(u).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-First mit Timeout: online immer der aktuelle Stand, offline der Cache.
// (Vorher Cache-First – dadurch sahen installierte Nutzer nach Änderungen noch alte Versionen.)
const NET_TIMEOUT = 3000;

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), NET_TIMEOUT);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (!res || !res.ok) return reject(new Error('bad response'));
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      resolve(res);
    }).catch(err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fromNetwork(e.request).catch(() =>
      caches.match(e.request).then(hit =>
        hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())
      )
    )
  );
});
