import { LinkButton } from '@/components/ui'

// Không nằm trong vỏ nào (cư dân hay BQL) vì 404 có thể rơi vào bất kỳ đường
// dẫn nào, kể cả khi chưa đăng nhập.
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="num text-[2.5rem] leading-none font-semibold text-line-firm">404</p>
        <h1 className="mt-3 text-lg font-semibold text-ink">Không tìm thấy trang này</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-muted">
          Đường dẫn không tồn tại, hoặc dữ liệu ở đây không thuộc quyền xem của
          bạn — hệ thống không phân biệt hai trường hợp đó để tránh lộ thông tin.
        </p>
        <div className="mt-5 flex justify-center">
          <LinkButton href="/" dang="chinh" co="sm">Về trang chủ</LinkButton>
        </div>
      </div>
    </div>
  )
}
