'use client'
import { useActionState } from 'react'
import { rateTicket, type RateState } from './actions'

export function RatingForm({ ticketId }: { ticketId: string }) {
  const [state, action, busy] = useActionState(rateTicket.bind(null, ticketId), {} as RateState)

  if (state.ok) return <p className="rounded bg-green-100 p-3 text-sm text-green-900">{state.ok}</p>

  return (
    <form action={action} className="space-y-2 rounded border p-3">
      <div className="font-medium">Bạn đánh giá thế nào?</div>
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="flex items-center gap-1 text-sm">
            <input type="radio" name="rating" value={n} required />
            {n} sao
          </label>
        ))}
      </div>
      <input name="rating_note" placeholder="Góp ý thêm (không bắt buộc)" className="w-full rounded border p-2" />
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
        {busy ? 'Đang gửi…' : 'Gửi đánh giá'}
      </button>
    </form>
  )
}
