import { SO_TAY } from '@/lib/demo/data'
import { Card, Chip, Input, PageHead, Trong } from '@/components/ui'
import { IcTim } from '@/components/icons'

export const dynamic = 'force-dynamic'

/** Bỏ dấu để tìm "thu cung" cũng ra "thú cưng" — người ta gõ vội không bỏ dấu. */
const boDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

export default async function DemoSoTay({
  searchParams,
}: { searchParams: Promise<{ q?: string; muc?: string; doc?: string }> }) {
  const sp = await searchParams
  const tuKhoa = (sp.q ?? '').trim()
  const mucList = [...new Set(SO_TAY.map((d) => d.section))].sort()

  // Bản thật dùng tìm kiếm toàn văn của Postgres (documents.search_tsv).
  // Bản demo không có DB nên lọc bằng chuỗi — cùng kết quả với vài mục thế này.
  const list = tuKhoa
    ? SO_TAY.filter((d) =>
        boDau(d.title + ' ' + d.body + ' ' + d.section).includes(boDau(tuKhoa)))
    : sp.muc
      ? SO_TAY.filter((d) => d.section === sp.muc)
      : SO_TAY

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

      {!tuKhoa && (
        <nav className="flex flex-wrap gap-1.5">
          <Chip href="/demo/so-tay" active={!sp.muc}>Tất cả</Chip>
          {mucList.map((m) => (
            <Chip key={m} href={`/demo/so-tay?muc=${encodeURIComponent(m)}`} active={sp.muc === m}>
              {m}
            </Chip>
          ))}
        </nav>
      )}

      {!list.length ? (
        <Trong title={`Không có mục nào khớp “${tuKhoa}”`}>
          Thử từ khóa ngắn hơn, hoặc bỏ dấu.
        </Trong>
      ) : (
        <div className="space-y-3">
          {tuKhoa && (
            <p className="text-[0.8125rem] text-muted">{list.length} mục khớp “{tuKhoa}”</p>
          )}
          {list.map((d) => (
            <Card key={d.id}>
              <details open={sp.doc === d.id || !!tuKhoa} className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[0.75rem] font-medium tracking-wide text-faint uppercase">
                      {d.section}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-ink">{d.title}</div>
                  </div>
                  <span className="mt-1 shrink-0 text-faint transition-transform group-open:rotate-90">›</span>
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
