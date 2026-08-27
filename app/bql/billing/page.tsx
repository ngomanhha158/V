import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceActions, ReadingsForm } from './forms'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp', issued: 'Đã phát hành', partial: 'Trả một phần', paid: 'Đã thu', void: 'Đã hủy',
}
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ'

export default async function Billing({
  searchParams,
}: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <main><p>Chưa có dự án nào.</p></main>
  const { data: isStaff } = await supabase.rpc('is_staff', { p_project: project.id })
  if (!isStaff) redirect('/')

  // Kỳ mặc định = tháng này. Dạng YYYY-MM cho input type=month.
  const now = new Date()
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? '') ? sp.period! : thisMonth
  const periodDate = `${period}-01`

  const [{ data: feeTypes }, { data: units }, { data: readings }, { data: invoices }] = await Promise.all([
    supabase.from('fee_types').select('id, code, name, calc_method').order('code'),
    supabase.from('units').select('id, code').order('code'),
    supabase.from('meter_readings').select('unit_id, fee_type_id, prev_index, curr_index').eq('period', periodDate),
    supabase.from('invoices').select('id, status, total_amount, unit_id, units(code)').eq('period', periodDate).order('status'),
  ])

  const metered = (feeTypes ?? []).filter((f) => f.calc_method === 'metered')
  const firstMetered = metered[0]?.id
  const byUnit = new Map(
    (readings ?? []).filter((r) => r.fee_type_id === firstMetered).map((r) => [r.unit_id, r]),
  )
  const rows = (units ?? []).map((u) => ({
    unit_id: u.id,
    code: u.code,
    prev: byUnit.get(u.id)?.prev_index ?? null,
    curr: byUnit.get(u.id)?.curr_index ?? null,
  }))

  const tong = (invoices ?? []).reduce((s, i) => s + (i.total_amount ?? 0), 0)
  const nhap = (invoices ?? []).filter((i) => i.status === 'draft').length

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hóa đơn</h1>
        <Link href="/bql" className="text-sm underline">Quản lý tòa</Link>
      </div>

      <form className="flex items-center gap-2 text-sm">
        <label>Kỳ</label>
        <input type="month" name="period" defaultValue={period} className="rounded border p-2" />
        <button className="rounded border px-3 py-2">Xem</button>
      </form>

      <section className="rounded border p-3 text-sm">
        <div>
          <b>{invoices?.length ?? 0}</b> hóa đơn · <b>{nhap}</b> còn nháp · tổng <b>{vnd(tong)}</b>
        </div>
      </section>

      <ReadingsForm period={period} feeTypes={metered} rows={rows} />
      <InvoiceActions period={period} />

      <section className="space-y-2">
        <h2 className="font-medium">Danh sách hóa đơn kỳ {period}</h2>
        {!invoices?.length && <p className="text-sm opacity-70">Chưa có hóa đơn nào cho kỳ này.</p>}
        <ul className="space-y-1">
          {invoices?.map((i) => (
            <li key={i.id} className="flex justify-between rounded border p-2 text-sm">
              <span>{i.units?.code}</span>
              <span>{vnd(i.total_amount)} · {STATUS_LABEL[i.status] ?? i.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
