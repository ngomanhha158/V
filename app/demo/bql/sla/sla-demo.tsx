'use client'

import { useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select } from '@/components/ui'
import { TEN_VAI_TRO, tenVaiTro } from '@/lib/vai-tro'
import { TEN_MUC, docHan } from '@/app/bql/sla/form'
import { SO_TICKET_THEO_DANH_MUC, type SlaDemo } from '@/lib/demo/data'

// Không import actions.ts — bản demo không được ghi vào sla_policies thật.
// TEN_MUC và docHan thì dùng chung với màn thật: nhãn mức ưu tiên hay cách đọc
// hạn mà lệch nhau giữa hai màn là bản demo dạy sai người dùng.

function OChung({ mac }: { mac?: SlaDemo }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Danh mục sự cố" hint="Chính chữ này hiện ở màn báo hỏng của cư dân">
          <Input placeholder="Thang máy" defaultValue={mac?.category} />
        </Field>
        <Field label="Mức ưu tiên">
          <Select defaultValue={mac?.priority ?? 'normal'}>
            {Object.entries(TEN_MUC).map(([v, m]) => <option key={v} value={v}>{m.nhan}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hạn tiếp nhận">
          <div className="flex gap-2">
            <Input inputMode="numeric" className="num flex-1" placeholder="15" />
            <div className="w-24 shrink-0">
              <Select defaultValue="phut">
                <option value="phut">phút</option><option value="gio">giờ</option><option value="ngay">ngày</option>
              </Select>
            </div>
          </div>
        </Field>
        <Field label="Hạn xử lý xong">
          <div className="flex gap-2">
            <Input inputMode="numeric" className="num flex-1" placeholder="2" />
            <div className="w-24 shrink-0">
              <Select defaultValue="gio">
                <option value="phut">phút</option><option value="gio">giờ</option><option value="ngay">ngày</option>
              </Select>
            </div>
          </div>
        </Field>
      </div>
      <Field label="Quá hạn thì báo ai" hint="Hệ thống tự đánh dấu leo thang 5 phút một lần">
        <Select defaultValue={mac?.escalate_to ?? 'bql_manager'}>
          {Object.entries(TEN_VAI_TRO).map(([v, ten]) => <option key={v} value={v}>{ten}</option>)}
        </Select>
      </Field>
    </>
  )
}

export function FormThemDemo() {
  const [xong, setXong] = useState(false)
  return (
    <div className="space-y-4 p-4">
      <OChung />
      {xong && <Hop tone="brand">Bản demo: sẽ thêm cam kết này, và cư dân chọn được danh mục đó ngay.</Hop>}
      <Button dang="chinh" onClick={() => setXong(true)}>Thêm cam kết</Button>
    </div>
  )
}

function Dong({ p }: { p: SlaDemo }) {
  const [mo, setMo] = useState(false)
  const [xong, setXong] = useState<'sua' | 'xoa' | null>(null)
  const m = TEN_MUC[p.priority] ?? { nhan: p.priority, tone: 'trung' as const }
  const soTicket = SO_TICKET_THEO_DANH_MUC[p.category] ?? 0

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
            <Button type="button" onClick={() => setXong('xoa')}>Xóa</Button>
          </div>
        )}
      </div>

      {mo && (
        <div className="mt-3 space-y-4 rounded-ctl border border-line bg-sunken p-3">
          <OChung mac={p} />
          {xong === 'sua' && (
            <Hop tone="brand">
              Bản demo: yêu cầu đang mở giữ nguyên hạn cũ, hạn mới chỉ áp cho yêu cầu tạo sau.
            </Hop>
          )}
          <div className="flex gap-2">
            <Button dang="chinh" onClick={() => setXong('sua')}>Lưu</Button>
            <Button type="button" onClick={() => { setMo(false); setXong(null) }}>Thôi</Button>
          </div>
        </div>
      )}

      {xong === 'xoa' && (
        <div className="mt-2">
          <Hop tone="brand">
            Bản demo: xóa mức cuối của một danh mục thì cư dân không chọn được danh mục đó nữa.
          </Hop>
        </div>
      )}
    </li>
  )
}

export function DanhSachSlaDemo({ ds }: { ds: SlaDemo[] }) {
  return <ul className="divide-y divide-line">{ds.map((p) => <Dong key={p.id} p={p} />)}</ul>
}
