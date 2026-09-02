'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select } from '@/components/ui'
import { tenVaiTro, TEN_VAI_TRO } from '@/lib/vai-tro'
import { suaSla, themSla, xoaSla, type SlaState } from './actions'

export type Sla = {
  id: string
  category: string
  priority: string
  respond_mins: number
  resolve_mins: number
  escalate_to: string
}

const dauTien = { error: undefined, ok: undefined } satisfies SlaState

export const TEN_MUC: Record<string, { nhan: string; tone: 'trung' | 'canh' | 'xau' | 'tot' }> = {
  low:    { nhan: 'Thấp',      tone: 'trung' },
  normal: { nhan: 'Bình thường', tone: 'tot' },
  high:   { nhan: 'Cao',       tone: 'canh' },
  urgent: { nhan: 'Khẩn cấp',  tone: 'xau' },
}

/** Đọc phút thành câu người ta nói: "45 phút", "2 giờ", "3 ngày". */
export function docHan(phut: number): string {
  if (phut < 60) return `${phut} phút`
  if (phut < 1440) {
    const g = phut / 60
    return `${Number.isInteger(g) ? g : g.toFixed(1).replace('.', ',')} giờ`
  }
  const n = phut / 1440
  return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} ngày`
}

/** Tách phút ra số + đơn vị lớn nhất còn chia hết, để ô sửa hiện đúng cái đã nhập. */
function tach(phut: number): [string, string] {
  if (phut % 1440 === 0) return [String(phut / 1440), 'ngay']
  if (phut % 60 === 0) return [String(phut / 60), 'gio']
  return [String(phut), 'phut']
}

function OHan({
  nhan, ten, mac = '', macDv = 'gio',
}: { nhan: string; ten: string; mac?: string; macDv?: string }) {
  const [so, setSo] = useState(mac)
  const [dv, setDv] = useState(macDv)
  return (
    <Field label={nhan}>
      <div className="flex gap-2">
        <Input
          name={ten} required inputMode="numeric" className="num flex-1" placeholder="2"
          value={so} onChange={(e) => setSo(e.target.value)}
        />
        <div className="w-24 shrink-0">
          <Select name={`${ten}_dv`} value={dv} onChange={(e) => setDv(e.target.value)}>
            <option value="phut">phút</option>
            <option value="gio">giờ</option>
            <option value="ngay">ngày</option>
          </Select>
        </div>
      </div>
    </Field>
  )
}

function OChung({ mac }: { mac?: Sla }) {
  const [rp, rpDv] = mac ? tach(mac.respond_mins) : ['', 'gio']
  const [rs, rsDv] = mac ? tach(mac.resolve_mins) : ['', 'gio']
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Danh mục sự cố" hint="Chính chữ này hiện ở màn báo hỏng của cư dân">
          <Input name="category" required placeholder="Thang máy" defaultValue={mac?.category} />
        </Field>
        <Field label="Mức ưu tiên">
          <Select name="priority" defaultValue={mac?.priority ?? 'normal'}>
            {Object.entries(TEN_MUC).map(([v, m]) => (
              <option key={v} value={v}>{m.nhan}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <OHan nhan="Hạn tiếp nhận" ten="respond" mac={rp} macDv={rpDv} />
        <OHan nhan="Hạn xử lý xong" ten="resolve" mac={rs} macDv={rsDv} />
      </div>
      <Field label="Quá hạn thì báo ai" hint="Hệ thống tự đánh dấu leo thang 5 phút một lần">
        <Select name="escalate_to" defaultValue={mac?.escalate_to ?? 'bql_manager'}>
          {Object.entries(TEN_VAI_TRO).map(([v, ten]) => (
            <option key={v} value={v}>{ten}</option>
          ))}
        </Select>
      </Field>
    </>
  )
}

export function FormThem() {
  const [s, act, dang] = useActionState(themSla, dauTien)
  return (
    <form action={act} className="space-y-4 p-4">
      <OChung />
      {s.error && <Hop tone="xau" title="Không thêm được">{s.error}</Hop>}
      {s.ok && <Hop tone="tot">{s.ok}</Hop>}
      <Button type="submit" dang="chinh" disabled={dang}>
        {dang ? 'Đang lưu…' : 'Thêm cam kết'}
      </Button>
    </form>
  )
}

function Dong({ p, soTicket }: { p: Sla; soTicket: number }) {
  const [sSua, actSua, dangSua] = useActionState(suaSla, dauTien)
  const [sXoa, actXoa, dangXoa] = useActionState(xoaSla, dauTien)
  const [mo, setMo] = useState(false)
  const m = TEN_MUC[p.priority] ?? { nhan: p.priority, tone: 'trung' as const }

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-semibold text-ink">{p.category}</span>
            <Pill tone={m.tone}>{m.nhan}</Pill>
          </div>
          <p className="mt-1 text-[0.8125rem] text-muted">
            Tiếp nhận trong <strong className="num text-ink">{docHan(p.respond_mins)}</strong>
            {' · '}xử lý xong trong <strong className="num text-ink">{docHan(p.resolve_mins)}</strong>
          </p>
          <p className="mt-1 text-[0.75rem] text-faint">
            Quá hạn báo {tenVaiTro(p.escalate_to)}
            {soTicket > 0 && ` · ${soTicket} yêu cầu đang dùng danh mục này`}
          </p>
        </div>
        {!mo && (
          <div className="flex gap-2">
            <Button type="button" onClick={() => setMo(true)}>Sửa</Button>
            <form action={actXoa}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="ten" value={`${p.category} · ${m.nhan}`} />
              <Button type="submit" disabled={dangXoa}>{dangXoa ? 'Đang xóa…' : 'Xóa'}</Button>
            </form>
          </div>
        )}
      </div>

      {mo && (
        <form action={actSua} className="mt-3 space-y-4 rounded-ctl border border-line bg-sunken p-3">
          <input type="hidden" name="id" value={p.id} />
          <OChung mac={p} />
          {sSua.error && <Hop tone="xau">{sSua.error}</Hop>}
          {sSua.ok && <Hop tone="tot">{sSua.ok}</Hop>}
          <div className="flex gap-2">
            <Button type="submit" dang="chinh" disabled={dangSua}>
              {dangSua ? 'Đang lưu…' : 'Lưu'}
            </Button>
            <Button type="button" onClick={() => setMo(false)}>Thôi</Button>
          </div>
        </form>
      )}

      {sXoa.error && <div className="mt-2"><Hop tone="xau" title="Không xóa được">{sXoa.error}</Hop></div>}
    </li>
  )
}

export function DanhSachSla({ ds, dem }: { ds: Sla[]; dem: Record<string, number> }) {
  return (
    <ul className="divide-y divide-line">
      {ds.map((p) => <Dong key={p.id} p={p} soTicket={dem[p.category] ?? 0} />)}
    </ul>
  )
}
