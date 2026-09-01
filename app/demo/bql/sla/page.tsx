import { Card, CardHead, Hop, PageHead, Pill } from '@/components/ui'
import { DU_AN, SLA } from '@/lib/demo/data'
import { DanhSachSlaDemo, FormThemDemo } from './sla-demo'

export const dynamic = 'force-dynamic'

const THU_TU = { urgent: 0, high: 1, normal: 2, low: 3 } as Record<string, number>

export default async function DemoSla() {
  const ds = [...SLA].sort(
    (a, b) => a.category.localeCompare(b.category, 'vi')
      || (THU_TU[a.priority] ?? 9) - (THU_TU[b.priority] ?? 9),
  )
  const soDanhMuc = new Set(ds.map((p) => p.category)).size

  return (
    <div className="space-y-5">
      <PageHead
        title="Cam kết thời gian (SLA)"
        sub={`${DU_AN.ten} · ${soDanhMuc} danh mục · ${ds.length} mức`}
        actions={<Pill tone="tot">Cư dân báo được sự cố</Pill>}
      />

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
        <FormThemDemo />
      </Card>

      <Card>
        <CardHead
          title="Đang cam kết"
          sub="Xếp theo danh mục, trong mỗi danh mục thì khẩn cấp lên trước"
          right={<span className="text-[0.8125rem] text-faint">{ds.length}</span>}
        />
        <DanhSachSlaDemo ds={ds} />
      </Card>
    </div>
  )
}
