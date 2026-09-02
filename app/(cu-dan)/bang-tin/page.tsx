import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, PageHead, Pill, Trong, cx } from '@/components/ui'
import { IcCanh, IcSach } from '@/components/icons'
import { KhoiBinhLuan, KhoiThamDo, type BinhLuan, type ThamDo } from './gop-y'
import type { KetQua } from '@/lib/tham-do'

export const dynamic = 'force-dynamic'

function khiNao(iso: string) {
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function BangTin() {
  const supabase = await createClient()
  // Policy announcement_read lo toàn bộ phần lọc: chỉ bản ĐÃ phát hành và nhắm
  // đúng căn/tầng/tòa/dự án của người này. Trang không tự lọc lại — lọc hai nơi
  // là sớm muộn hai nơi lệch nhau.
  const { data: ds } = await supabase
    .from('announcements')
    .select('id, title, body, is_urgent, published_at, building_id, floor_no, unit_id, documents(id, title, section)')
    .order('published_at', { ascending: false })
    .limit(50)

  const list = ds ?? []
  const khan = list.filter((a) => a.is_urgent)
  const ids = list.map((a) => a.id)

  // Căn của người đang xem, để bỏ phiếu và ký tên bình luận. Lấy căn ĐẦU TIÊN:
  // người có nhiều căn thì bỏ phiếu cho căn nào là câu hỏi thật, nhưng để đó
  // còn hơn đoán bừa — màn nói rõ đang bỏ cho căn nào.
  const { data: canCuaToi } = await supabase
    .from('unit_memberships')
    .select('unit_id, units(code)')
    .eq('status', 'active').limit(1).maybeSingle()
  const unitId = canCuaToi?.unit_id ?? null
  const canEmbed = canCuaToi?.units
  const tenCan = (Array.isArray(canEmbed) ? canEmbed[0] : canEmbed)?.code ?? null

  const [thamDo, binhLuan, phieu] = ids.length
    ? await Promise.all([
      supabase.from('announcement_polls')
        .select('announcement_id, cau_hoi, lua_chon, kin, dong_luc').in('announcement_id', ids),
      supabase.from('announcement_comments')
        .select('id, announcement_id, body, created_at, an_luc, unit_id, units(code), profiles(full_name)')
        .in('announcement_id', ids).order('created_at'),
      unitId
        ? supabase.from('announcement_votes')
          .select('poll_id, chon').in('poll_id', ids).eq('unit_id', unitId)
        : Promise.resolve({ data: [] as { poll_id: string; chon: number }[] }),
    ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const td = new Map(((thamDo.data ?? []) as ThamDo[]).map((t) => [t.announcement_id, t]))
  const phieuCua = new Map((phieu.data ?? []).map((v) => [v.poll_id, v.chon]))

  // Kết quả từng cuộc: hàm SQL tự quyết cuộc kín có trả số hay không, nên trang
  // không cần biết luật đó — biết ở hai nơi là sớm muộn hai nơi lệch nhau.
  const ketQua = new Map<string, KetQua[]>()
  await Promise.all([...td.keys()].map(async (id) => {
    const { data } = await supabase.rpc('ket_qua_tham_do', { p_poll: id })
    ketQua.set(id, (data ?? []) as KetQua[])
  }))

  const mot = <T,>(v: T | T[] | null | undefined): T | null =>
    (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))
  const blTheoTb = new Map<string, BinhLuan[]>()
  for (const c of binhLuan.data ?? []) {
    const ds = blTheoTb.get(c.announcement_id) ?? []
    ds.push({
      id: c.id, body: c.body, created_at: c.created_at, an_luc: c.an_luc,
      can: mot(c.units)?.code ?? null,
      ten: mot(c.profiles)?.full_name ?? null,
    })
    blTheoTb.set(c.announcement_id, ds)
  }

  return (
    <div className="space-y-5">
      <PageHead title="Bảng tin" sub="Thông báo từ ban quản lý gửi tới căn hộ của bạn" />

      {khan.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-card border border-bad-line bg-bad-soft px-3.5 py-3 text-[0.8125rem] text-bad">
          <IcCanh className="mt-0.5 shrink-0" width={16} height={16} />
          <p>
            Có <b className="font-semibold">{khan.length}</b> thông báo khẩn.
            Đọc trước những mục đánh dấu đỏ bên dưới.
          </p>
        </div>
      )}

      {!list.length ? (
        <Trong title="Chưa có thông báo nào">
          Khi ban quản lý gửi tin cho khu, tòa, tầng hoặc riêng căn hộ của bạn,
          nó sẽ hiện ở đây.
        </Trong>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id} className={cx(a.is_urgent && 'border-bad-line')}>
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[0.9375rem] font-semibold text-ink">{a.title}</h2>
                  {a.is_urgent && <Pill tone="xau">Khẩn</Pill>}
                </div>
                <div className="mt-1 text-[0.75rem] text-faint">
                  {a.published_at && khiNao(String(a.published_at))}
                  {/* Nói rõ tin này gửi cho ai. Cư dân đọc "cắt nước" mà không
                      biết cắt ở đâu thì lại gọi điện hỏi BQL — đúng cuộc gọi
                      mà thông báo sinh ra để tránh. */}
                  {' · '}
                  {a.unit_id ? 'Gửi riêng căn hộ bạn'
                    : a.floor_no != null ? `Toàn tầng ${a.floor_no}`
                    : a.building_id ? 'Toàn tòa'
                    : 'Toàn khu'}
                </div>

                <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                  {a.body}
                </p>

                {a.documents && (
                  <Link
                    href={`/so-tay?doc=${a.documents.id}`}
                    className="mt-3 inline-flex items-center gap-2 rounded-ctl border border-line bg-raised px-3 py-2 text-[0.8125rem] transition-colors hover:border-line-firm"
                  >
                    <IcSach width={16} height={16} className="shrink-0 text-faint" />
                    <span className="text-muted">
                      Trích nội quy: <span className="font-medium text-ink">{a.documents.title}</span>
                    </span>
                  </Link>
                )}

                {td.has(a.id) && (
                  <KhoiThamDo
                    td={td.get(a.id)!}
                    ketQua={ketQua.get(a.id) ?? []}
                    phieuCuaToi={phieuCua.get(a.id) ?? null}
                    unitId={unitId} tenCan={tenCan}
                  />
                )}

                <KhoiBinhLuan tb={a.id} ds={blTheoTb.get(a.id) ?? []} unitId={unitId} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
