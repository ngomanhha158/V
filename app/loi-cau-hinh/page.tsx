import { kiemCauHinh } from '@/lib/db/env'

/**
 * Màn thay cho chữ "Internal Server Error".
 *
 * Thiếu một biến môi trường thì app ném lỗi — đúng, hỏng ồn ào hơn hỏng lặng
 * lẽ. Nhưng Next thay lỗi ném từ Server Component bằng đúng ba chữ "Internal
 * Server Error", nên câu hướng dẫn viết sẵn trong lib/db/env.ts không bao giờ
 * tới được người đang sửa. Họ nhìn thấy ba chữ đó và không biết bắt đầu từ đâu.
 *
 * Trang này KHÔNG chạm database và không đọc phiên — nó phải sống được đúng vào
 * lúc mọi thứ khác chết.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const loi = kiemCauHinh()

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-card border border-bad-line bg-bad-soft px-5 py-4">
        <h1 className="text-lg font-bold text-bad">Thiếu cấu hình, app chưa chạy được</h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
          Đây không phải lỗi của người dùng. Người quản trị cần đặt biến môi
          trường cho service <code className="num">v</code> trên Railway rồi deploy lại.
        </p>
      </div>

      {loi.length === 0 ? (
        <div className="mt-4 rounded-card border border-line bg-surface p-4 text-[0.875rem] leading-relaxed text-muted">
          Cấu hình hiện đã đủ. Nếu vẫn gặp lỗi thì nó đến từ chỗ khác — thử tải
          lại trang trước đó.
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {loi.map((l) => (
            <li
              key={l}
              className="rounded-card border border-line bg-surface p-4 text-[0.875rem] leading-relaxed text-ink"
            >
              {l}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 rounded-card border border-line bg-raised p-4 text-[0.8125rem] leading-relaxed text-muted">
        <p className="font-semibold text-ink">Đặt ở đâu</p>
        <p className="mt-1">
          Railway → service <code className="num">v</code> → tab <em>Variables</em>.
          Bước 6 của <code className="num">railway/GD1-runbook.sh</code> liệt kê đủ
          sáu biến: <code className="num">POSTGREST_URL</code>,{' '}
          <code className="num">AUTH_JWT_SECRET</code>, <code className="num">SMTP_URL</code>,{' '}
          <code className="num">SMTP_FROM</code>, <code className="num">ANH_DIR</code>,{' '}
          <code className="num">CRON_SECRET</code>.
        </p>
        <p className="mt-2">
          <code className="num">AUTH_JWT_SECRET</code> phải{' '}
          <strong className="text-ink">trùng khít</strong>{' '}
          <code className="num">PGRST_JWT_SECRET</code> của service PostgREST. Lệch một
          ký tự thì PostgREST từ chối mọi token và màn nào cũng trống.
        </p>
      </div>
    </main>
  )
}
