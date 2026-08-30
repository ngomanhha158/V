import Link from 'next/link'
import { THONG_BAO } from '@/lib/demo/data'
import { Button, Card, PageHead, cx } from '@/components/ui'
import { IcChuong, IcHoaDon, IcLoa, IcNguoi, IcYeuCau } from '@/components/icons'

export const dynamic = 'force-dynamic'

const LOAI: Record<string, { icon: React.ReactNode; toi: (r: string | null) => string }> = {
  invoice:      { icon: <IcHoaDon />, toi: (r) => (r ? `/demo/invoices/${r}` : '/demo/invoices') },
  ticket:       { icon: <IcYeuCau />, toi: (r) => (r ? `/demo/tickets/${r}` : '/demo/tickets') },
  announcement: { icon: <IcLoa />,    toi: () => '/demo/bang-tin' },
  approval:     { icon: <IcNguoi />,  toi: () => '/demo' },
}

function baoLau(iso: string) {
  const giay = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (giay < 60) return 'vừa xong'
  if (giay < 3600) return `${Math.floor(giay / 60)} phút trước`
  if (giay < 86400) return `${Math.floor(giay / 3600)} giờ trước`
  if (giay < 172800) return 'hôm qua'
  if (giay < 604800) return `${Math.floor(giay / 86400)} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function DemoThongBao() {
  const chuaDoc = THONG_BAO.filter((n) => !n.read_at).length
  return (
    <div className="space-y-5">
      <PageHead
        title="Thông báo"
        sub={chuaDoc ? `${chuaDoc} thông báo chưa đọc` : 'Đã đọc hết'}
        actions={chuaDoc > 0 ? <Button co="sm" disabled>Đánh dấu đã đọc</Button> : undefined}
      />
      <Card>
        <ul className="divide-y divide-line">
          {THONG_BAO.map((n) => {
            const loai = LOAI[n.kind] ?? { icon: <IcChuong />, toi: () => '/demo/thong-bao' }
            const moi = !n.read_at
            return (
              <li key={n.id}>
                <Link
                  href={loai.toi(n.ref_id)}
                  className={cx(
                    'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-raised',
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
                      <div className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{n.body}</div>
                    )}
                    <div className="mt-1 text-[0.75rem] text-faint">{baoLau(n.created_at)}</div>
                  </div>
                  {moi && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
