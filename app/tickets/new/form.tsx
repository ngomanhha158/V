'use client'
import { useActionState } from 'react'
import { createTicket, type NewTicketState } from './actions'

type Unit = { id: string; code: string }

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

export function NewTicketForm({ units, categories }: { units: Unit[]; categories: string[] }) {
  const [state, action, busy] = useActionState(createTicket, {} as NewTicketState)

  return (
    <form action={action} className="space-y-3">
      {units.length > 1 ? (
        <select name="unit_id" required className="w-full rounded border p-3">
          <option value="">— Căn hộ —</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
        </select>
      ) : (
        <input type="hidden" name="unit_id" value={units[0]?.id ?? ''} />
      )}

      <select name="category" required className="w-full rounded border p-3">
        <option value="">— Sự cố gì? —</option>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select name="priority" defaultValue="normal" className="w-full rounded border p-3">
        {Object.entries(PRIORITY_LABEL).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>

      <input name="title" required placeholder="Tóm tắt ngắn" className="w-full rounded border p-3" />
      <textarea name="description" rows={4} placeholder="Mô tả thêm (không bắt buộc)" className="w-full rounded border p-3" />

      {state.error && <p className="rounded bg-red-100 p-3 text-sm text-red-900">{state.error}</p>}

      <button disabled={busy} className="w-full rounded bg-neutral-900 p-3 text-white disabled:opacity-50">
        {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </button>
    </form>
  )
}
