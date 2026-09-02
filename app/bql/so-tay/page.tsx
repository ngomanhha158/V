import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { SoanMuc } from './form'
import { xoaMuc } from './actions'
import { Button, Card, CardHead, Hop, PageHead, Pill, Stat, Trong } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function BqlSoTay() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const { data: ds } = await supabase
    .from('documents')
    .select('id, section, title, body, version')
    .order('section')
    .order('title')

  const list = ds ?? []
  const mucList = [...new Set(list.map((d) => d.section))].sort()

  return (
    <div className="space-y-5">
      <PageHead title="Sổ tay cư dân" sub={`${project.name} · nội quy và hướng dẫn`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat nhan="Số mục" so={list.length} />
        <Stat nhan="Nhóm chủ đề" so={mucList.length} />
        <Stat
          nhan="Đã sửa đổi"
          so={list.filter((d) => d.version > 1).length}
          phu="mục có từ 2 phiên bản"
        />
      </div>

      <Card>
        <CardHead
          title="Thêm mục mới"
          sub="Cư dân tìm được bằng tìm kiếm toàn văn ở màn Sổ tay"
        />
        <SoanMuc mucGoiY={mucList} />
      </Card>

      <Card>
        <CardHead
          title="Nội dung hiện có"
          right={<span className="text-[0.8125rem] text-faint">{list.length}</span>}
        />
        {!list.length ? (
          <div className="p-4">
            <Trong title="Sổ tay còn trống">
              Nhập nội quy vào đây thì cư dân tra được, và BQL trích dẫn được
              vào thông báo thay vì gõ lại mỗi lần.
            </Trong>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((d) => (
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
                <form action={xoaMuc.bind(null, d.id)} className="shrink-0">
                  <Button co="sm" dang="nguy">Xóa</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Hop tone="trung" title="Xóa một mục không làm hỏng thông báo cũ">
        Thông báo đã trích dẫn mục đó chỉ mất nút “xem nội quy”, nội dung thông
        báo vẫn nguyên.
      </Hop>
    </div>
  )
}
