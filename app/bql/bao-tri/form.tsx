'use client'

import { useActionState, useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select } from '@/components/ui'
import { CHU_KY, HANG_MUC, hanKeTiep, tenChuKy, tenHangMuc, tinhTrangHan } from '@/lib/bao-tri'
import { ngayVN } from '@/lib/ngay'
import {
  doiTrangThai, suaKeHoach, themKeHoach, xongLan, type BaoTriState,
} from './actions'

const dauTien = { error: undefined, ok: undefined } satisfies BaoTriState

export type KeHoach = {
  id: string
  ten: string
  hang_muc: string
  chu_ky_ngay: number
  han_ke_tiep: string
  nhac_truoc_ngay: number
  bat_buoc_phap_ly: boolean
  nha_thau: string | null
  building_id: string | null
  is_active: boolean
}

export type Toa = { id: string; code: string; name: string }

function OChung({ mac, toa }: { mac?: KeHoach; toa: Toa[] }) {
  const [chuKy, setChuKy] = useState(String(mac?.chu_ky_ngay ?? 365))
  const [nhac, setNhac] = useState(String(mac?.nhac_truoc_ngay ?? 7))
  const so = Number(chuKy)
  const nhacSo = Number(nhac)
  // Nhắc trước dài hơn cả chu kỳ thì lần sau mở ra trước khi lần này kịp đóng.
  const chongCheo = Number.isFinite(so) && Number.isFinite(nhacSo) && nhacSo >= so && so > 0

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên hạng mục" hint="Chính chữ này hiện trên danh sách việc của kỹ thuật">
          <Input name="ten" required placeholder="Kiểm định thang máy tháp P1" defaultValue={mac?.ten} />
        </Field>
        <Field label="Nhóm">
          <Select name="hang_muc" defaultValue={mac?.hang_muc ?? 'thang_may'}>
            {Object.entries(HANG_MUC).map(([k, v]) => (
              <option key={k} value={k}>{v.nhan}{v.luat ? ' (theo luật)' : ''}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Chu kỳ (ngày)"
          hint={Number.isFinite(so) && so > 0 ? tenChuKy(so) : 'số ngày giữa hai lần'}
        >
          <Input
            name="chu_ky_ngay" required inputMode="numeric" className="num"
            value={chuKy} onChange={(e) => setChuKy(e.target.value)}
            list="chu-ky-goi-y"
          />
          <datalist id="chu-ky-goi-y">
            {CHU_KY.map((c) => <option key={c.ngay} value={c.ngay}>{c.nhan}</option>)}
          </datalist>
        </Field>
        <Field label="Nhắc trước (ngày)" error={chongCheo ? 'Dài hơn cả chu kỳ' : undefined}>
          <Input
            name="nhac_truoc_ngay" required inputMode="numeric" className="num"
            value={nhac} onChange={(e) => setNhac(e.target.value)}
          />
        </Field>
        <Field label="Hạn kế tiếp">
          <Input
            type="date" name="han_ke_tiep" required className="num"
            defaultValue={mac?.han_ke_tiep ?? hanKeTiep(Number.isFinite(so) ? so : 365)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tòa" hint="Để trống nếu áp cho cả khu">
          <Select name="building_id" defaultValue={mac?.building_id ?? ''}>
            <option value="">Cả khu</option>
            {toa.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.name}</option>)}
          </Select>
        </Field>
        <Field label="Nhà thầu" hint="Không bắt buộc">
          <Input name="nha_thau" placeholder="Công ty Thang máy ABC" defaultValue={mac?.nha_thau ?? ''} />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-[0.8125rem] text-muted">
        <input
          type="checkbox" name="bat_buoc" value="1" className="mt-0.5 size-4 shrink-0 accent-brand"
          defaultChecked={mac?.bat_buoc_phap_ly ?? false}
        />
        <span>
          <strong className="text-ink">Bắt buộc theo luật.</strong> Hạng mục này quá hạn là bị
          phạt và mất an toàn, nên nó không bao giờ xuống màu xanh dù còn xa — để nó không
          trôi lẫn vào đống việc thường ngày.
        </span>
      </label>
    </>
  )
}

export function FormThem({ toa }: { toa: Toa[] }) {
  const [state, formAction, dangChay] = useActionState(themKeHoach, dauTien)
  const [mo, setMo] = useState(false)

  if (!mo) {
    return (
      <div className="p-4">
        <Button dang="chinh" onClick={() => setMo(true)}>Thêm hạng mục bảo trì</Button>
        {state.ok && <div className="mt-3"><Hop tone="tot" title="Xong">{state.ok}</Hop></div>}
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4 p-4">
      <OChung toa={toa} />
      {state.error && <Hop tone="xau" title="Không thêm được">{state.error}</Hop>}
      {state.ok && <Hop tone="tot" title="Xong">{state.ok}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" dang="chinh" disabled={dangChay}>
          {dangChay ? 'Đang lưu…' : 'Lưu hạng mục'}
        </Button>
        <Button type="button" dang="nhat" onClick={() => setMo(false)}>Đóng</Button>
      </div>
    </form>
  )
}

export function HangKeHoach({ kh, toa }: { kh: KeHoach; toa: Toa[] }) {
  const [sua, setSua] = useState(false)
  const [state, formAction, dangChay] = useActionState(suaKeHoach, dauTien)
  const [tt, doiAction, dangDoi] = useActionState(doiTrangThai, dauTien)
  const t = tinhTrangHan(kh.han_ke_tiep, kh.nhac_truoc_ngay, kh.bat_buoc_phap_ly)

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{kh.ten}</span>
            {kh.bat_buoc_phap_ly && <Pill tone="brand" cham={false}>Theo luật</Pill>}
            {!kh.is_active && <Pill tone="trung">Tạm dừng</Pill>}
          </div>
          <div className="mt-1 text-[0.8125rem] text-muted">
            {tenHangMuc(kh.hang_muc)} · {tenChuKy(kh.chu_ky_ngay)} · hạn {ngayVN(kh.han_ke_tiep)}
            {kh.nha_thau && ` · ${kh.nha_thau}`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {kh.is_active && <Pill tone={t.tone}>{t.nhan}</Pill>}
          <Button co="sm" dang="nhat" onClick={() => setSua((s) => !s)}>
            {sua ? 'Đóng' : 'Sửa'}
          </Button>
          <form action={doiAction}>
            <input type="hidden" name="id" value={kh.id} />
            <input type="hidden" name="ten" value={kh.ten} />
            <input type="hidden" name="bat" value={kh.is_active ? '0' : '1'} />
            <Button type="submit" co="sm" dang={kh.is_active ? 'nguy' : 'phu'} disabled={dangDoi}>
              {kh.is_active ? 'Tạm dừng' : 'Bật lại'}
            </Button>
          </form>
        </div>
      </div>

      {tt.error && <div className="mt-2"><Hop tone="xau">{tt.error}</Hop></div>}
      {tt.ok && <div className="mt-2"><Hop tone="tot">{tt.ok}</Hop></div>}

      {sua && (
        <form action={formAction} className="mt-3 space-y-4 rounded-card border border-line bg-raised p-4">
          <input type="hidden" name="id" value={kh.id} />
          <OChung mac={kh} toa={toa} />
          {state.error && <Hop tone="xau" title="Không sửa được">{state.error}</Hop>}
          {state.ok && <Hop tone="tot" title="Xong">{state.ok}</Hop>}
          <Button type="submit" dang="chinh" disabled={dangChay}>
            {dangChay ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </form>
      )}
    </li>
  )
}

export function FormXong({
  id, ten, chuKy,
}: { id: string; ten: string; chuKy: number }) {
  const [state, formAction, dangChay] = useActionState(xongLan, dauTien)
  const [mo, setMo] = useState(false)

  if (state.ok) return <Hop tone="tot" title="Xong">{state.ok}</Hop>

  if (!mo) {
    return (
      <div className="flex items-center gap-2">
        <Button co="sm" dang="chinh" onClick={() => setMo(true)}>Đánh dấu đã làm</Button>
        <span className="text-[0.75rem] text-faint">
          Hạn kế tiếp sẽ là {ngayVN(hanKeTiep(chuKy))}
        </span>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ten" value={ten} />
      <Field label="Kết quả" hint="Ghi lại để lần sau đọc lại được — không bắt buộc">
        <Input name="ket_qua" placeholder="Đạt, không có khuyến nghị" />
      </Field>
      {state.error && <Hop tone="xau" title="Không đóng được">{state.error}</Hop>}
      <div className="flex gap-2">
        <Button type="submit" co="sm" dang="chinh" disabled={dangChay}>
          {dangChay ? 'Đang lưu…' : 'Xác nhận đã làm'}
        </Button>
        <Button type="button" co="sm" dang="nhat" onClick={() => setMo(false)}>Hủy</Button>
      </div>
    </form>
  )
}
