'use client'

/**
 * Vỏ bắt lỗi cho mọi màn.
 *
 * Không có file này thì mọi sự cố phía máy chủ đều hiện ra đúng ba chữ
 * "Internal Server Error" — người dùng không biết phải làm gì, và người trực
 * ban không có gì để báo lại. Next cố ý KHÔNG đưa nội dung lỗi xuống trình
 * duyệt ở bản production (nội dung lỗi có thể chứa tên bảng, câu truy vấn),
 * nhưng nó có đưa `digest`: một mã ngắn xuất hiện y hệt trong log của Railway.
 * Chép mã đó vào tin nhắn là tìm ra đúng dòng log trong vài giây.
 */
export default function Loi({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-card border border-bad-line bg-bad-soft px-5 py-4">
        <h1 className="text-lg font-bold text-bad">Màn này đang lỗi</h1>
        <p className="mt-1 text-[0.875rem] leading-relaxed text-muted">
          Sự cố nằm ở phía máy chủ, không phải do bạn thao tác sai. Thử lại một
          lần; vẫn vậy thì báo ban quản lý kèm mã bên dưới.
        </p>
      </div>

      {error.digest && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <p className="text-[0.75rem] text-faint">Mã sự cố — chép nguyên khi báo lỗi</p>
          <p className="num mt-1 text-[0.9375rem] font-semibold break-all text-ink">{error.digest}</p>
          <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
            Mã này xuất hiện đúng một lần trong log của Railway, ở dòng ghi lại
            sự cố — người quản trị tìm ra nguyên nhân bằng cách tra mã.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center rounded-lg border border-transparent bg-brand px-3.5 text-sm font-medium text-on-brand hover:bg-brand-deep"
        >
          Thử lại
        </button>
        <a
          href="/"
          className="inline-flex h-10 items-center rounded-lg border border-line-firm bg-surface px-3.5 text-sm font-medium text-ink hover:bg-sunken"
        >
          Về trang chủ
        </a>
      </div>
    </main>
  )
}
