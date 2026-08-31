import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong } from '@/components/ui'
import { DanhSach, FormTaoTaiKhoan, type CanTrong, type NguoiDung } from './form'

export const dynamic = 'force-dynamic'

export default async function QuanLyNguoiDung() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />

  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')
  // Xem thì cả nhân sự đều xem được; TẠO thì chỉ trưởng BQL. Ẩn form đi cho
  // người không có quyền là để họ khỏi điền xong mới bị từ chối — chốt thật
  // vẫn nằm trong SQL, không phải ở đây.
  const { data: laTruong } = await supabase.rpc('is_bql_manager', { p_project: project.id })

  const [{ data: rows, error }, { data: units }, { data: memberships }] = await Promise.all([
    supabase.rpc('bql_danh_sach_nguoi_dung', { p_project: project.id }),
    supabase.from('units').select('id, code, building_id').order('code'),
    supabase.from('unit_memberships').select('unit_id, status, role, valid_to'),
  ])

  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Người dùng & phân quyền" />
        <Hop tone="xau" title="Không tải được danh sách">{error.message}</Hop>
      </div>
    )
  }

  const ds = (rows ?? []) as NguoiDung[]

  // Căn đã có người quản lý đang hiệu lực thì không còn là "căn chưa có chủ hộ".
  // Lọc ở đây để danh sách chọn không mời người ta làm một việc mà SQL sẽ từ chối.
  const homNay = new Date().toISOString().slice(0, 10)
  const daCoChu = new Set(
    (memberships ?? [])
      .filter((m) => m.status === 'active' && (m.role === 'owner' || m.role === 'authorized')
        && (m.valid_to === null || m.valid_to >= homNay))
      .map((m) => m.unit_id),
  )
  const canTrong: CanTrong[] = (units ?? [])
    .filter((u) => !daCoChu.has(u.id))
    .map((u) => ({ id: u.id, nhan: u.code }))

  const soNhanSu = ds.filter((n) => n.vai_tro_bql?.length).length
  const soCuDan = ds.filter((n) => n.can_ho?.length).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Người dùng & phân quyền"
        sub={`${project.name} · ${soNhanSu} nhân sự · ${soCuDan} cư dân`}
        actions={laTruong
          ? <Pill tone="brand">Bạn là trưởng BQL</Pill>
          : <Pill tone="trung">Chỉ xem</Pill>}
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

      {laTruong && (
        <Card>
          <CardHead
            title="Tạo tài khoản mới"
            sub="Cư dân đăng nhập được ngay sau khi bạn bấm tạo"
          />
          <FormTaoTaiKhoan canTrong={canTrong} />
        </Card>
      )}

      <Card>
        <CardHead
          title="Đang có tài khoản"
          sub="Nhân sự xếp trước, cư dân xếp sau"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có ai">
              Tạo tài khoản đầu tiên bằng biểu mẫu phía trên.
            </Trong>
          </div>
        ) : (
          <DanhSach ds={ds} />
        )}
      </Card>
    </div>
  )
}
