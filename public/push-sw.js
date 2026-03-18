self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  event.waitUntil(
    self.registration.showNotification(payload.title || "Evyta", {
      body: payload.body || "You have an update on Evyta",
      icon: "/brand/favicon.svg",
      badge: "/brand/favicon.svg",
      tag: payload.tag || "evyta-update",
      silent: Boolean(payload.silent),
      data: { url: payload.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(clients.openWindow(url));
});
