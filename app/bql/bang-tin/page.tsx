import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SoanThongBao } from './form'
import { phatHanh, xoaThongBao } from './actions'
import { Button, Card, CardHead, PageHead, Pill, Stat, Trong } from '@/components/ui'

export const dynamic = 'force-dynamic'

function khiNao(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function BqlBangTin() {
  const supabase = await createClient()
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  const [{ data: toaList }, { data: canList }, { data: docList }, { data: ds }] = await Promise.all([
    supabase.from('buildings').select('id, code, name').order('code'),
    supabase.from('units').select('id, code, building_id, floor_no').order('code'),
    supabase.from('documents').select('id, section, title').order('section'),
    supabase
      .from('announcements')
      .select('id, title, body, is_urgent, published_at, created_at, building_id, floor_no, unit_id, units(code), buildings(code)')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const list = ds ?? []
  const nhap = list.filter((a) => !a.published_at)
  const daPhatHanh = list.filter((a) => a.published_at)

  const phamVi = (a: (typeof list)[number]) =>
    a.unit_id ? `Căn ${a.units?.code ?? '—'}`
      : a.floor_no != null ? `Tòa ${a.buildings?.code ?? '—'} · tầng ${a.floor_no}`
      : a.building_id ? `Toàn tòa ${a.buildings?.code ?? '—'}`
      : 'Toàn khu'

  return (
    <div className="space-y-5">
      <PageHead title="Bảng tin" sub={`${project.name} · soạn và phát hành thông báo`} />

      <div className="grid grid-cols-3 gap-3">
        <Stat nhan="Đã phát hành" so={daPhatHanh.length} />
        <Stat nhan="Bản nháp" so={nhap.length} tone={nhap.length ? 'canh' : 'trung'} />
        <Stat nhan="Mục nội quy" so={docList?.length ?? 0} phu="để trích dẫn" />
      </div>

      <Card>
        <CardHead title="Soạn thông báo mới" />
        <SoanThongBao
          toaList={toaList ?? []} canList={canList ?? []} docList={docList ?? []}
        />
      </Card>

      {nhap.length > 0 && (
        <Card>
          <CardHead
            title="Bản nháp"
            sub="Cư dân chưa thấy. Phát hành thì mới hiện trên bảng tin của họ."
          />
          <ul className="divide-y divide-line">
            {nhap.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{a.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone="trung">Nháp</Pill>
                    {a.is_urgent && <Pill tone="xau">Khẩn</Pill>}
                    <span className="text-[0.75rem] text-faint">{phamVi(a)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={phatHanh.bind(null, a.id)}>
                    <Button co="sm" dang="chinh">Phát hành</Button>
                  </form>
                  <form action={xoaThongBao.bind(null, a.id)}>
                    <Button co="sm" dang="nguy">Xóa</Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHead
          title="Đã phát hành"
          right={<span className="text-[0.8125rem] text-faint">{daPhatHanh.length}</span>}
        />
        {!daPhatHanh.length ? (
          <div className="p-4"><Trong title="Chưa phát hành thông báo nào" /></div>
        ) : (
          <ul className="divide-y divide-line">
            {daPhatHanh.map((a) => (
              <li key={a.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm font-medium text-ink">{a.title}</div>
                  {a.is_urgent && <Pill tone="xau">Khẩn</Pill>}
                </div>
                <div className="mt-1 text-[0.75rem] text-faint">
                  {phamVi(a)} · {a.published_at && khiNao(String(a.published_at))}
                </div>
                {/* Cố ý KHÔNG có nút sửa/xóa ở đây. Thông báo đã tới tay cư dân
                    thì sửa lại là viết lại lịch sử — ai đọc bản cũ vẫn nhớ bản
                    cũ. Sai thì đăng đính chính, để cả hai bản cùng tồn tại. */}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
