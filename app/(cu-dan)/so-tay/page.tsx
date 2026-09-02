import { createClient } from '@/lib/db/server'
import { Card, Chip, Hop, Input, PageHead, Trong } from '@/components/ui'
import { IcTim } from '@/components/icons'

export const dynamic = 'force-dynamic'

export default async function SoTay({
  searchParams,
}: { searchParams: Promise<{ q?: string; muc?: string; doc?: string }> }) {
  const sp = await searchParams
  const db = await createClient()
  const tuKhoa = (sp.q ?? '').trim()

  let q = db
    .from('documents')
    .select('id, section, title, body, version')
    .order('section')
    .order('title')

  if (tuKhoa) {
    // Tìm toàn văn qua cột search_tsv sinh sẵn trong schema. 'websearch' cho
    // phép người ta gõ tự nhiên ("nuôi chó -mèo") thay vì phải học cú pháp
    // toán tử của Postgres.
    q = q.textSearch('search_tsv', tuKhoa, { type: 'websearch', config: 'simple' })
  } else if (sp.muc) {
    q = q.eq('section', sp.muc)
  }

  const [{ data: ds, error }, { data: tatCa }] = await Promise.all([
    q,
    db.from('documents').select('section'),
  ])

  const list = ds ?? []
  const mucList = [...new Set((tatCa ?? []).map((d) => d.section))].sort()
  const moRong = sp.doc

  return (
    <div className="space-y-5">
      <PageHead title="Sổ tay cư dân" sub="Nội quy, hướng dẫn và quy định của khu" />

      <form className="flex gap-2">
        <div className="relative flex-1">
          <IcTim
            width={16} height={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
          />
          <Input
            name="q" defaultValue={tuKhoa} className="pl-9"
            placeholder="Tìm: nuôi chó, giờ chuyển nhà, phí gửi xe…"
          />
        </div>
      </form>

      {!tuKhoa && mucList.length > 0 && (
        <nav className="flex flex-wrap gap-1.5">
          <Chip href="/so-tay" active={!sp.muc}>Tất cả</Chip>
          {mucList.map((m) => (
            <Chip key={m} href={`/so-tay?muc=${encodeURIComponent(m)}`} active={sp.muc === m}>
              {m}
            </Chip>
          ))}
        </nav>
      )}

      {error && (
        // Không nuốt lỗi tìm kiếm: danh sách trống vì lỗi trông y hệt trống vì
        // không có kết quả, mà hai chuyện đó khác hẳn nhau.
        <Hop tone="xau" title="Không tìm được">{error.message}</Hop>
      )}

      {!error && !list.length ? (
        <Trong title={tuKhoa ? `Không có mục nào khớp "${tuKhoa}"` : 'Sổ tay còn trống'}>
          {tuKhoa
            ? 'Thử từ khóa ngắn hơn, hoặc bỏ dấu.'
            : 'Ban quản lý chưa nhập nội quy nào vào hệ thống.'}
        </Trong>
      ) : (
        <div className="space-y-3">
          {tuKhoa && (
            <p className="text-[0.8125rem] text-muted">
              {list.length} mục khớp “{tuKhoa}”
            </p>
          )}
          {list.map((d) => (
            <Card key={d.id}>
              {/* details/summary: gập mở không cần JavaScript. Sổ tay là thứ
                  người ta mở ở hầm xe với sóng yếu — càng ít script càng tốt. */}
              <details open={moRong === d.id || !!tuKhoa} className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[0.75rem] font-medium tracking-wide text-faint uppercase">
                      {d.section}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{d.title}</div>
                  </div>
                  <span className="mt-1 shrink-0 text-faint transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <div className="border-t border-line px-4 py-3.5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{d.body}</p>
                  {d.version > 1 && (
                    <p className="mt-3 text-[0.75rem] text-faint">Phiên bản {d.version}</p>
                  )}
                </div>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
