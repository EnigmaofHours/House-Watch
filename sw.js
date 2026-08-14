/* ============================================================
   House Watch — offline shell.

   The board is one self-contained page: no fonts, no CDN, no
   framework. So "works offline" only ever needed four files
   cached. Everything the app does apart from live weather runs
   from what is already in the browser.

   BUMP `CACHE` WHENEVER index.html OR AN ICON CHANGES.
   The old cache is deleted on activate, so a stale build cannot
   outlive the bump — but forget to bump and phones will keep
   serving the previous version indefinitely.
   ============================================================ */
var CACHE = "housewatch-v3-1";

var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* Open-Meteo, the National Weather Service and the ZIP lookup are left
     alone deliberately. A cached weather alert is worse than no weather
     alert — the board already caches the last reading itself, stamps it
     with the time it was taken, and hides it once it goes stale. */
  if (url.origin !== self.location.origin) return;

  /* Navigations go to the network first so a new build lands as soon as
     there is signal, and fall back to the cached page when there is none. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok) {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        }
        return r;
      })["catch"](function () {
        return caches.match("./index.html").then(function (m) {
          return m || caches.match("./");
        });
      })
    );
    return;
  }

  /* Icons and the manifest never change without a cache bump, so serve
     them from disk and only reach for the network on a miss. */
  e.respondWith(
    caches.match(req).then(function (m) { return m || fetch(req); })
  );
});
