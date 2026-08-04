const VERSION = "mercadofood-entregador-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Dados de clientes, pedidos e localização não são armazenados em cache.
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "" };
  }
  event.waitUntil(self.registration.showNotification(payload.title || "MercadoFood Entregador", {
    body: payload.body || "Você recebeu uma atualização de corrida.",
    icon: "/mercadofood-icon.svg",
    badge: "/mercadofood-icon.svg",
    data: { url: payload.url || "/entregador" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/entregador"));
});

void VERSION;
