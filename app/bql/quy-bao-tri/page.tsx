import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead } from '@/components/ui'
import { QuySo, type DongQuy } from '@/components/quy-so'
import { FormDoiChieu, FormGhi, NutDao } from './form'

/**
 * Sổ quỹ bảo trì cho BQL/BQT. Cùng một thành phần sổ với màn cư dân — thêm nút,
 * không thêm dữ liệu: cái gì BQL nhìn thấy thì cư dân cũng nhìn thấy, và đó là
 * cả điểm của tính năng.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) {
    return (
      <div className="space-y-5">
        <PageHead title="Quỹ bảo trì 2%" />
        <Hop tone="canh" title="Chưa có dự án nào">Nhập tòa và căn hộ trước đã.</Hop>
      </div>
    )
  }

  const [{ data: dong, error }, { data: tk }, { data: ghiDuoc }] = await Promise.all([
    db.rpc('quy_so_ke_toan', { p_project: project.id }),
    db.from('quy_bao_tri').select('ngan_hang, so_tai_khoan, so_du_ngan_hang, doi_chieu_ngay')
      .eq('project_id', project.id).maybeSingle(),
    db.rpc('quy_ghi_duoc', { p_project: project.id }),
  ])

  const ds = (dong ?? []) as DongQuy[]
  const coSoDuDau = ds.some((d) => d.loai === 'so_du_dau')

  return (
    <div className="space-y-5">
      <PageHead
        title="Quỹ bảo trì 2%"
        sub="Tiền của cư dân — sổ riêng, chi phải có nghị quyết BQT, và cả tòa đọc được"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được sổ quỹ">
          {error.code === '42883' || error.code === '42P01'
            ? 'Phần quỹ bảo trì chưa có trên database. Chạy lại schema.sql rồi auth_hooks.sql.'
            : error.message}
        </Hop>
      )}

      {!error && !ghiDuoc && (
        <Hop tone="canh" title="Bạn xem được nhưng không ghi được sổ này">
          Chỉ trưởng BQL và thành viên BQT mới ghi được. Đây là tiền của cư dân,
          nên vòng người chạm vào sổ hẹp hơn vòng người trực ban.
        </Hop>
      )}

      {!error && (
        <QuySo
          dong={ds}
          nganHang={tk?.ngan_hang || undefined}
          soTaiKhoan={tk?.so_tai_khoan || undefined}
          soDuNganHang={tk?.so_du_ngan_hang ?? null}
          doiChieuNgay={tk?.doi_chieu_ngay ?? null}
          hanhDong={
            ghiDuoc
              ? (d) =>
                  d.da_dao || d.la_dong_dao ? null : <NutDao id={d.id} dienGiai={d.dien_giai} />
              : undefined
          }
        />
      )}

      {!error && ghiDuoc && (
        <>
          <Card>
            <CardHead
              title="Ghi bút toán"
              sub={coSoDuDau ? undefined : 'Bắt đầu bằng số dư đầu kỳ — số chủ đầu tư bàn giao'}
            />
            <div className="p-4">
              <FormGhi project={project.id} coSoDuDau={coSoDuDau} />
            </div>
          </Card>

          <Card>
            <CardHead
              title="Đối chiếu ngân hàng"
              sub="Con số duy nhất chứng minh quỹ còn nguyên"
            />
            <div className="p-4">
              <FormDoiChieu
                project={project.id}
                nganHang={tk?.ngan_hang}
                soTaiKhoan={tk?.so_tai_khoan}
                soDu={tk?.so_du_ngan_hang}
                ngay={tk?.doi_chieu_ngay}
              />
            </div>
          </Card>
        </>
      )}

      <Hop tone="trung" title="Chưa làm: đính kèm file biên bản BQT">
        Hệ thống bắt ghi <strong>số</strong> và <strong>ngày</strong> nghị quyết cho
        mọi khoản chi, nhưng chưa lưu được bản scan biên bản. Kho ảnh hiện có gắn
        quyền theo yêu cầu sửa chữa, dùng lại cho hồ sơ quỹ là dựng một đường
        phân quyền thứ hai — làm riêng thì đúng hơn. Trong lúc chờ, giữ bản giấy
        theo số nghị quyết đã ghi ở đây.
      </Hop>
    </div>
  )
}
