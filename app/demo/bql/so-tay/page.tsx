import { SO_TAY } from '@/lib/demo/data'
import {
  Button, Card, CardHead, Field, Hop, Input, PageHead, Pill, Stat, Textarea,
} from '@/components/ui'
import { IcThem } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default function DemoBqlSoTay() {
  const mucList = [...new Set(SO_TAY.map((d) => d.section))].sort()
  return (
    <div className="space-y-5">
      <PageHead title="Sổ tay cư dân" sub="Sunrise Riverside · nội quy và hướng dẫn" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat nhan="Số mục" so={SO_TAY.length} />
        <Stat nhan="Nhóm chủ đề" so={mucList.length} />
        <Stat
          nhan="Đã sửa đổi" so={SO_TAY.filter((d) => d.version > 1).length}
          phu="mục có từ 2 phiên bản"
        />
      </div>

      <Card>
        <CardHead title="Thêm mục mới" sub="Cư dân tìm được bằng tìm kiếm toàn văn ở màn Sổ tay" />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
            <Field label="Mục" hint="Gom theo chủ đề để cư dân duyệt nhanh.">
              <Input placeholder="Thú cưng" disabled />
            </Field>
            <Field label="Tiêu đề">
              <Input placeholder="Quy định nuôi thú cưng trong căn hộ" disabled />
            </Field>
          </div>
          <Field
            label="Nội dung"
            hint="Viết rõ và ngắn. Đây là thứ cư dân sẽ trích ra khi tranh cãi với hàng xóm."
          >
            <Textarea rows={5} disabled />
          </Field>
          <Button dang="chinh" disabled><IcThem width={15} height={15} /> Thêm vào sổ tay</Button>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Nội dung hiện có"
          right={<span className="text-[0.8125rem] text-faint">{SO_TAY.length}</span>}
        />
        <ul className="divide-y divide-line">
          {SO_TAY.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="trung" cham={false}>{d.section}</Pill>
                  {d.version > 1 && (
                    <span className="text-[0.75rem] text-faint">phiên bản {d.version}</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-ink">{d.title}</div>
                <p className="mt-1 line-clamp-2 text-[0.8125rem] text-muted">{d.body}</p>
              </div>
              <Button co="sm" dang="nguy" disabled>Xóa</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Hop tone="trung" title="Xóa một mục không làm hỏng thông báo cũ">
        Thông báo đã trích dẫn mục đó chỉ mất nút “xem nội quy”, nội dung thông
        báo vẫn nguyên.
      </Hop>
    </div>
  )
}
