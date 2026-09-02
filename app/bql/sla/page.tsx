import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong } from '@/components/ui'
import { DanhSachSla, FormThem, type Sla } from './form'

export const dynamic = 'force-dynamic'

const THU_TU = { urgent: 0, high: 1, normal: 2, low: 3 } as Record<string, number>

export default async function SlaPage() {
  const db = await createClient()
  const { data: project } = await db.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await db.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [{ data: rows, error }, { data: tickets }] = await Promise.all([
    db.from('sla_policies')
      .select('id, category, priority, respond_mins, resolve_mins, escalate_to')
      .eq('project_id', project.id),
    db.from('tickets').select('category').eq('project_id', project.id),
  ])

  if (error) {
    return (
      <div className="space-y-5">
        <PageHead title="Cam kết thời gian (SLA)" />
        <Hop tone="xau" title="Không tải được SLA">{error.message}</Hop>
      </div>
    )
  }

  const ds = ((rows ?? []) as Sla[]).sort(
    (a, b) => a.category.localeCompare(b.category, 'vi')
      || (THU_TU[a.priority] ?? 9) - (THU_TU[b.priority] ?? 9),
  )
  const dem: Record<string, number> = {}
  for (const t of tickets ?? []) dem[t.category] = (dem[t.category] ?? 0) + 1

  const soDanhMuc = new Set(ds.map((p) => p.category)).size
  // Danh mục đã có ticket nhưng SLA vừa bị xóa hết -> ticket cũ mồ côi, và cư
  // dân không chọn lại được danh mục đó nữa.
  const moCoi = Object.keys(dem).filter((c) => !ds.some((p) => p.category === c))

  return (
    <div className="space-y-5">
      <PageHead
        title="Cam kết thời gian (SLA)"
        sub={`${project.name} · ${soDanhMuc} danh mục · ${ds.length} mức`}
        actions={ds.length
          ? <Pill tone="tot">Cư dân báo được sự cố</Pill>
          : <Pill tone="xau">Cư dân chưa báo được</Pill>}
      />

      {ds.length === 0 && (
        <Hop tone="xau" title="Chưa có SLA thì cư dân không gửi được yêu cầu nào">
          Màn <strong>Báo sự cố</strong> của cư dân lấy danh sách danh mục từ đúng bảng này.
          Không có dòng nào thì ô chọn danh mục rỗng, và cư dân không bấm gửi được — trang
          không báo lỗi gì, chỉ đơn giản là không có gì để chọn.
          <br /><br />
          Thêm danh mục đầu tiên bên dưới là mở lại được ngay.
        </Hop>
      )}

      {moCoi.length > 0 && (
        <Hop tone="canh" title="Có danh mục đang dùng nhưng không còn cam kết">
          {moCoi.map((c) => `“${c}” (${dem[c]} yêu cầu)`).join(', ')} — những yêu cầu này
          vẫn hiện ở màn điều phối nhưng <strong>không có hạn để đo</strong>, và cư dân
          không chọn lại được danh mục đó khi báo sự cố mới.
        </Hop>
      )}

      <Hop tone="trung" title="Cam kết này chạy thật, không phải để trưng">
        Lúc cư dân gửi yêu cầu, hệ thống lấy hạn theo <strong>danh mục và mức ưu tiên</strong>
        họ chọn rồi chốt luôn vào yêu cầu đó. Cứ 5 phút một lần, việc nào quá hạn xử lý sẽ
        tự bị đánh dấu leo thang và ghi vào lịch sử.
        <br /><br />
        Vì hạn được chốt lúc tạo nên sửa ở đây <strong>không đụng tới yêu cầu đang mở</strong> —
        cư dân đã được hứa bao lâu thì vẫn là bấy lâu.
      </Hop>

      <Card>
        <CardHead
          title="Thêm cam kết"
          sub="Mỗi danh mục nên có ít nhất mức Bình thường; thêm mức Khẩn cấp cho việc nguy hiểm"
        />
        <FormThem />
      </Card>

      <Card>
        <CardHead
          title="Đang cam kết"
          sub="Xếp theo danh mục, trong mỗi danh mục thì khẩn cấp lên trước"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        {ds.length === 0 ? (
          <div className="p-4">
            <Trong title="Chưa có cam kết nào">
              Ví dụ thường gặp: thang máy kẹt người — khẩn cấp, tiếp nhận 5 phút, xử lý 30 phút.
              Mất nước — cao, tiếp nhận 15 phút, xử lý 2 giờ. Bóng đèn hành lang — thấp,
              tiếp nhận 4 giờ, xử lý 3 ngày.
            </Trong>
          </div>
        ) : (
          <DanhSachSla ds={ds} dem={dem} />
        )}
      </Card>
    </div>
  )
}
