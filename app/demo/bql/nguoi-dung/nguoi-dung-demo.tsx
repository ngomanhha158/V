'use client'

import { useState } from 'react'
import { Button, Field, Hop, Input, Pill, Select, ngayVN } from '@/components/ui'
import { TEN_VAI_TRO, tenVaiTro } from '@/lib/vai-tro'
import { CAN_CHUA_CO_CHU, type NguoiDungDemo } from '@/lib/demo/data'

// Bản demo KHÔNG gọi server action nào: nó chỉ diễn lại luồng bấm. Đụng vào
// actions.ts là đụng vào auth.users thật, mà cả điểm của /demo là xem được
// phần mềm mà không cần tài khoản và không chạm dữ liệu thật.

function ONhapMatKhau({ label = 'Mật khẩu' }: { label?: string }) {
  const [hien, setHien] = useState(false)
  return (
    <Field label={label} hint="Tối thiểu 8 ký tự. Đọc cho người dùng rồi bảo họ tự đổi.">
      <div className="flex gap-2">
        <Input type={hien ? 'text' : 'password'} placeholder="••••••••" className="flex-1" />
        <Button type="button" onClick={() => setHien((v) => !v)}>{hien ? 'Ẩn' : 'Hiện'}</Button>
      </div>
    </Field>
  )
}

export function FormTaoTaiKhoanDemo() {
  const [loai, setLoai] = useState<'nhan_su' | 'cu_dan'>('cu_dan')
  const [xong, setXong] = useState(false)

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ và tên"><Input placeholder="Nguyễn Văn A" /></Field>
        <Field label="Email hoặc số điện thoại" hint="Đây là thứ họ gõ khi đăng nhập">
          <Input placeholder="ten@example.com hoặc 0901234567" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Loại tài khoản">
          <Select value={loai} onChange={(e) => setLoai(e.target.value as 'nhan_su' | 'cu_dan')}>
            <option value="cu_dan">Cư dân (chủ hộ)</option>
            <option value="nhan_su">Nhân sự ban quản lý</option>
          </Select>
        </Field>
        {loai === 'nhan_su' ? (
          <Field label="Vai trò">
            <Select defaultValue="bql_staff">
              {Object.entries(TEN_VAI_TRO).map(([v, ten]) => (
                <option key={v} value={v}>{ten}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Căn hộ" hint="Chỉ hiện những căn CHƯA có chủ hộ">
            <Select>
              {CAN_CHUA_CO_CHU.map((c) => <option key={c.id} value={c.id}>{c.nhan}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <ONhapMatKhau />

      {xong && (
        <Hop tone="brand">
          Bản demo: sẽ tạo tài khoản {loai === 'nhan_su' ? 'nhân sự' : 'cư dân'} và người đó
          đăng nhập được ngay, không cần thư xác nhận.
        </Hop>
      )}
      <Button dang="chinh" onClick={() => setXong(true)}>Tạo tài khoản</Button>
    </div>
  )
}

function Dong({ n }: { n: NguoiDungDemo }) {
  const [mo, setMo] = useState(false)
  const [xong, setXong] = useState(false)
  const [go, setGo] = useState<string | null>(null)

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
                <Pill tone={v === 'bql_manager' ? 'brand' : 'trung'}>{tenVaiTro(v)}</Pill>
                <button
                  type="button" onClick={() => setGo(v)}
                  className="text-[0.75rem] font-medium text-muted underline-offset-2 hover:text-bad hover:underline"
                >thu hồi</button>
              </span>
            ))}
            {n.can_ho?.map((c) => <Pill key={c} tone="tot">{c}</Pill>)}
          </div>
          <p className="mt-1.5 text-[0.75rem] text-faint">Tạo ngày {ngayVN(n.tao_luc)}</p>
          {go && (
            <div className="mt-2">
              <Hop tone="brand">
                Bản demo: sẽ thu hồi vai trò {tenVaiTro(go)} của {n.ho_ten}.
                {go === 'bql_manager' && ' Màn thật sẽ từ chối nếu đây là trưởng BQL duy nhất.'}
              </Hop>
            </div>
          )}
        </div>

        {mo ? (
          <div className="w-full max-w-sm space-y-3">
            <ONhapMatKhau label={`Mật khẩu mới cho ${n.ho_ten}`} />
            {xong && <Hop tone="brand">Bản demo: sẽ đặt lại mật khẩu cho {n.ho_ten}.</Hop>}
            <div className="flex gap-2">
              <Button dang="chinh" onClick={() => setXong(true)}>Xác nhận</Button>
              <Button onClick={() => { setMo(false); setXong(false) }}>Thôi</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setMo(true)}>Đặt lại mật khẩu</Button>
        )}
      </div>
    </li>
  )
}

export function DanhSachDemo({ ds }: { ds: NguoiDungDemo[] }) {
  return <ul className="divide-y divide-line">{ds.map((n) => <Dong key={n.user_id} n={n} />)}</ul>
}
