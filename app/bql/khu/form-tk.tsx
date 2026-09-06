'use client'
import { useActionState } from 'react'
import { Button, Field, Hop, Input } from '@/components/ui'
import { datTaiKhoan, type TkState } from './tai-khoan'

/**
 * Khai tài khoản nhận tiền của một khu.
 *
 * Ba ô, không có ô nào tùy chọn thật sự: thiếu BIN thì không dựng được QR,
 * thiếu tên chủ tài khoản thì cư dân chuyển khoản xong không biết mình vừa
 * chuyển cho ai.
 */
export function FormTaiKhoan({
  khu, bin, soTk, chuTk,
}: { khu: string; bin: string; soTk: string; chuTk: string }) {
  const [st, act, dang] = useActionState<TkState, FormData>(datTaiKhoan, {})

  return (
    <form action={act} className="space-y-3 border-t border-line p-4">
      <input type="hidden" name="khu" value={khu} />
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Field label="Mã ngân hàng (BIN)" hint="6 chữ số">
          <Input name="bin" defaultValue={bin} inputMode="numeric" placeholder="970436" />
        </Field>
        <Field label="Số tài khoản">
          <Input name="so_tk" defaultValue={soTk} inputMode="numeric" placeholder="1234567890" />
        </Field>
      </div>
      <Field label="Tên chủ tài khoản" hint="In trên màn hóa đơn để cư dân đối chiếu trước khi chuyển">
        <Input name="chu_tk" defaultValue={chuTk} placeholder="BAN QUAN LY CHUNG CU ..." />
      </Field>

      {st.loi && <Hop tone="xau" title="Không lưu được">{st.loi}</Hop>}
      {st.xong && <Hop tone="tot" title="Đã lưu">{st.xong}</Hop>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={dang}>{dang ? 'Đang lưu…' : 'Lưu tài khoản'}</Button>
        <span className="text-[0.75rem] text-faint">
          Để trống cả hai ô số để xóa và quay về cấu hình chung.
        </span>
      </div>
    </form>
  )
}
