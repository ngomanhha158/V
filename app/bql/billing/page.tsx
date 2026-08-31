import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvoiceActions, ReadingsForm } from './forms'
import {
  Bang, Button, Card, CardHead, Input, PageHead, Pill, Stat, Td, Th, Tr, Trong, vnd,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

const TT: Record<string, { nhan: string; tone: 'trung' | 'brand' | 'canh' | 'tot' }> = {
  draft: { nhan: 'Nháp', tone: 'trung' },
  issued: { nhan: 'Đã phát hành', tone: 'brand' },
  partial: { nhan: 'Trả một phần', tone: 'canh' },
  paid: { nhan: 'Đã thu', tone: 'tot' },
  void: { nhan: 'Đã hủy', tone: 'trung' },
}

export default async function Billing({
  searchParams,
}: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()

  const { data: project } = await supabase.from('projects').select('id, name').limit(1).maybeSingle()
  if (!project) return <Trong title="Chưa có dự án nào" />
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

  const daNhap = rows.filter((r) => r.curr !== null).length

  return (
    <div className="space-y-5">
      <PageHead
        title="Hóa đơn"
        sub={`${project.name} · kỳ ${period}`}
        actions={
          <form className="flex items-center gap-2">
            <Input type="month" name="period" defaultValue={period} className="h-10 w-40" />
            <Button type="submit">Xem kỳ</Button>
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat nhan="Tổng hóa đơn" so={invoices?.length ?? 0} phu={vnd(tong)} />
        <Stat
          nhan="Còn nháp" so={nhap} phu="Chưa phát hành cho cư dân"
          tone={nhap ? 'canh' : 'tot'}
        />
        <Stat
          nhan="Đã thu"
          so={(invoices ?? []).filter((i) => i.status === 'paid').length}
          tone="tot"
        />
        <Stat
          nhan="Đã nhập chỉ số" so={`${daNhap}/${rows.length}`}
          phu={daNhap < rows.length ? 'Căn thiếu sẽ không có dòng điện' : 'Đã đủ'}
          tone={daNhap < rows.length ? 'canh' : 'tot'}
        />
      </div>

      <ReadingsForm period={period} feeTypes={metered} rows={rows} />
      <InvoiceActions period={period} />

      <Card>
        <CardHead
          title={`Danh sách hóa đơn kỳ ${period}`}
          right={<span className="text-[0.8125rem] text-faint">{invoices?.length ?? 0}</span>}
        />
        {!invoices?.length ? (
          <div className="p-4">
            <Trong title="Chưa có hóa đơn nào cho kỳ này">
              Bấm “Tính lại hóa đơn nháp” ở khối bên trên để sinh hóa đơn.
            </Trong>
          </div>
        ) : (
          <Bang>
            <thead>
              <tr><Th>Căn hộ</Th><Th phai>Số tiền</Th><Th>Trạng thái</Th></tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const tt = TT[i.status] ?? { nhan: i.status, tone: 'trung' as const }
                return (
                  <Tr key={i.id}>
                    <Td className="font-medium text-ink">{i.units?.code}</Td>
                    <Td phai so>{vnd(i.total_amount)}</Td>
                    <Td><Pill tone={tt.tone}>{tt.nhan}</Pill></Td>
                  </Tr>
                )
              })}
            </tbody>
          </Bang>
        )}
      </Card>
    </div>
  )
}
