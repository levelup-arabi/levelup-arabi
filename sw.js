
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'levelup-shell-' + CACHE_VERSION;

// الملفات المضمون وجودها من الأول لكل الطلاب. admin.html متعمدين مش
// حاطينه هنا: ده sw.js واحد شغّال في متصفح كل طالب، فلو حطينا admin.html
// في القايمة دي هيتخزن على جهاز كل طالب من غير داعي (حتى لو محدش فاتحه).
// admin.html هيتخزن لوحده تلقائيًا في متصفح الأدمن بس، أول ما هو نفسه
// يفتحه وهو أونلاين — بفضل نفس آلية fetch العامة تحت، من غير أي تخصيص هنا.
const KNOWN_SHELL_FILES = ['./', './index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(KNOWN_SHELL_FILES.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // بس GET، وبس ملفات نفس الموقع — أي حاجة تانية (فايرستور، جوجل فونتس،
  // إلخ) تعدي عادي من غير ما الـ service worker يلمسها.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // فتح صفحة كاملة (index.html أو admin.html أو أي صفحة تانية تتضاف
  // مستقبلًا): نت الأول، وبنخزّنها باسمها هي بالظبط، ولو فشل الاتصال
  // نرجع لنسخة *نفس الصفحة دي* المحفوظة (مش نسخة تانية).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // أي ملف تاني من نفس الموقع (حالي أو هيتضاف مستقبلًا CSS/JS/صور):
  // من الكاش الأول لو موجود (أسرع وبيشتغل أوفلاين)، وبنحدّثه في الخلفية
  // بهدوء لما يبقى فيه نت، من غير ما نستنى الرد ده.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
