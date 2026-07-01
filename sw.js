const CACHE = 'cirkel-train-v1';
const STATIC = ['/player.html', '/index.html', '/manifest.json', '/sw.js'];

// ─── Install: cache static shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// ─── Activate: remove old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
// /udstraek.mp4 is never on the server — only in cache (put there by the page
// after decryption).  All other assets use a normal cache-first strategy.
self.addEventListener('fetch', event => {
  const { pathname } = new URL(event.request.url);

  if (pathname === '/udstraek.mp4') {
    event.respondWith(serveVideo(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});

async function serveVideo(request) {
  const cache  = await caches.open(CACHE);
  const cached = await cache.match('/udstraek.mp4');

  if (!cached) {
    return new Response('Video not available — open the player online with the decrypt URL.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  const range = request.headers.get('range');
  if (!range) return cached;

  // Slice the cached ArrayBuffer to satisfy the Range request
  const data = await cached.arrayBuffer();
  return buildRangeResponse(data, range);
}

function buildRangeResponse(buffer, rangeHeader) {
  const total = buffer.byteLength;
  const m     = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
  if (!m) {
    return new Response(buffer, { status: 200, headers: { 'Content-Type': 'video/mp4' } });
  }
  const from = +m[1];
  const to   = m[2] ? Math.min(+m[2], total - 1) : total - 1;
  const body = buffer.slice(from, to + 1);
  return new Response(body, {
    status: 206,
    headers: {
      'Content-Range':  `bytes ${from}-${to}/${total}`,
      'Content-Length': String(body.byteLength),
      'Content-Type':   'video/mp4',
      'Accept-Ranges':  'bytes',
    },
  });
}
