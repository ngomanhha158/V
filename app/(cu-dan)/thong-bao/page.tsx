import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { danhDauDaDoc } from './actions'
import { Button, Card, PageHead, Trong, cx } from '@/components/ui'
import { IcChuong, IcHoaDon, IcLoa, IcNguoi, IcYeuCau } from '@/components/icons'

export const dynamic = 'force-dynamic'

/** Mỗi loại thông báo dẫn đi một nơi khác nhau — đọc xong phải làm được gì đó. */
const LOAI: Record<string, { icon: React.ReactNode; toi: (ref: string | null) => string }> = {
  invoice:      { icon: <IcHoaDon />, toi: (r) => (r ? `/invoices/${r}` : '/invoices') },
  ticket:       { icon: <IcYeuCau />, toi: (r) => (r ? `/tickets/${r}` : '/tickets') },
  announcement: { icon: <IcLoa />,    toi: () => '/bang-tin' },
  approval:     { icon: <IcNguoi />,  toi: () => '/approvals' },
}

/** "3 phút trước", "hôm qua" — người ta nghĩ theo khoảng cách, không theo mốc. */
function baoLau(iso: string) {
  const giay = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (giay < 60) return 'vừa xong'
  if (giay < 3600) return `${Math.floor(giay / 60)} phút trước`
  if (giay < 86400) return `${Math.floor(giay / 3600)} giờ trước`
  if (giay < 172800) return 'hôm qua'
  if (giay < 604800) return `${Math.floor(giay / 86400)} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default async function ThongBao() {
  const db = await createClient()
  // RLS (notification_own_read) lọc: chỉ thông báo của chính mình.
  const { data: ds } = await db
    .from('notifications')
    .select('id, kind, ref_id, title, body, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = ds ?? []
  const chuaDoc = list.filter((n) => !n.read_at).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Thông báo"
        sub={chuaDoc ? `${chuaDoc} thông báo chưa đọc` : 'Đã đọc hết'}
        actions={
          chuaDoc > 0 ? (
            <form action={danhDauDaDoc}>
              <Button type="submit" co="sm">Đánh dấu đã đọc</Button>
            </form>
          ) : undefined
        }
      />

      {!list.length ? (
        <Trong title="Chưa có thông báo nào">
          Nhắc hạn hóa đơn, tiến độ yêu cầu sửa chữa và tin từ ban quản lý sẽ
          hiện ở đây.
        </Trong>
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const loai = LOAI[n.kind] ?? { icon: <IcChuong />, toi: () => '/thong-bao' }
              const moi = !n.read_at
              return (
                <li key={n.id}>
                  <Link
                    href={loai.toi(n.ref_id)}
                    className={cx(
                      'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-raised',
                      // Chưa đọc thì nền hơi đậm hơn CỘNG một chấm — không chỉ
                      // dựa vào nền, vì nền nhạt như vậy trên màn hình ngoài
                      // nắng là không thấy gì.
                      moi && 'bg-brand-soft/40',
                    )}
                  >
                    <span className={cx('mt-0.5 shrink-0', moi ? 'text-brand' : 'text-faint')}>
                      {loai.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cx('text-sm', moi ? 'font-semibold text-ink' : 'text-ink')}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">
                          {n.body}
                        </div>
                      )}
                      <div className="mt-1 text-[0.75rem] text-faint">
                        {baoLau(String(n.created_at))}
                      </div>
                    </div>
                    {moi && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
