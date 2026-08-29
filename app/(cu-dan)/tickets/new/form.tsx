'use client'
import { useActionState, useState } from 'react'
import { createTicket, type NewTicketState } from './actions'
import { createClient } from '@/lib/supabase/client'
import { compressImage, photoPath } from '@/lib/photo'

type Unit = { id: string; code: string }

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
}

export function NewTicketForm({ units, categories }: { units: Unit[]; categories: string[] }) {
  const [state, action, busy] = useActionState(createTicket, {} as NewTicketState)
  const [paths, setPaths] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  // Upload NGAY khi chọn ảnh, không đợi lúc gửi form: cư dân bấm gửi rồi ngồi
  // nhìn màn hình trắng là lúc họ bỏ cuộc và gọi điện thay vì dùng app.
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const unitId = (document.querySelector('[name=unit_id]') as HTMLInputElement | HTMLSelectElement | null)?.value
    if (files.length === 0) return
    if (!unitId) { setPhotoError('Chọn căn hộ trước khi thêm ảnh.'); return }

    setUploading(true); setPhotoError(null)
    const supabase = createClient()
    const done: string[] = []
    for (const f of files) {
      const blob = await compressImage(f)
      if (blob.size > 5 * 1024 * 1024) {
        setPhotoError(`Ảnh "${f.name}" vẫn lớn hơn 5MB sau khi nén, bỏ qua.`)
        continue
      }
      const path = photoPath(unitId, blob)
      // RLS của Storage chặn nếu đoạn đầu đường dẫn không phải căn của mình.
      const { error } = await supabase.storage.from('ticket-photos')
        .upload(path, blob, { contentType: blob.type, upsert: false })
      if (error) { setPhotoError(`Không tải được "${f.name}": ${error.message}`); continue }
      done.push(path)
    }
    setPaths((p) => [...p, ...done])
    setUploading(false)
    e.target.value = ''
  }

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

      <div className="space-y-2 rounded border p-3">
        <label className="block text-sm font-medium">Ảnh (không bắt buộc)</label>
        <input type="file" accept="image/*" multiple capture="environment"
               onChange={onPick} disabled={uploading}
               className="w-full text-sm" />
        {uploading && <p className="text-sm opacity-70">Đang tải ảnh lên…</p>}
        {photoError && <p className="text-sm text-red-700">{photoError}</p>}
        {paths.length > 0 && <p className="text-sm text-green-700">Đã đính kèm {paths.length} ảnh.</p>}
        {paths.map((p) => <input key={p} type="hidden" name="photo_urls" value={p} />)}
      </div>

      <input name="title" required placeholder="Tóm tắt ngắn" className="w-full rounded border p-3" />
      <textarea name="description" rows={4} placeholder="Mô tả thêm (không bắt buộc)" className="w-full rounded border p-3" />

      {state.error && <p className="rounded bg-red-100 p-3 text-sm text-red-900">{state.error}</p>}

      <button disabled={busy} className="w-full rounded bg-neutral-900 p-3 text-white disabled:opacity-50">
        {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </button>
    </form>
  )
}
