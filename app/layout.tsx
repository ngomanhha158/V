import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { DangKySW } from '@/components/pwa'

// Inter có bộ dấu tiếng Việt đầy đủ và vẽ đúng (ế, ữ, ỗ không bị dấu chồng lệch).
// next/font tải về lúc build rồi tự host: không có request nào chạy ra Google
// lúc người dùng mở trang, nên không lộ IP cư dân và không phụ thuộc mạng ngoài.
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'VBuilding', template: '%s · VBuilding' },
  description: 'Hệ điều hành khu dân cư — vận hành, yêu cầu và thu phí',
  // iOS bỏ qua manifest cho phần biểu tượng: nó chỉ đọc apple-touch-icon.
  // Thiếu dòng này thì "Thêm vào MH chính" trên iPhone ra một ô trắng chụp
  // màn hình trang web, nhìn như app hỏng.
  appleWebApp: { capable: true, title: 'VBuilding', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
}

// Chạy TRƯỚC khi trình duyệt vẽ khung hình đầu tiên. Không có nó thì người chọn
// nền tối vẫn thấy loé trắng mỗi lần tải trang — lỗi vặt nhưng thấy ngay và
// làm sản phẩm trông rẻ tiền.
const CHONG_NHAY = `try{var t=localStorage.getItem('vb-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Next phát `mobile-web-app-capable` (tên chuẩn mới). iOS đọc chế độ
            standalone từ manifest nên phần chính đã đủ, nhưng bản có tiền tố
            apple- vẫn cần cho ảnh khởi động và iPhone đời cũ. Next không có
            API phát nó, nên viết tay. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: CHONG_NHAY }} />
      </head>
      {/* Bề rộng và điều hướng do từng vỏ màn tự lo (ResidentShell / BqlShell).
          Ép ở đây thì lớp con không nới ra được nữa. */}
      <body>
        <DangKySW />
        {children}
      </body>
    </html>
  )
}
