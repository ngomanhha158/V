// Service worker CỐ TÌNH LÀM RẤT ÍT.
//
// Đây là app tiền: hóa đơn, công nợ, số dư. Một service worker cache nhầm là
// cư dân thấy số tiền của tháng trước và tin đó là số hiện tại — hỏng theo kiểu
// không ai báo lỗi, và người dùng không có cách nào tự xóa cache.
//
// Nên nó chỉ làm đúng hai việc:
//   1. Có fetch handler -> trình duyệt cho phép cài đặt (Chrome đòi thứ này).
//   2. Mất mạng giữa chừng thì hiện một trang tử tế thay vì màn khủng long.
// KHÔNG cache HTML, KHÔNG cache dữ liệu, không phục vụ thứ gì cũ khi còn mạng.

const KHO = 'vbuilding-v1'
const TRANG_OFFLINE = '/offline.html'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(KHO).then((c) => c.add(TRANG_OFFLINE)))
  // Bản mới thay bản cũ ngay, không đợi tab hiện tại đóng. An toàn vì
  // worker này không giữ trạng thái gì.
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const ten of await caches.keys()) if (ten !== KHO) await caches.delete(ten)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  // CHỈ đụng vào điều hướng trang. Mọi request khác (dữ liệu, ảnh, script)
  // đi thẳng ra mạng, worker không biết tới.
  if (e.request.mode !== 'navigate') return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(TRANG_OFFLINE).then(
      (r) => r ?? new Response('Mất kết nối', { status: 503 }),
    )),
  )
})

// ── Thông báo đẩy ────────────────────────────────────────────────────────────
// Ngoại lệ có chủ ý với câu "worker này làm rất ít" ở trên: push BẮT BUỘC phải
// xử lý trong service worker, trình duyệt không cho chỗ nào khác. Nó vẫn không
// cache gì và không giữ trạng thái gì.

self.addEventListener('push', (e) => {
  // Không có payload thì vẫn phải hiện MỘT thứ gì đó: Chrome thu hồi quyền đẩy
  // của cả web app nếu nhận push mà không hiện thông báo.
  let d = { title: 'VBuilding', body: 'Bạn có thông báo mới', url: '/thong-bao', tag: 'chung' }
  try { d = { ...d, ...(e.data ? e.data.json() : {}) } } catch { /* payload hỏng, dùng mặc định */ }

  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // tag: thông báo cùng loại cùng id thì đè lên nhau thay vì xếp chồng. Job
    // nền chạy lại không làm màn hình khoá đầy những bản sao giống hệt.
    tag: d.tag,
    data: { url: d.url },
    lang: 'vi',
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/thong-bao'
  e.waitUntil((async () => {
    // Đang mở sẵn một tab thì DÙNG LẠI tab đó. Mở tab mới mỗi lần bấm là sau
    // một tuần cư dân có mười tab VBuilding và không biết tab nào là mới.
    const ds = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of ds) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus()
        if ('navigate' in c) await c.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
