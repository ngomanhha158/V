import { Card, CardHead, Hop, PageHead, Pill } from '@/components/ui'
import { BIEU_PHI, DU_AN } from '@/lib/demo/data'
import { DanhSachPhiDemo, FormThemDemo } from './bieu-phi-demo'

export const dynamic = 'force-dynamic'

export default async function DemoBieuPhi() {
  const ds = BIEU_PHI

  return (
    <div className="space-y-5">
      <PageHead
        title="Biểu phí"
        sub={`${DU_AN.ten} · ${ds.length} loại phí`}
        actions={<Pill tone="tot">Đã cấu hình</Pill>}
      />

      <Hop tone="trung" title="Sửa giá không đụng tới hóa đơn đã phát">
        Hóa đơn lưu lại đơn giá tại thời điểm sinh ra, nên đổi giá ở đây chỉ áp cho
        những kỳ sinh về sau. Cư dân mở lại hóa đơn tháng trước vẫn thấy đúng con số
        họ đã trả — đó là lý do màn này không cho sửa <strong>mã phí</strong>: mã đã
        nằm trong sổ sách kế toán, đổi là mất dấu vết.
      </Hop>

      <Card>
        <CardHead title="Thêm loại phí" sub="Mã phí đặt xong thì không đổi được" />
        <FormThemDemo />
      </Card>

      <Card>
        <CardHead title="Đang áp dụng" right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>} />
        <DanhSachPhiDemo ds={ds} />
      </Card>
    </div>
  )
}
