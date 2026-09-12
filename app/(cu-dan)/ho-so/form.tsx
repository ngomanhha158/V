'use client'

import { useActionState } from 'react'
import { Button, Field, Hop, Input } from '@/components/ui'
import { MAT_KHAU_TOI_THIEU } from '@/lib/tai-khoan'
import { doiLienLac, doiMatKhau, type HoSoState } from './actions'

const dau: HoSoState = {}

function Bao({ s }: { s: HoSoState }) {
  if (s.error) return <Hop tone="xau">{s.error}</Hop>
  if (s.ok) return <Hop tone="tot">{s.ok}</Hop>
  return null
}

export function FormLienLac(
  { hoTen, email, phone }: { hoTen: string; email: string; phone: string },
) {
  const [s, action, dangChay] = useActionState(doiLienLac, dau)
  return (
    <form action={action} className="space-y-3 p-4">
      <Bao s={s} />
      <Field label="Họ tên">
        <Input name="ho_ten" defaultValue={hoTen} required maxLength={120} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" hint="Địa chỉ nhận mã đăng nhập">
          {/* type="email" cố ý KHÔNG dùng: trình duyệt chặn một số địa chỉ hợp
              lệ mà hiếm gặp, và chốt thật là thư có tới hay không. */}
          <Input name="email" defaultValue={email} inputMode="email" autoComplete="email" />
        </Field>
        <Field label="Số điện thoại" hint="Để ban quản lý liên hệ khi cần">
          <Input name="phone" defaultValue={phone} inputMode="tel" className="num" />
        </Field>
      </div>
      <p className="text-[0.75rem] leading-relaxed text-faint">
        Phải giữ lại ít nhất một trong hai. Xoá cả hai thì không còn đường nào
        để đăng nhập lại.
      </p>
      <Button type="submit" disabled={dangChay}>
        {dangChay ? 'Đang lưu…' : 'Lưu thông tin'}
      </Button>
    </form>
  )
}

export function FormMatKhau({ daCo }: { daCo: boolean }) {
  const [s, action, dangChay] = useActionState(doiMatKhau, dau)
  return (
    <form action={action} className="space-y-3 p-4">
      <Bao s={s} />
      {/* Chưa có mật khẩu thì KHÔNG hiện ô mật khẩu cũ. Hiện một ô bắt buộc mà
          người dùng không thể điền là cách chắc chắn nhất để họ bỏ cuộc. */}
      {daCo ? (
        <Field
          label="Mật khẩu hiện tại"
          hint="Không nhớ? Đăng xuất rồi vào lại bằng mã gửi qua email, khi đó không cần ô này."
        >
          <Input name="cu" type="password" required autoComplete="current-password" />
        </Field>
      ) : (
        <Hop tone="trung">
          Tài khoản này chưa đặt mật khẩu — lâu nay vào bằng mã một lần. Đặt mật
          khẩu ở đây để lần sau không phải chờ thư.
        </Hop>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mật khẩu mới" hint={`Ít nhất ${MAT_KHAU_TOI_THIEU} ký tự`}>
          <Input name="moi" type="password" required minLength={MAT_KHAU_TOI_THIEU}
                 autoComplete="new-password" />
        </Field>
        <Field label="Gõ lại mật khẩu mới">
          <Input name="lap" type="password" required minLength={MAT_KHAU_TOI_THIEU}
                 autoComplete="new-password" />
        </Field>
      </div>
      <Button type="submit" disabled={dangChay}>
        {dangChay ? 'Đang đổi…' : daCo ? 'Đổi mật khẩu' : 'Đặt mật khẩu'}
      </Button>
    </form>
  )
}
