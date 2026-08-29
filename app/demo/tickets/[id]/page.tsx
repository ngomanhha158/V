import Link from 'next/link'
import { notFound } from 'next/navigation'
import { YEU_CAU } from '@/lib/demo/data'

const TRANG_THAI: Record<string, string> = {
  new: 'Mới', assigned: 'Đã phân công', in_progress: 'Đang xử lý',
  resolved: 'Đã xong', closed: 'Đã đóng',
}
const UU_TIEN: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

export default async function DemoTicketDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = YEU_CAU.find((y) => y.id === id)
  if (!t) notFound()

  const quaHan = !t.xong_luc && new Date(t.han_xu_ly) < new Date()

  return (
    <main className="mx-auto w-full max-w-lg space-y-5">
      <Link href="/demo/tickets" className="text-sm underline">← Yêu cầu</Link>

      <div>
        <h1 className="text-2xl font-semibold">{t.tieu_de}</h1>
        <p className="text-sm opacity-70">
          {t.can} · {t.loai} · {UU_TIEN[t.uu_tien]} · {TRANG_THAI[t.trang_thai]}
        </p>
      </div>

      <p className="rounded border p-3 text-sm">{t.mo_ta}</p>

      <section className="rounded border p-3 text-sm">
        <div className="flex justify-between">
          <span className="opacity-70">Hạn xử lý theo SLA</span>
          <span className={quaHan ? 'text-red-700' : ''}>{t.han_xu_ly}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-70">Người xử lý</span>
          <span>{t.nguoi_xu_ly ?? 'Chưa phân công'}</span>
        </div>
        {t.xong_luc && (
          <div className="flex justify-between">
            <span className="opacity-70">Hoàn thành</span><span>{t.xong_luc}</span>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Diễn biến</h2>
        <ol className="space-y-2 border-l pl-4 text-sm">
          {t.lich_su.map((e, i) => (
            <li key={i}>
              <div className="opacity-60">{e.luc} · {e.ai}</div>
              <div>{e.viec}</div>
            </li>
          ))}
        </ol>
      </section>

      {t.trang_thai === 'resolved' && !t.danh_gia && (
        <section className="space-y-2 rounded border p-3">
          <h2 className="font-medium">Đánh giá xử lý</h2>
          <div className="text-2xl opacity-40">★★★★★</div>
          <p className="text-sm opacity-70">
            Cư dân chấm sao sau khi BQL báo xong. Điểm này vào KPI của ban quản trị.
          </p>
        </section>
      )}

      {t.danh_gia && (
        <p className="rounded bg-green-50 p-3 text-sm">
          Đã đánh giá {'★'.repeat(t.danh_gia)}
        </p>
      )}
    </main>
  )
}
