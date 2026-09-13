import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { duAnBQL } from '@/lib/du-an'
import { InvoiceActions, ReadingsForm } from './forms'
import { NhapChiSo } from './nhap-chi-so'
import { quyen } from '@/lib/chot-quyen'
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
  const db = await createClient()

  const project = await duAnBQL()
  if (!project) return <Trong title="Chưa có dự án nào" />
  const kqStaff = await db.rpc('is_staff', { p_project: project.id })
  if (!quyen(kqStaff, 'is_staff')) redirect('/')

  // Kỳ mặc định = tháng này. Dạng YYYY-MM cho input type=month.
  const now = new Date()
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? '') ? sp.period! : thisMonth
  const periodDate = `${period}-01`

  // Kỳ TRƯỚC, để lấy chỉ số cũ. "Chỉ số cũ" của tháng này CHÍNH LÀ chỉ số mới
  // của tháng trước — không phải một con số BQL phải tự nhớ. Trước đây trang chỉ
  // đọc đúng kỳ đang chọn, nên lần nhập đầu của mỗi tháng ô "chỉ số cũ" trống
  // trơn cho cả 240 căn.
  const [ky, thang] = period.split('-').map(Number)
  const truoc = thang === 1 ? `${ky - 1}-12-01` : `${ky}-${String(thang - 1).padStart(2, '0')}-01`

  const [{ data: feeTypes }, { data: units }, { data: readings }, { data: readingsTruoc }, { data: invoices }] =
    await Promise.all([
      db.from('fee_types').select('id, code, name, calc_method').order('code'),
      // Căn CỦA KHU ĐANG XEM. Trước đây câu này không lọc gì: người quản lý
      // hai khu mở màn Biểu phí ghi tên khu A, mà bảng chỉ số bên dưới liệt kê
      // căn của cả hai khu trộn lẫn — và ô "đã nhập chỉ số 25/49" đếm luôn
      // những căn không thuộc khu đang xem.
      db.from('units').select('id, code, buildings!inner(project_id)')
        .eq('buildings.project_id', project.id).order('code'),
      db.from('meter_readings').select('unit_id, fee_type_id, prev_index, curr_index').eq('period', periodDate),
      db.from('meter_readings').select('unit_id, fee_type_id, curr_index').eq('period', truoc),
      db.from('invoices').select('id, status, total_amount, unit_id, units(code)').eq('period', periodDate).order('status'),
    ])

  const metered = (feeTypes ?? []).filter((f) => f.calc_method === 'metered')
  const firstMetered = metered[0]?.id
  const byUnit = new Map(
    (readings ?? []).filter((r) => r.fee_type_id === firstMetered).map((r) => [r.unit_id, r]),
  )
  const cuoiKyTruoc = new Map(
    (readingsTruoc ?? []).filter((r) => r.fee_type_id === firstMetered).map((r) => [r.unit_id, r.curr_index]),
  )
  const rows = (units ?? []).map((u) => ({
    unit_id: u.id,
    code: u.code,
    // Đã nhập kỳ này thì giữ nguyên (BQL đang sửa); chưa thì lấy chỉ số cuối kỳ
    // trước. Null nghĩa là căn này chưa từng có chỉ số nào — công tơ mới lắp,
    // và người nhập phải tự gõ số khởi điểm chứ hệ thống không đoán hộ.
    prev: byUnit.get(u.id)?.prev_index ?? cuoiKyTruoc.get(u.id) ?? null,
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
      <NhapChiSo period={period} feeTypes={metered} />
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
