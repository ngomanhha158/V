'use client'
import { useActionState } from 'react'
import { generateInvoices, issueInvoices, saveReadings, type BillingState } from './actions'

const empty: BillingState = {}

function Msg({ state }: { state: BillingState }) {
  if (state.error) return <p className="rounded bg-red-100 p-3 text-sm text-red-900">{state.error}</p>
  if (state.ok) return <p className="rounded bg-green-100 p-3 text-sm text-green-900">{state.ok}</p>
  return null
}

export function InvoiceActions({ period }: { period: string }) {
  const [gen, doGen, genBusy] = useActionState(generateInvoices, empty)
  const [iss, doIss, issBusy] = useActionState(issueInvoices, empty)

  return (
    <div className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Hóa đơn kỳ {period}</h2>

      <form action={doGen} className="space-y-2">
        <input type="hidden" name="period" value={period} />
        <button disabled={genBusy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
          {genBusy ? 'Đang tính…' : 'Tính lại hóa đơn nháp'}
        </button>
        <p className="text-sm opacity-70">
          Chạy lại được bao nhiêu lần cũng được: chỉ đụng hóa đơn còn nháp, hóa đơn đã phát hành giữ nguyên.
        </p>
        <Msg state={gen} />
      </form>

      <form action={doIss} className="space-y-2 border-t pt-3">
        <input type="hidden" name="period" value={period} />
        <button disabled={issBusy} className="rounded border border-neutral-900 px-4 py-2 disabled:opacity-50">
          {issBusy ? 'Đang phát hành…' : 'Phát hành hóa đơn'}
        </button>
        <p className="text-sm opacity-70">
          Đây là mốc chốt số. Sau khi phát hành, tính lại sẽ không đụng vào nữa — kiểm kỹ trước khi bấm.
        </p>
        <Msg state={iss} />
      </form>
    </div>
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
    return <p className="text-sm opacity-70">Chưa có loại phí nào tính theo chỉ số (điện, nước).</p>
  }

  return (
    <form action={action} className="space-y-3 rounded border p-4">
      <h2 className="font-medium">Nhập chỉ số kỳ {period}</h2>
      <input type="hidden" name="period" value={period} />

      <select name="fee_type_id" required className="rounded border p-2">
        {feeTypes.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      <p className="text-sm opacity-70">
        Bỏ trống căn nào là chưa đọc được công tơ căn đó — không phải lỗi, chỉ là chưa lưu.
        Sai một dòng thì KHÔNG lưu dòng nào, để không có kỳ nửa vời.
      </p>

      <div className="max-h-96 overflow-y-auto rounded border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-100">
            <tr>
              <th className="p-2 text-left">Căn</th>
              <th className="p-2 text-left">Chỉ số cũ</th>
              <th className="p-2 text-left">Chỉ số mới</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unit_id} className="border-t">
                <td className="p-2">
                  {r.code}
                  <input type="hidden" name={`code:${r.unit_id}`} value={r.code} />
                </td>
                <td className="p-2">
                  <input name={`prev:${r.unit_id}`} defaultValue={r.prev ?? ''} inputMode="decimal"
                         className="w-24 rounded border p-1" />
                </td>
                <td className="p-2">
                  <input name={`curr:${r.unit_id}`} defaultValue={r.curr ?? ''} inputMode="decimal"
                         className="w-24 rounded border p-1" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Msg state={state} />
      <button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Đang lưu…' : 'Lưu chỉ số'}
      </button>
    </form>
  )
}
