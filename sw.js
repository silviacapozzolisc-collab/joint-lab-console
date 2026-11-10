/* Joint Lab Console — offline cache.
 *
 * The desktop launcher starts a tiny local server (http://localhost:47615) that
 * stops by itself after a while. This worker keeps a copy of the app so that a
 * reload (Ctrl+R / Cmd+R) still works when that server is gone.
 *
 * Strategy: network first (a newly installed version always wins), cache as fallback.
 * Nothing here ever talks to the internet: only same-origin files are handled.
 */
const CACHE = "jlc-1.1.1";
const SHELL = ["./", "index.html", "manifest.webmanifest",
  "icon-32.png", "icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("jlc-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2500);
      const res = await fetch(req, { signal: ctl.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = (await cache.match(req, { ignoreSearch: true })) ||
                  (req.mode === "navigate" ? await cache.match("index.html") : null);
      return hit || new Response("Joint Lab Console is offline: close this window and open it again from the desktop icon.",
        { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
