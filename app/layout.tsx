import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VBuilding',
  description: 'Hệ điều hành khu dân cư',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* Bề rộng do từng nhóm màn tự quyết: cư dân hẹp (điện thoại),
          BQL rộng (bảng biểu trên máy tính). Ép ở đây thì lớp con không
          nới ra được nữa. */}
      <body className="p-4">{children}</body>
    </html>
  )
}
