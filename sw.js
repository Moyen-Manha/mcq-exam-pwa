// আপডেট দিলে এই ভার্সন নম্বর বাড়ান (v2 -> v3), তাহলে পুরনো ক্যাশ মুছে নতুন কোড লোড হবে
const CACHE_NAME = 'mcq-pwa-v3';

// রিলেটিভ পাথ — GitHub Pages সাব-ফোল্ডারেও কাজ করবে
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // শুধু GET রিকোয়েস্ট হ্যান্ডেল করব
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firestore / Firebase / Gemini API কল কখনো ক্যাশ করা যাবে না (সবসময় লাইভ ডেটা লাগবে)
  const isApiCall =
    (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') ||
    url.hostname.endsWith('firebaseio.com');
  if (isApiCall) return;

  // পেজ (HTML): আগে নেটওয়ার্ক, না পেলে ক্যাশ — এতে নতুন আপডেট সাথে সাথে পৌঁছায়
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // স্ট্যাটিক ফাইল (আইকন, ফন্ট, Tailwind, Firebase SDK): ক্যাশ থেকে দেখাও, ব্যাকগ্রাউন্ডে আপডেট করো
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetching;
    })
  );
});
