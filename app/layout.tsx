import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'VBuilding',
  description: 'Hệ điều hành khu dân cư',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="mx-auto max-w-lg p-4">{children}</body>
    </html>
  )
}
