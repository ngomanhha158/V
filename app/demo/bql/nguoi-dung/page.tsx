import { Card, CardHead, Hop, PageHead, Pill } from '@/components/ui'
import { DU_AN, NGUOI_DUNG } from '@/lib/demo/data'
import { DanhSachDemo, FormTaoTaiKhoanDemo } from './nguoi-dung-demo'

export const dynamic = 'force-dynamic'

export default async function DemoNguoiDung() {
  const ds = NGUOI_DUNG
  const soNhanSu = ds.filter((n) => n.vai_tro_bql?.length).length
  const soCuDan = ds.filter((n) => n.can_ho?.length).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Người dùng & phân quyền"
        sub={`${DU_AN.ten} · ${soNhanSu} nhân sự · ${soCuDan} cư dân`}
        actions={<Pill tone="brand">Bạn là trưởng BQL</Pill>}
      />

      <Hop tone="trung" title="Vì sao tài khoản do BQL tạo, không phải cư dân tự đăng ký">
        Cư dân tự đăng ký được nghĩa là bất kỳ ai cũng tạo được tài khoản rồi xin vào
        một căn bất kỳ. Ở đây BQL tạo trước, vì BQL có hợp đồng mua bán và biên bản
        bàn giao trong tay để đối chiếu danh tính.
        <br /><br />
        Tài khoản tạo ở màn này <strong>vào được ngay</strong>, không cần chờ thư xác
        nhận — nên không phụ thuộc vào hạn gửi thư của hệ thống. Đổi lại, mật khẩu đầu
        tiên do bạn đặt: đọc trực tiếp cho người ta và nhắc họ tự đổi, đừng gửi vào
        nhóm chat chung của tòa.
      </Hop>

      <Card>
        <CardHead
          title="Tạo tài khoản mới"
          sub="Cư dân đăng nhập được ngay sau khi bạn bấm tạo"
        />
        <FormTaoTaiKhoanDemo />
      </Card>

      <Card>
        <CardHead
          title="Đang có tài khoản"
          sub="Nhân sự xếp trước, cư dân xếp sau"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        <DanhSachDemo ds={ds} />
      </Card>
    </div>
  )
}
