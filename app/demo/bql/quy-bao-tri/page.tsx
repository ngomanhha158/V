import { Card, CardHead, Hop, PageHead } from '@/components/ui'
import { QuySo } from '@/components/quy-so'
import { DONG, NGAN_HANG, NGAY_DC, SO_DU_NH, SO_TK } from '../../quy-mock'

// homNay cố định để câu "đối chiếu N ngày trước" không đổi theo ngày chụp ảnh.
const HOM_NAY = new Date('2026-05-06T00:00:00Z')

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Quỹ bảo trì 2%"
        sub="Tiền của cư dân — sổ riêng, chi phải có nghị quyết BQT, và cả tòa đọc được"
      />

      <QuySo
        dong={DONG}
        nganHang={NGAN_HANG}
        soTaiKhoan={SO_TK}
        soDuNganHang={SO_DU_NH}
        doiChieuNgay={NGAY_DC}
        homNay={HOM_NAY}
        hanhDong={(d) =>
          d.da_dao || d.la_dong_dao ? null : (
            <span className="inline-flex h-8 items-center rounded-lg border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
              Đảo
            </span>
          )
        }
      />

      <Card>
        <CardHead title="Ghi bút toán" />
        <div className="p-4 text-[0.8125rem] leading-relaxed text-muted">
          Form ghi bút toán. Chọn <strong>Chi từ quỹ</strong> là hiện thêm ô{' '}
          <strong>số nghị quyết</strong> và <strong>ngày nghị quyết</strong>, cả
          hai bắt buộc — thiếu thì hệ thống không ghi. Số tiền luôn nhập số dương,
          loại bút toán quyết định dấu.
        </div>
      </Card>

      <Hop tone="trung" title="Chưa làm: đính kèm file biên bản BQT">
        Hệ thống bắt ghi <strong>số</strong> và <strong>ngày</strong> nghị quyết
        cho mọi khoản chi, nhưng chưa lưu được bản scan biên bản. Trong lúc chờ,
        giữ bản giấy theo số nghị quyết đã ghi ở đây.
      </Hop>
    </div>
  )
}
