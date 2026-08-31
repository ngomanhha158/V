import type { MetadataRoute } from 'next'

/**
 * PWA manifest. Đây là thứ biến "một tab trình duyệt sẽ lạc mất" thành một
 * biểu tượng nằm trên màn hình chính — cách duy nhất để cư dân quay lại app
 * mà không phải nhớ tên miền, và là điều kiện bắt buộc để iOS cho phép nhận
 * thông báo đẩy (iOS chỉ gửi web push cho app đã Add to Home Screen).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VBuilding — App cư dân',
    // short_name hiện dưới biểu tượng trên màn hình chính. Dài quá thì Android
    // và iOS đều cắt bằng "…", nên giữ ngắn hơn tên đầy đủ.
    short_name: 'VBuilding',
    description: 'Hóa đơn, yêu cầu sửa chữa, thông báo và nội quy của khu dân cư.',
    lang: 'vi',
    start_url: '/',
    scope: '/',
    // standalone: mở ra không có thanh địa chỉ, trông như app thật. Không dùng
    // fullscreen vì che mất đồng hồ và pin — cư dân mở app lúc đang làm việc khác.
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8fa',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // maskable riêng: Android cắt icon theo mặt nạ của máy (tròn, vuông bo,
      // giọt nước). Dùng chung icon 'any' là bị gọt mất góc.
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
