import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'

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
        <script dangerouslySetInnerHTML={{ __html: CHONG_NHAY }} />
      </head>
      {/* Bề rộng và điều hướng do từng vỏ màn tự lo (ResidentShell / BqlShell).
          Ép ở đây thì lớp con không nới ra được nữa. */}
      <body>{children}</body>
    </html>
  )
}
