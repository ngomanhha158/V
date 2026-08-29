import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', issued: 'Chưa thanh toán', partial: 'Trả một phần',
  paid: 'Đã thanh toán', void: 'Đã hủy',
}
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default async function Invoices() {
  const supabase = await createClient()
  // RLS lo phần lọc: chỉ hóa đơn căn mình, và family không thấy nếu chủ hộ
  // chưa bật can_view_finance.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, period, total_amount, paid_amount, status, due_date, units(code)')
    .neq('status', 'draft')          // hóa đơn nháp là việc nội bộ của BQL
    .order('period', { ascending: false })

  return (
    <main className="space-y-4">
      <Link href="/" className="text-sm underline">← Trang chủ</Link>
      <h1 className="text-2xl font-semibold">Hóa đơn</h1>

      {!invoices?.length && <p className="opacity-70">Chưa có hóa đơn nào.</p>}

      <ul className="space-y-2">
        {invoices?.map((i) => {
          const conLai = i.total_amount - i.paid_amount
          const quaHan = conLai > 0 && new Date(i.due_date) < new Date()
          return (
            <li key={i.id} className="rounded border p-3">
              <Link href={`/invoices/${i.id}`} className="font-medium underline">
                {i.units?.code} · kỳ {String(i.period).slice(0, 7)}
              </Link>
              <div className="text-sm opacity-70">
                {vnd(i.total_amount)} · {STATUS_LABEL[i.status] ?? i.status}
                {conLai > 0 && ` · còn ${vnd(conLai)}`}
              </div>
              {quaHan && <div className="mt-1 text-sm text-red-700">Quá hạn {String(i.due_date)}</div>}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
