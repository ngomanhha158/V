import { Khung, KhungBang, KhungStat, KhungThe } from '@/components/ui'

/**
 * Màn chờ dùng chung cho cả một nhánh route.
 *
 * Đặt một file loading.tsx ở app/bql là Next tự dùng nó cho toàn bộ 35 màn bên
 * dưới — không phải viết 35 lần, và không màn mới nào ra đời mà quên mất.
 *
 * BẮT CHƯỚC HÌNH DẠNG, không phải bắt chước nội dung. Khung phải cao xấp xỉ
 * thứ sắp thay nó, nếu không thì lúc dữ liệu về cả trang giật một cái — và một
 * cú giật còn khó chịu hơn là chờ trên nền trắng. Vì thế `dang` có hai kiểu:
 * màn của BQL gần như luôn là ô thống kê + bảng, màn của cư dân là các thẻ.
 */
export function KhungTrang({ dang = 'bang' }: { dang?: 'bang' | 'the' }) {
  return (
    <div>
      {/* Khớp số đo của PageHead: h1 1.375rem/1.5rem, phụ đề text-sm, mb-5. */}
      <div className="mb-5">
        <Khung className="h-7 w-52 sm:h-8" />
        <Khung className="mt-2 h-4 w-full max-w-md" />
      </div>

      {dang === 'bang' ? (
        <div className="space-y-5">
          <KhungStat />
          <KhungBang />
        </div>
      ) : (
        <div className="space-y-5">
          <KhungThe />
          <KhungThe dong={2} />
        </div>
      )}
    </div>
  )
}
