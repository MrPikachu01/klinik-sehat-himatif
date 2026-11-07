/* sw.js - service worker: menampilkan notifikasi push antrian walau halaman ditutup */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (x) { d = { judul: "Klinik Sehat", isi: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.judul || "Klinik Sehat", { body: d.isi || "", icon: "assets/himatif.png", badge: "assets/himatif.png", tag: "antrian", renotify: true, vibrate: [200, 100, 200], data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(l => { for (const c of l) if ("focus" in c) return c.focus(); return clients.openWindow((e.notification.data && e.notification.data.url) || "./"); }));
});
