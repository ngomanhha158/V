import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong } from '@/components/ui'
import { DanhSachPhi, FormThem, type BieuPhi } from './form'

export const dynamic = 'force-dynamic'

export default async function BieuPhiPage() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [{ data: rows, error }, { data: units }] = await Promise.all([
    db.from('fee_types')
      .select('id, code, name, unit_price, calc_method, loai_xe')
      .eq('project_id', project.id).order('code'),
    db.from('units').select('area_m2'),
  ])

  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Biểu phí" />
        <Hop tone="xau" title="Không tải được biểu phí">{error.message}</Hop>
      </div>
    )
  }

  const ds = (rows ?? []) as BieuPhi[]
  const tongCan = units?.length ?? 0
  const coDienTich = (units ?? []).filter((u) => u.area_m2 !== null)
  // Diện tích thật của một căn bất kỳ, dùng cho ô xem trước thành tiền. Null
  // nghĩa là chưa căn nào có diện tích — lúc đó phí theo m² sẽ ra 0 đồng.
  const dienTichMau = coDienTich.length ? Number(coDienTich[0].area_m2) : null
  const thieuDienTich = tongCan - coDienTich.length

  return (
    <div className="space-y-5">
      <PageHead
        title="Biểu phí"
        sub={`${project.name} · ${ds.length} loại phí`}
        actions={ds.length
          ? <Pill tone="tot">Đã cấu hình</Pill>
          : <Pill tone="canh">Chưa có phí nào</Pill>}
      />

      {ds.length === 0 && (
        <Hop tone="canh" title="Chưa có biểu phí thì chưa phát được hóa đơn nào">
          Màn Hóa đơn sinh hóa đơn bằng cách duyệt qua từng loại phí ở đây. Không có
          dòng nào thì nút sinh hóa đơn vẫn bấm được, vẫn báo thành công, nhưng ra
          đúng 0 hóa đơn — hỏng theo kiểu không ai nhận ra.
        </Hop>
      )}

      {thieuDienTich > 0 && (
        <Hop tone={thieuDienTich === tongCan ? 'xau' : 'canh'} title="Diện tích căn hộ còn thiếu">
          {thieuDienTich === tongCan
            ? `Cả ${tongCan} căn đều chưa có diện tích.`
            : `${thieuDienTich} trên ${tongCan} căn chưa có diện tích.`}
          {' '}Phí tính <strong>theo mét vuông</strong> nhân với diện tích của căn, nên những
          căn thiếu sẽ ra <strong>0 đồng</strong> — hóa đơn vẫn phát bình thường, chỉ là
          không thu được gì. Nhập diện tích ở màn{' '}
          <Link href="/bql/can-ho" className="font-semibold underline">Căn hộ</Link>{' '}
          trước khi phát hóa đơn kỳ đầu. (Màn Nhập từ Excel không sửa được: nó chỉ thêm
          căn mới, và từ chối mã căn đã có.)
        </Hop>
      )}

      <Hop tone="trung" title="Sửa giá không đụng tới hóa đơn đã phát">
        Hóa đơn lưu lại đơn giá tại thời điểm sinh ra, nên đổi giá ở đây chỉ áp cho
        những kỳ sinh về sau. Cư dân mở lại hóa đơn tháng trước vẫn thấy đúng con số
        họ đã trả — đó là lý do màn này không cho sửa <strong>mã phí</strong>: mã đã
        nằm trong sổ sách kế toán, đổi là mất dấu vết.
      </Hop>

      <Card>
        <CardHead title="Thêm loại phí" sub="Mã phí đặt xong thì không đổi được" />
        <FormThem dienTichMau={dienTichMau} />
      </Card>

      <Card>
        <CardHead
          title="Đang áp dụng"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có loại phí nào">
              Thêm loại phí đầu tiên bằng biểu mẫu phía trên.
            </Trong>
          </div>
        ) : (
          <DanhSachPhi ds={ds} dienTichMau={dienTichMau} />
        )}
      </Card>
    </div>
  )
}
