import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, PageHead, Pill, Trong, cx } from '@/components/ui'
import { IcCanh, IcSach } from '@/components/icons'

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
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
