/* ==================================================================
   sw.js — تخزين "شكل" الموقع بس (HTML/CSS/JS) عشان أي صفحة من صفحات
   الموقع تقدر تفتح حتى لو مفيش نت خالص على الجهاز.

   ده مالوش أي علاقة ببيانات الطالب (المهام/الجلسات/الإشعارات) —
   ده شغل Firestore وحده عن طريق enablePersistence في index.html، وده
   شغّال بالفعل من غير أي حاجة هنا.

   ليه معدّل عن النسخة الأولى:
   - كان فيه باغ: أي صفحة تفتح (navigate) كانت بتتخزن دايمًا باسم
     "./index.html" حتى لو كانت admin.html — يعني admin.html كانت
     بترجع لنسخة index.html القديمة أوفلاين بدل نسختها هي. اتصلح: كل
     صفحة بتتخزن وبترجع باسمها هي بالظبط.
   - الكاش بقى عام (generic) مش قايمة ملفات مكتوبة يدويًا: أي ملف جديد
     من نفس الموقع (app.js, dashboard.js, style.css...) بيتخزن أوتوماتيك
     أول مرة يتطلب وهو أونلاين — من غير ما تحتاج تضيف اسمه هنا.
   - لو ضفت ميزة/قائمة/كود جديد *جوه* index.html أو admin.html نفسها
     (زرار جديد، تاب جديد، JS/CSS مكتوب جوه الملف): برضو مش محتاج تعدّل
     الملف ده، لأن الصفحة بتتحدّث من السيرفر نفسها أول ما يبقى فيه نت
     (network-first) وبتتحفظ نسخة جديدة تلقائي.
   - الوقت الوحيد اللي محتاج تلمس فيه الملف ده: لو عايز تجبر كل الأجهزة
     تمسح الكاش القديم كله وتاخد نسخة جديدة فورًا (نادر) — يبقى تغيّر
     رقم النسخة تحت (CACHE_VERSION) بس، مش أي حاجة تانية.

   السلوك:
   - فتح صفحة (index.html أو admin.html): نت أول، ولو فشل/بطيء يرجع
     للنسخة المحفوظة من نفس الصفحة بالظبط.
   - باقي الملفات (لو حصلت مستقبلًا): من الكاش الأول (أسرع)، مع تحديث
     هادئ في الخلفية من غير ما الطالب يحس بحاجة اسمها "تحميل" أو تظهرله
     أي رسالة.
   - كله بيتفعّل فورًا (skipWaiting + clients.claim) من غير ما يستنى
     قفل كل التابات، ومن غير أي prompt "فيه تحديث" يتعرض للطالب.
================================================================== */

const CACHE_VERSION = 'v1';
const CACHE_NAME = 'levelup-shell-' + CACHE_VERSION;

// الملفات المضمون وجودها من الأول. لو أي واحد فيها لسه مش مرفوع
// (مثلاً admin.html في أول نشر)، الباقي برضو بيتخزن عادي.
const KNOWN_SHELL_FILES = ['./', './index.html', './admin.html'];

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
