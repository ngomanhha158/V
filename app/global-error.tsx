'use client'

/**
 * Vỏ bắt lỗi CUỐI CÙNG — dùng khi chính app/layout.tsx hỏng, lúc đó error.tsx
 * cũng không dựng được vì nó nằm bên trong layout ấy. File này phải tự dựng cả
 * <html> và <body>, và KHÔNG được dùng lại component hay CSS token nào của app:
 * thứ hỏng có thể chính là chúng.
 */
export default function LoiToanCuc({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, background: '#fff', color: '#101828',
                     font: '16px/1.6 system-ui, -apple-system, sans-serif' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 16px' }}>
          <h1 style={{ fontSize: 20, margin: 0, color: '#b42318' }}>
            Ứng dụng không khởi động được
          </h1>
          <p style={{ marginTop: 8, color: '#525f72' }}>
            Đây là sự cố ở phía máy chủ. Báo người quản trị hệ thống kèm mã bên dưới.
          </p>
          {error.digest && (
            <p style={{ marginTop: 16, padding: '12px 14px', border: '1px solid #e7eaee',
                        borderRadius: 10, fontFamily: 'ui-monospace, monospace',
                        fontWeight: 600, wordBreak: 'break-all' }}>
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, height: 40, padding: '0 14px', borderRadius: 8,
                     border: 0, background: '#2563eb', color: '#fff',
                     font: '500 14px system-ui', cursor: 'pointer' }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  )
}
