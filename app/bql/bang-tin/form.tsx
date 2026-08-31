'use client'
import { useActionState, useState } from 'react'
import { dangThongBao, type BangTinState } from './actions'
import { Button, Field, Hop, Input, Select, Textarea } from '@/components/ui'
import { IcGui } from '@/components/icons'

type Toa = { id: string; code: string; name: string }
type Can = { id: string; code: string; building_id: string; floor_no: number }
type Doc = { id: string; section: string; title: string }

export function SoanThongBao({
  toaList, canList, docList,
}: { toaList: Toa[]; canList: Can[]; docList: Doc[] }) {
  const [state, action, busy] = useActionState(dangThongBao, {} as BangTinState)
  const [toa, setToa] = useState('')
  const [can, setCan] = useState('')

  // Chọn 1 căn thì tòa/tầng thành thừa — ẩn đi thay vì để BQL điền rồi bối rối
  // vì sao nó không có tác dụng.
  const theoCan = can !== ''
  const tangCoThe = [...new Set(canList.filter((c) => c.building_id === toa).map((c) => c.floor_no))]
    .sort((a, b) => a - b)
  const canCoThe = toa ? canList.filter((c) => c.building_id === toa) : canList

  const nhamAi = theoCan
    ? `riêng căn ${canList.find((c) => c.id === can)?.code ?? ''}`
    : toa
      ? `tòa ${toaList.find((t) => t.id === toa)?.code ?? ''}`
      : 'toàn khu'

  return (
    <form action={action} className="space-y-4 p-4">
      <Field label="Tiêu đề">
        <Input name="title" required maxLength={200} placeholder="Ví dụ: Cắt nước bảo trì bể ngầm" />
      </Field>

      <Field label="Nội dung" hint="Viết như nói với hàng xóm: việc gì, khi nào, ảnh hưởng ra sao.">
        <Textarea name="body" rows={6} required placeholder="Từ 8h đến 11h ngày…" />
      </Field>

      <fieldset className="space-y-3 rounded-ctl border border-line bg-raised p-3">
        <legend className="px-1 text-[0.8125rem] font-medium text-ink">Gửi cho ai</legend>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tòa">
            <Select
              name="building_id" value={toa} disabled={theoCan}
              onChange={(e) => setToa(e.target.value)}
            >
              <option value="">Toàn khu</option>
              {toaList.map((t) => (
                <option key={t.id} value={t.id}>{t.code} · {t.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Tầng">
            <Select name="floor_no" disabled={theoCan || !toa} defaultValue="">
              <option value="">Mọi tầng</option>
              {tangCoThe.map((t) => <option key={t} value={t}>Tầng {t}</option>)}
            </Select>
          </Field>

          <Field label="Riêng một căn">
            <Select name="unit_id" value={can} onChange={(e) => setCan(e.target.value)}>
              <option value="">Không</option>
              {canCoThe.map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </Select>
          </Field>
        </div>

        {/* Nói thẳng tin này sẽ tới ai. Gửi nhầm phạm vi là làm phiền vài trăm
            nhà, hoặc tệ hơn: gửi chuyện riêng của một căn cho cả tòa. */}
        <p className="text-[0.8125rem] text-muted">
          Thông báo sẽ tới <b className="font-semibold text-ink">{nhamAi}</b>.
        </p>
      </fieldset>

      {docList.length > 0 && (
        <Field label="Trích nội quy" hint="Gắn một mục trong sổ tay để cư dân bấm đọc luôn.">
          <Select name="document_id" defaultValue="">
            <option value="">Không trích</option>
            {docList.map((d) => (
              <option key={d.id} value={d.id}>{d.section} — {d.title}</option>
            ))}
          </Select>
        </Field>
      )}

      <label className="flex items-start gap-2.5 rounded-ctl border border-line p-3">
        <input type="checkbox" name="is_urgent" value="1" className="mt-0.5 size-4 shrink-0" />
        <span className="text-[0.8125rem]">
          <span className="font-medium text-ink">Đánh dấu khẩn</span>
          <span className="mt-0.5 block text-muted">
            Hiện đỏ lên đầu bảng tin. Dùng cho mất nước, mất điện, sự cố an toàn —
            dùng nhiều thì cư dân quen mắt và hết tác dụng.
          </span>
        </span>
      </label>

      {state.error && <Hop tone="xau" title="Không đăng được">{state.error}</Hop>}
      {state.ok && <Hop tone="tot">{state.ok}</Hop>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="phat_hanh" value="1" dang="chinh" disabled={busy}>
          <IcGui width={15} height={15} />
          {busy ? 'Đang gửi…' : 'Phát hành ngay'}
        </Button>
        <Button type="submit" name="phat_hanh" value="0" disabled={busy}>
          Lưu nháp
        </Button>
      </div>
    </form>
  )
}
