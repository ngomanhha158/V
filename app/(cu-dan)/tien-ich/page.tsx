import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Card, CardHead, Hop, PageHead, Pill, Trong, vnd } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const db = await createClient()
  const { data: ds, error } = await db
    .from('tien_ich')
    .select('id, ten, mo_ta, dia_diem, phi, toi_da_tuan, dang_mo')
    .order('ten')

  return (
    <div className="space-y-5">
      <PageHead
        title="Đặt tiện ích"
        sub="Giữ chỗ trước theo khung giờ — không phải nhắn Zalo rồi chờ ai đó trả lời"
      />

      {error && (
        <Hop tone="xau" title="Không đọc được danh sách tiện ích">
          {error.code === '42P01'
            ? 'Phần tiện ích chưa có trên database. Báo ban quản lý.'
            : error.message}
        </Hop>
      )}

      {!error && (ds ?? []).length === 0 && (
        <Trong title="Chưa có tiện ích nào mở đặt">
          Ban quản lý chưa khai báo tiện ích nào. Gym, hồ bơi hay sảnh sinh hoạt
          của tòa nếu đang cho đặt trước thì hỏi ở quầy lễ tân.
        </Trong>
      )}

      <div className="space-y-3">
        {(ds ?? []).map((t) => (
          <Card key={t.id}>
            <CardHead
              title={
                t.dang_mo ? (
                  <Link href={`/tien-ich/${t.id}`} className="text-brand hover:underline">
                    {t.ten}
                  </Link>
                ) : (
                  t.ten
                )
              }
              sub={t.dia_diem ?? undefined}
              right={t.dang_mo ? undefined : <Pill tone="trung">Đang đóng</Pill>}
            />
            <div className="space-y-1 px-4 pb-3 text-[0.8125rem] text-muted">
              {t.mo_ta && <p>{t.mo_ta}</p>}
              <p>
                {t.phi > 0 ? `${vnd(t.phi)} một suất` : 'Miễn phí'} · mỗi căn tối đa{' '}
                {t.toi_da_tuan} suất một tuần
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
