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
