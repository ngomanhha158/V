import Link from 'next/link'
import { ngayGioVN } from '@/components/ui'
import { khoangGio } from '@/lib/khach'

// Bản demo màn bảo vệ quét mã khách. Bỏ vỏ app y như màn thật — bảo vệ nhìn màn
// này nửa giây ở cửa với hàng người đang chờ.
const NAY = new Date('2026-09-03T09:00:00Z')

export default function Page() {
  return (
    <div className="mx-auto max-w-md p-4 pb-10">
      <div className="rounded-card bg-ok px-5 py-6 text-center text-white">
        <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">CHO VÀO</p>
        <p className="mt-1.5 text-[0.9375rem] leading-snug opacity-95">Khách của căn P1-12.04</p>
      </div>

      <div className="mt-3 rounded-card border border-line bg-surface p-4">
        <p className="text-[1.25rem] leading-tight font-bold text-ink">Nguyễn Thị Lan</p>
        <span className="num text-sm font-medium text-brand">0912 004 455</span>
        <dl className="mt-3 divide-y divide-line text-sm">
          <Dong nhan="Căn hộ" giatri="P1-12.04 · Park 1" />
          <Dong nhan="Người mời" giatri="Trần Thị Bích Ngọc" />
          <Dong nhan="Hẹn" giatri={khoangGio('2026-09-03T07:00:00Z', '2026-09-03T11:00:00Z', NAY)} />
          <Dong nhan="Lý do" giatri="Tới chơi" />
          <Dong nhan="Vào lúc" giatri="—" />
          <Dong nhan="Ra lúc" giatri="—" />
        </dl>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex h-12 w-full items-center justify-center rounded-lg border border-transparent bg-brand text-[0.9375rem] font-medium text-on-brand">
          Ghi giờ VÀO cho Nguyễn Thị Lan
        </div>
        <p className="text-[0.75rem] leading-relaxed text-faint">
          Mở trang này không ghi gì cả — soi thử thoải mái. Chỉ nút trên mới ghi vào sổ.
        </p>
      </div>

      <p className="mt-4 rounded-card border border-line bg-raised px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted">
        Màn xanh chỉ nói <strong className="text-ink">mã này hợp lệ</strong>. Hỏi
        tên người đứng trước bạn xem có khớp{' '}
        <strong className="text-ink">Nguyễn Thị Lan</strong> không — đây là bước
        hệ thống không làm thay được, và mã khách thì gửi qua Zalo nên chuyển
        tiếp cho ai cũng được.
      </p>

      <p className="mt-4 text-[0.8125rem]">
        <Link href="/demo/quet" className="font-medium text-brand hover:underline">Hướng dẫn quét</Link>
      </p>

      <p className="mt-6 text-[0.75rem] leading-relaxed text-faint">
        Bản demo. Màn thật ở <code className="num">/quet/k/&lt;mã&gt;</code>, mở ra
        từ app camera của bảo vệ. Quét lần nữa lúc khách về thì nút đổi thành
        &ldquo;Ghi giờ RA&rdquo;. Mã hết hạn, bị thu hồi hay đã ra rồi thì màn
        đỏ, và nói rõ bảo vệ phải làm gì tiếp — mỗi lý do một câu khác nhau,
        cập nhật lúc {ngayGioVN('2026-09-03T09:00:00Z')}.
      </p>
    </div>
  )
}

function Dong({ nhan, giatri }: { nhan: string; giatri: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-muted">{nhan}</dt>
      <dd className="text-right font-medium text-ink">{giatri}</dd>
    </div>
  )
}
