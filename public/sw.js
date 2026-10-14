// Service worker de BG Planner. Hace tres cosas y nada más:
//  1. Si una página no carga por falta de red, enseña /offline.html.
//  2. Pinta las notificaciones push que manda el servidor (src/lib/push.ts).
//  3. Al tocar una, abre (o reutiliza) la app en el enlace del aviso.
// No cachea la API ni ninguna página con datos: todo lo vivo va a la red.

const CACHE = "bgp-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      // Que la navegación no espere a que arranque el worker
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(event.request);
      } catch {
        const cached = await caches.match(OFFLINE_URL);
        return cached || Response.error();
      }
    })()
  );
});

// ── Push ────────────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "BG Planner";
  const options = {
    body: data.body || "Tienes una novedad",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    lang: "es",
    // Un aviso que se funde con otro (más respuestas en el mismo hilo)
    // sustituye al anterior en vez de apilarse.
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || "/notifications" },
  };

  const badge =
    typeof data.unread === "number" && "setAppBadge" in self.navigator
      ? data.unread > 0
        ? self.navigator.setAppBadge(data.unread)
        : self.navigator.clearAppBadge()
      : Promise.resolve();

  // Con la app abierta, que la campana se entere ya y no al minuto
  const tellOpenTabs = self.clients
    .matchAll({ type: "window" })
    .then((tabs) => tabs.forEach((tab) => tab.postMessage({ type: "bgp:push", unread: data.unread })));

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      badge.catch(() => {}),
      tellOpenTabs.catch(() => {}),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const same = windows.find((w) => w.url === url);
      if (same) return same.focus();
      const any = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (any && "navigate" in any) {
        await any.focus();
        return any.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});

// El navegador puede renovar la suscripción por su cuenta (caduca, cambia de
// clave…). Se vuelve a suscribir con la misma clave y se avisa al servidor.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const key = event.oldSubscription?.options?.applicationServerKey;
      const sub =
        event.newSubscription ||
        (key
          ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
          : null);
      if (!sub) return;
      await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(sub.toJSON()),
      });
    })().catch(() => {})
  );
});
