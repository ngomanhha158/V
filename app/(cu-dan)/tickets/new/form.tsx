'use client'
import { useActionState, useState } from 'react'
import { createTicket, type NewTicketState } from './actions'
import { compressImage } from '@/lib/photo'
import { Button, Field, Hop, Input, Select, Textarea, cx } from '@/components/ui'
import { IcXong } from '@/components/icons'

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
    const done: string[] = []
    for (const f of files) {
      const blob = await compressImage(f)
      if (blob.size > 5 * 1024 * 1024) {
        setPhotoError(`Ảnh "${f.name}" vẫn lớn hơn 5MB sau khi nén, bỏ qua.`)
        continue
      }
      // Tên file do MÁY CHỦ đặt, không gửi tên gốc lên: tên người dùng đặt có
      // thể mang dấu gạch chéo và trở thành một đường dẫn khác trên đĩa.
      const fd = new FormData()
      fd.set('unit', unitId)
      fd.set('anh', blob, 'anh')
      const r = await fetch('/api/anh', { method: 'POST', body: fd }).catch(() => null)
      const j = (await r?.json().catch(() => null)) as { duong?: string; loi?: string } | null
      if (!r?.ok || !j?.duong) {
        setPhotoError(`Không tải được "${f.name}": ${j?.loi ?? 'mất kết nối'}`)
        continue
      }
      done.push(j.duong)
    }
    setPaths((p) => [...p, ...done])
    setUploading(false)
    e.target.value = ''
  }

  return (
    <form action={action} className="space-y-4">
      {units.length > 1 ? (
        <Field label="Căn hộ">
          <Select name="unit_id" required defaultValue="">
            <option value="" disabled>— Chọn căn hộ —</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.code}</option>)}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="unit_id" value={units[0]?.id ?? ''} />
      )}

      <Field label="Loại sự cố" hint="Mỗi loại có hạn xử lý riêng do BQL cam kết">
        <Select name="category" required defaultValue="">
          <option value="" disabled>— Sự cố gì? —</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Field>

      <Field label="Mức độ">
        <Select name="priority" defaultValue="normal">
          {Object.entries(PRIORITY_LABEL).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>
      </Field>

      <Field label="Tóm tắt">
        <Input name="title" required placeholder="Ví dụ: Rò nước trần nhà vệ sinh" />
      </Field>

      <Field label="Mô tả thêm" hint="Không bắt buộc, nhưng càng rõ thì thợ càng mang đúng đồ">
        <Textarea name="description" rows={4} placeholder="Xảy ra từ khi nào, ở đâu trong căn…" />
      </Field>

      <Field label="Ảnh chụp" hint="Ảnh được nén trên máy bạn trước khi gửi, đỡ tốn dung lượng">
        <div className="rounded-ctl border border-dashed border-line-firm bg-raised p-3">
          <input
            type="file" accept="image/*" multiple capture="environment"
            onChange={onPick} disabled={uploading}
            className={cx(
              'w-full text-[0.8125rem] text-muted',
              'file:mr-3 file:rounded-ctl file:border file:border-line-firm file:bg-surface',
              'file:px-3 file:py-1.5 file:text-[0.8125rem] file:font-medium file:text-ink',
              'hover:file:bg-sunken',
            )}
          />
          {uploading && <p className="mt-2 text-[0.8125rem] text-muted">Đang tải ảnh lên…</p>}
          {photoError && <p className="mt-2 text-[0.8125rem] text-bad">{photoError}</p>}
          {paths.length > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ok">
              <IcXong width={14} height={14} /> Đã đính kèm {paths.length} ảnh
            </p>
          )}
          {paths.map((p) => <input key={p} type="hidden" name="photo_urls" value={p} />)}
        </div>
      </Field>

      {state.error && <Hop tone="xau" title="Không gửi được yêu cầu">{state.error}</Hop>}

      <Button type="submit" dang="chinh" disabled={busy || uploading} className="w-full">
        {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </Button>
    </form>
  )
}
