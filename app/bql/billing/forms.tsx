'use client'
import { useActionState } from 'react'
import { generateInvoices, issueInvoices, saveReadings, type BillingState } from './actions'
import { Button, Card, CardHead, Hop, Input, Select, Trong } from '@/components/ui'
import { IcHoaDon, IcXong } from '@/components/icons'

const empty: BillingState = {}

function Msg({ state }: { state: BillingState }) {
  if (state.error) return <Hop tone="xau" title="Không thực hiện được">{state.error}</Hop>
  if (state.ok) return <Hop tone="tot" title="Đã xong">{state.ok}</Hop>
  return null
}

export function InvoiceActions({ period }: { period: string }) {
  const [gen, doGen, genBusy] = useActionState(generateInvoices, empty)
  const [iss, doIss, issBusy] = useActionState(issueInvoices, empty)

  return (
    <Card>
      <CardHead title={`Sinh và phát hành — kỳ ${period}`} />

      <form action={doGen} className="space-y-2.5 border-b border-line p-4">
        <input type="hidden" name="period" value={period} />
        <Button type="submit" disabled={genBusy}>
          <IcHoaDon width={15} height={15} />
          {genBusy ? 'Đang tính…' : 'Tính lại hóa đơn nháp'}
        </Button>
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          Chạy lại được bao nhiêu lần cũng được: chỉ đụng hóa đơn còn nháp, hóa
          đơn đã phát hành giữ nguyên.
        </p>
        <Msg state={gen} />
      </form>

      <form action={doIss} className="space-y-2.5 p-4">
        <input type="hidden" name="period" value={period} />
        <Button type="submit" dang="chinh" disabled={issBusy}>
          <IcXong width={15} height={15} />
          {issBusy ? 'Đang phát hành…' : 'Phát hành hóa đơn'}
        </Button>
        {/* Cảnh báo phải nằm CẠNH nút, không nằm cuối thẻ: người ta bấm trước
            khi đọc hết trang. */}
        <Hop tone="canh" title="Đây là mốc chốt số">
          Sau khi phát hành, tính lại sẽ không đụng vào nữa và cư dân nhìn thấy
          hóa đơn. Kiểm kỹ chỉ số công tơ trước khi bấm.
        </Hop>
        <Msg state={iss} />
      </form>
    </Card>
  )
}

type Row = { unit_id: string; code: string; prev: number | null; curr: number | null }

export function ReadingsForm({
  period, feeTypes, rows,
}: {
  period: string
  feeTypes: { id: string; code: string; name: string }[]
  rows: Row[]
}) {
  const [state, action, busy] = useActionState(saveReadings, empty)

  if (feeTypes.length === 0) {
    return (
      <Card>
        <div className="p-4">
          <Trong title="Chưa có loại phí nào tính theo chỉ số">
            Thêm loại phí có cách tính “metered” (điện, nước) thì màn nhập chỉ số
            mới dùng được.
          </Trong>
        </div>
      </Card>
    )
  }

  const daNhap = rows.filter((r) => r.curr !== null).length

  return (
    <Card>
      <form action={action}>
        <CardHead
          title={`Nhập chỉ số kỳ ${period}`}
          sub={`${daNhap}/${rows.length} căn đã có chỉ số`}
          right={
            <Select name="fee_type_id" required className="h-8 w-auto text-[0.8125rem]">
              {feeTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          }
        />
        <input type="hidden" name="period" value={period} />

        <div className="border-b border-line px-4 py-3">
          <Hop tone="trung">
            Bỏ trống căn nào là chưa đọc được công tơ căn đó — không phải lỗi, chỉ
            là chưa lưu. Sai một dòng thì <b>không lưu dòng nào</b>, để không có kỳ
            nửa vời.
          </Hop>
        </div>

        <div className="scroll-x max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            {/* sticky: bảng này dài hàng trăm dòng, cuộn mất tiêu đề là nhập
                nhầm cột cũ sang cột mới. */}
            <thead className="sticky top-0 z-10 bg-raised">
              <tr>
                <th className="border-b border-line px-3 py-2.5 text-left text-[0.75rem] font-semibold tracking-wide text-muted uppercase">
                  Căn hộ
                </th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[0.75rem] font-semibold tracking-wide text-muted uppercase">
                  Chỉ số cũ
                </th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[0.75rem] font-semibold tracking-wide text-muted uppercase">
                  Chỉ số mới
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unit_id} className="hover:bg-raised">
                  <td className="border-b border-line px-3 py-1.5 font-medium text-ink">
                    {r.code}
                    <input type="hidden" name={`code:${r.unit_id}`} value={r.code} />
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <Input
                      name={`prev:${r.unit_id}`} defaultValue={r.prev ?? ''} inputMode="decimal"
                      className="num h-8 w-24 text-[0.8125rem]"
                    />
                  </td>
                  <td className="border-b border-line px-3 py-1.5">
                    <Input
                      name={`curr:${r.unit_id}`} defaultValue={r.curr ?? ''} inputMode="decimal"
                      className="num h-8 w-24 text-[0.8125rem]"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2.5 border-t border-line p-4">
          <Msg state={state} />
          <Button type="submit" dang="chinh" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu chỉ số'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
