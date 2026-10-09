const CACHE = "fahdrik-v62";
const FILES = ["./", "index.html", "styles.css", "app.js", "calendar.js", "todo.js", "shopping.js", "recipes.js", "watch.js", "reading.js", "wishes.js", "bucket.js", "config.js", "cloud.js", "icon.svg", "manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x))))));
self.addEventListener("fetch", (e) =>
  e.respondWith(fetch(e.request, { cache: "no-store" }).catch(() => caches.match(e.request))));
