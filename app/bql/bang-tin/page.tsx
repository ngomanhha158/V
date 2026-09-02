import { redirect } from 'next/navigation'
import {
  FormThamDo, HangBinhLuan, KetQuaBQL, type BinhLuanBQL, type ThamDoBQL,
} from './gop-y-bql'
import { createClient } from '@/lib/db/server'
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
  const ids = list.map((a) => a.id)

  const [thamDo, binhLuan, phieu] = ids.length
    ? await Promise.all([
      supabase.from('announcement_polls')
        .select('announcement_id, cau_hoi, lua_chon, kin, dong_luc').in('announcement_id', ids),
      supabase.from('announcement_comments')
        .select('id, announcement_id, body, created_at, an_luc, an_ly_do, units(code), profiles(full_name)')
        .in('announcement_id', ids).order('created_at'),
      supabase.from('announcement_votes').select('poll_id, chon').in('poll_id', ids),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  // Đếm ở đây chứ không gọi ket_qua_tham_do(): BQL xem được cả cuộc kín, mà
  // gọi hàm cho từng thông báo là N vòng gọi cho một màn danh sách.
  const demTheoPoll = new Map<string, number[]>()
  for (const t of thamDo.data ?? []) demTheoPoll.set(t.announcement_id, new Array(t.lua_chon.length).fill(0))
  for (const v of phieu.data ?? []) {
    const d = demTheoPoll.get(v.poll_id)
    if (d && v.chon >= 0 && v.chon < d.length) d[v.chon] += 1
  }
  const td = new Map((thamDo.data ?? []).map((t) => [t.announcement_id, {
    ...t, dem: demTheoPoll.get(t.announcement_id) ?? [],
  } as ThamDoBQL]))

  const mot = <T,>(v: T | T[] | null | undefined): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
  const blTheoTb = new Map<string, BinhLuanBQL[]>()
  for (const c of binhLuan.data ?? []) {
    const arr = blTheoTb.get(c.announcement_id) ?? []
    arr.push({
      id: c.id, body: c.body, created_at: c.created_at,
      an_luc: c.an_luc, an_ly_do: c.an_ly_do,
      can: mot(c.units)?.code ?? null, ten: mot(c.profiles)?.full_name ?? null,
    })
    blTheoTb.set(c.announcement_id, arr)
  }

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

                <div className="mt-2">
                  {td.has(a.id)
                    ? <KetQuaBQL td={td.get(a.id)!} />
                    : <FormThamDo tb={a.id} />}
                </div>

                {(blTheoTb.get(a.id) ?? []).length > 0 && (
                  <div className="mt-3 border-t border-line pt-2">
                    <div className="text-[0.75rem] font-semibold tracking-wide text-faint uppercase">
                      {(blTheoTb.get(a.id) ?? []).length} ý kiến
                    </div>
                    <ul className="divide-y divide-line">
                      {(blTheoTb.get(a.id) ?? []).map((c) => (
                        <HangBinhLuan key={c.id} c={c} />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
