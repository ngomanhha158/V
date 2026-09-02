import { Hop, PageHead, Pill } from '@/components/ui'
import { CAN_HO, DU_AN } from '@/lib/demo/data'
import { CanHoDemoManHinh } from './can-ho-demo'

export const dynamic = 'force-dynamic'

export default async function DemoCanHo() {
  const soThieu = CAN_HO.filter((u) => u.area_m2 === null).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Căn hộ"
        sub={`${DU_AN.ten} · ${CAN_HO.length} căn`}
        actions={<Pill tone="canh">{soThieu} căn thiếu diện tích</Pill>}
      />

      <Hop tone="canh" title="Thiếu diện tích thì phí theo m² ra 0 đồng">
        Hóa đơn vẫn phát bình thường, chỉ là mọi dòng phí tính theo mét vuông đều
        bằng <strong>0 đồng</strong> — không có thông báo lỗi nào cả. Đây là lý do màn này
        tồn tại: <strong>Nhập từ Excel</strong> chỉ thêm căn mới và từ chối mã căn đã có,
        nên khu đã nhập xong danh sách rồi thì không còn đường nào sửa diện tích.
      </Hop>

      <CanHoDemoManHinh />

      <p className="text-[0.75rem] leading-relaxed text-faint">
        Đổi diện tích <strong>không tính lại hóa đơn đã phát</strong>: hóa đơn giữ số tiền
        đã chốt lúc tạo. Diện tích mới áp cho kỳ phát sau.
      </p>
    </div>
  )
}
