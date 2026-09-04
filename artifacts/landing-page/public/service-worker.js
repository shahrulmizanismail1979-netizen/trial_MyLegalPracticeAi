/* LAWYes only precaches its public application shell. User and API data stay network-only. */
const CACHE_NAME = "lawyes-public-shell-v1";
const STATIC_APP_SHELL = [
  "./",
  "./index.html",
  "./lawyes-logo.png",
  "./logo.svg",
  "./favicon.svg",
];

const staticShellPaths = new Set(
  STATIC_APP_SHELL.map((asset) => new URL(asset, self.registration.scope).pathname),
);

const isApiRequest = (url) =>
  url.pathname === "/api" || url.pathname.startsWith("/api/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("lawyes-public-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API, authenticated, chat, upload, and third-party requests are always network-only.
  if (request.method !== "GET" || url.origin !== self.location.origin || isApiRequest(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const shellPath = new URL("./", self.registration.scope).pathname;
        if (url.pathname === shellPath) {
          return (await caches.match("./")) || (await caches.match("./index.html"));
        }
        throw new Error("Navigation unavailable offline");
      }),
    );
    return;
  }

  if (staticShellPaths.has(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
  }
});