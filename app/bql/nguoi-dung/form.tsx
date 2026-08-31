'use client'

import { useActionState, useState } from 'react'
import {
  Button, Field, Hop, Input, Pill, Select, ngayVN,
} from '@/components/ui'
import {
  datLaiMatKhau, ngungNhanSu, taoTaiKhoan, type NguoiDungState,
} from './actions'
import { TEN_VAI_TRO, tenVaiTro } from '@/lib/vai-tro'

export type NguoiDung = {
  user_id: string
  ho_ten: string
  email: string | null
  phone: string | null
  vai_tro_bql: string[] | null
  can_ho: string[] | null
  tao_luc: string
}

export type CanTrong = { id: string; nhan: string }

const dauTien = { error: undefined, ok: undefined } satisfies NguoiDungState

/** Mật khẩu do BQL đặt hộ thì phải đọc lại được cho người ta qua điện thoại —
 *  không nhìn thấy mình vừa gõ gì là gọi lại lần hai. */
function ONhapMatKhau({ name = 'mat_khau', label = 'Mật khẩu' }: { name?: string; label?: string }) {
  const [hien, setHien] = useState(false)
  return (
    <Field label={label} hint="Tối thiểu 8 ký tự. Đọc cho người dùng rồi bảo họ tự đổi.">
      <div className="flex gap-2">
        <Input
          name={name} type={hien ? 'text' : 'password'} minLength={8} required
          autoComplete="new-password" placeholder="••••••••" className="flex-1"
        />
        <Button type="button" onClick={() => setHien((v) => !v)}>
          {hien ? 'Ẩn' : 'Hiện'}
        </Button>
      </div>
    </Field>
  )
}

export function FormTaoTaiKhoan({ canTrong }: { canTrong: CanTrong[] }) {
  const [s, act, dang] = useActionState(taoTaiKhoan, dauTien)
  const [loai, setLoai] = useState<'nhan_su' | 'cu_dan'>('cu_dan')

  return (
    <form action={act} className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên">
          <Input name="ho_ten" required placeholder="Nguyễn Văn A" />
        </Field>
        <Field label="Email hoặc số điện thoại" hint="Đây là thứ họ gõ khi đăng nhập">
          <Input name="danh_tinh" required placeholder="ten@example.com hoặc 0901234567" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại tài khoản">
          <Select
            name="loai" value={loai}
            onChange={(e) => setLoai(e.target.value as 'nhan_su' | 'cu_dan')}
          >
            <option value="cu_dan">Cư dân (chủ hộ)</option>
            <option value="nhan_su">Nhân sự ban quản lý</option>
          </Select>
        </Field>

        {loai === 'nhan_su' ? (
          <Field label="Vai trò">
            <Select name="vai_tro" defaultValue="bql_staff">
              {Object.entries(TEN_VAI_TRO).map(([v, ten]) => (
                <option key={v} value={v}>{ten}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label="Căn hộ"
            hint={canTrong.length ? 'Chỉ hiện những căn CHƯA có chủ hộ' : undefined}
            error={canTrong.length ? undefined : 'Mọi căn đều đã có chủ hộ, hoặc chưa nhập căn nào.'}
          >
            <Select name="can" required disabled={!canTrong.length}>
              {canTrong.map((c) => <option key={c.id} value={c.id}>{c.nhan}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <ONhapMatKhau />

      {s.error && <Hop tone="xau">{s.error}</Hop>}
      {s.ok && <Hop tone="tot">{s.ok}</Hop>}

      <Button dang="chinh" type="submit" disabled={dang || (loai === 'cu_dan' && !canTrong.length)}>
        {dang ? 'Đang tạo…' : 'Tạo tài khoản'}
      </Button>
    </form>
  )
}

function DoiMatKhau({ n }: { n: NguoiDung }) {
  const [s, act, dang] = useActionState(datLaiMatKhau, dauTien)
  const [mo, setMo] = useState(false)

  if (!mo) {
    return (
      <Button type="button" onClick={() => setMo(true)}>Đặt lại mật khẩu</Button>
    )
  }
  return (
    <form action={act} className="w-full max-w-sm space-y-3">
      <input type="hidden" name="user_id" value={n.user_id} />
      <input type="hidden" name="ho_ten" value={n.ho_ten} />
      <ONhapMatKhau label={`Mật khẩu mới cho ${n.ho_ten}`} />
      {s.error && <Hop tone="xau">{s.error}</Hop>}
      {s.ok && <Hop tone="tot">{s.ok}</Hop>}
      <div className="flex gap-2">
        <Button dang="chinh" type="submit" disabled={dang}>
          {dang ? 'Đang đặt…' : 'Xác nhận'}
        </Button>
        <Button type="button" onClick={() => setMo(false)}>Thôi</Button>
      </div>
    </form>
  )
}

function ThuHoi({ n, vaiTro }: { n: NguoiDung; vaiTro: string }) {
  const [s, act, dang] = useActionState(ngungNhanSu, dauTien)
  return (
    <form action={act} className="inline">
      <input type="hidden" name="user_id" value={n.user_id} />
      <input type="hidden" name="vai_tro" value={vaiTro} />
      <input type="hidden" name="ho_ten" value={n.ho_ten} />
      <button
        type="submit" disabled={dang}
        className="text-[0.75rem] font-medium text-muted underline-offset-2 hover:text-bad hover:underline disabled:opacity-50"
      >
        {dang ? 'đang thu hồi…' : 'thu hồi'}
      </button>
      {s.error && <div className="mt-1"><Hop tone="xau">{s.error}</Hop></div>}
    </form>
  )
}

function Dong({ n }: { n: NguoiDung }) {
  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.9375rem] font-semibold text-ink">{n.ho_ten}</div>
          <p className="num mt-1 text-[0.8125rem] text-muted">
            {n.email ?? n.phone ?? <span className="text-faint">chưa có email/SĐT</span>}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {n.vai_tro_bql?.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5">
                <Pill tone={v === 'bql_manager' ? 'brand' : 'trung'}>
                  {tenVaiTro(v)}
                </Pill>
                <ThuHoi n={n} vaiTro={v} />
              </span>
            ))}
            {n.can_ho?.map((c) => <Pill key={c} tone="tot">{c}</Pill>)}
          </div>

          <p className="mt-1.5 text-[0.75rem] text-faint">Tạo ngày {ngayVN(n.tao_luc)}</p>
        </div>

        <DoiMatKhau n={n} />
      </div>
    </li>
  )
}

export function DanhSach({ ds }: { ds: NguoiDung[] }) {
  return (
    <ul className="divide-y divide-line">
      {ds.map((n) => <Dong key={n.user_id} n={n} />)}
    </ul>
  )
}
