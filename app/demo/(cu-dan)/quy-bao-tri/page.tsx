import { Hop, PageHead } from '@/components/ui'
import { QuySo } from '@/components/quy-so'
import { DONG, NGAN_HANG, NGAY_DC, SO_DU_NH, SO_TK } from '../../quy-mock'

const HOM_NAY = new Date('2026-05-06T00:00:00Z')

export default function Page() {
  return (
    <div className="space-y-5">
      <PageHead
        title="Quỹ bảo trì 2%"
        sub="Tiền của cư dân, để riêng một tài khoản — mọi khoản chi phải có nghị quyết BQT"
      />

      {/* Cùng một thành phần sổ với màn BQL, chỉ khác là không có nút. Hai bản
          cài đặt là hai bản sẽ lệch, và lúc lệch thì cuộc họp nhà chung cư bắt
          đầu bằng việc cãi xem màn nào đúng. */}
      <QuySo
        dong={DONG}
        nganHang={NGAN_HANG}
        soTaiKhoan={SO_TK}
        soDuNganHang={SO_DU_NH}
        doiChieuNgay={NGAY_DC}
        homNay={HOM_NAY}
      />

      <Hop tone="trung" title="Sổ này không sửa được">
        Ghi sai thì phải ghi thêm một bút toán đảo, và cả hai dòng cùng nằm lại
        trong sổ — nên một lần sai luôn nhìn thấy được.
      </Hop>
    </div>
  )
}
