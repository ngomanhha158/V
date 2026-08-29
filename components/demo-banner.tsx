import Link from 'next/link'
import { IcCanh } from '@/components/icons'

/**
 * Dải cảnh báo trên mọi màn demo. Cố ý nổi và không tắt được: người xem phải
 * biết ngay đây là số bịa. Một ảnh chụp màn demo lọt vào cuộc họp mà bị tưởng
 * là số thật thì hại hơn nhiều so với chuyện nó chiếm mất một dòng.
 */
export function DemoBanner() {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-card border border-warn-line bg-warn-soft px-3.5 py-3 text-[0.8125rem] text-warn">
      <IcCanh className="mt-0.5 shrink-0" width={16} height={16} />
      <p className="leading-relaxed">
        <b className="font-semibold">Bản demo — dữ liệu giả.</b>{' '}
        Màn này bỏ qua đăng nhập và không kết nối database. Mọi tên người, số
        điện thoại và số tiền đều là bịa.{' '}
        <Link href="/" className="font-medium underline underline-offset-2">
          Bản chạy thật
        </Link>
      </p>
    </div>
  )
}
